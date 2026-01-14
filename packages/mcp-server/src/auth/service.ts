import type mysql from 'mysql2/promise';
import { ResultSetHeader } from 'mysql2';
import jwt from 'jsonwebtoken';
import { AuthConfig } from '../config/auth-config.js';
import { UserRow } from './types.js';
import { hashPassword, validatePasswordStrength, verifyPassword } from './password.js';

export interface TokenPayload {
  sub: number;
  username: string;
  token_version: number;
}

export class AuthService {
  constructor(private pool: mysql.Pool, private config: AuthConfig) {}

  private mapUser(row: any): UserRow {
    return {
      id: row.id,
      username: row.username,
      password_hash: row.password_hash,
      is_admin: row.is_admin,
      token_version: row.token_version,
      failed_attempts: row.failed_attempts,
      lock_until: row.lock_until ? new Date(row.lock_until) : null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_login_at: row.last_login_at ? new Date(row.last_login_at) : null
    };
  }

  private isLocked(user: UserRow): boolean {
    if (!user.lock_until) return false;
    return user.lock_until.getTime() > Date.now();
  }

  private lockRemaining(user: UserRow): number {
    if (!user.lock_until) return 0;
    const diff = user.lock_until.getTime() - Date.now();
    return diff > 0 ? Math.ceil(diff / 1000) : 0;
  }

  private async recordFailure(username: string, ip?: string | null): Promise<void> {
    await this.pool.query(
      'INSERT INTO auth_login_failures (username, ip_address) VALUES (?, ?)',
      [username || null, ip || null]
    );
  }

  private async handleFailedAttempt(user: UserRow): Promise<void> {
    const attempts = user.failed_attempts + 1;
    let lockUntil: Date | null = null;
    if (attempts >= this.config.rateLimitMaxFailures) {
      lockUntil = new Date(Date.now() + this.config.rateLimitLockMinutes * 60 * 1000);
    }

    await this.pool.query(
      'UPDATE auth_users SET failed_attempts = ?, lock_until = ? WHERE id = ?',
      [attempts, lockUntil, user.id]
    );
  }

  private async resetFailures(userId: number): Promise<void> {
    await this.pool.query(
      'UPDATE auth_users SET failed_attempts = 0, lock_until = NULL WHERE id = ?',
      [userId]
    );
  }

  private generateToken(user: UserRow): string {
    const payload: TokenPayload = {
      sub: user.id,
      username: user.username,
      token_version: user.token_version
    };

    return jwt.sign(payload, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpiresIn
    });
  }

  async getUserById(id: number): Promise<UserRow | null> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>('SELECT * FROM auth_users WHERE id = ? LIMIT 1', [id]);
    if (!rows.length) return null;
    return this.mapUser(rows[0]);
  }

  async getUserByUsername(username: string): Promise<UserRow | null> {
    const [rows] = await this.pool.query<mysql.RowDataPacket[]>(
      'SELECT * FROM auth_users WHERE username = ? LIMIT 1',
      [username]
    );
    if (!rows.length) return null;
    return this.mapUser(rows[0]);
  }

  async register(username: string, password: string): Promise<{ token: string; user: any }> {
    if (!this.config.allowRegistration) {
      throw new Error('当前禁止注册');
    }

    const normalizedUsername = username.trim();
    if (!normalizedUsername) {
      throw new Error('用户名不能为空');
    }

    const strength = validatePasswordStrength(
      password,
      this.config.passwordMinLength,
      this.config.requireLetterAndNumber
    );
    if (!strength.ok) {
      throw new Error(strength.message || '密码不符合要求');
    }

    const existing = await this.getUserByUsername(normalizedUsername);
    if (existing) {
      throw new Error('用户名已存在');
    }

    const passwordHash = await hashPassword(password);
    const [result] = await this.pool.query<ResultSetHeader>(
      'INSERT INTO auth_users (username, password_hash) VALUES (?, ?)',
      [normalizedUsername, passwordHash]
    );

    const user: UserRow = {
      id: result.insertId,
      username: normalizedUsername,
      password_hash: passwordHash,
      is_admin: 0,
      token_version: 0,
      failed_attempts: 0,
      lock_until: null,
      created_at: new Date(),
      updated_at: new Date(),
      last_login_at: null
    };

    const token = this.generateToken(user);
    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin,
        last_login_at: user.last_login_at
      }
    };
  }

  async login(
    username: string,
    password: string,
    ip?: string | null
  ): Promise<{ token: string; user: any; locked?: number }> {
    const normalized = username.trim();
    const user = await this.getUserByUsername(normalized);
    if (!user) {
      await this.recordFailure(normalized, ip);
      throw new Error('用户名或密码错误');
    }

    if (this.isLocked(user)) {
      const remain = this.lockRemaining(user);
      throw new Error(`尝试过多，请 ${Math.ceil(remain / 60)} 分钟后再试`);
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      await this.recordFailure(normalized, ip);
      await this.handleFailedAttempt(user);
      throw new Error('用户名或密码错误');
    }

    await this.resetFailures(user.id);
    await this.pool.query('UPDATE auth_users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    const freshUser = await this.getUserById(user.id);
    const token = this.generateToken(freshUser!);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin,
        last_login_at: new Date()
      }
    };
  }

  async changePassword(userId: number, oldPassword: string, newPassword: string): Promise<{ token: string }> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const ok = await verifyPassword(oldPassword, user.password_hash);
    if (!ok) {
      throw new Error('旧密码错误');
    }

    const strength = validatePasswordStrength(
      newPassword,
      this.config.passwordMinLength,
      this.config.requireLetterAndNumber
    );
    if (!strength.ok) {
      throw new Error(strength.message || '密码不符合要求');
    }

    const newHash = await hashPassword(newPassword);
    const newVersion = user.token_version + 1;
    await this.pool.query(
      'UPDATE auth_users SET password_hash = ?, token_version = ?, failed_attempts = 0, lock_until = NULL, updated_at = NOW() WHERE id = ?',
      [newHash, newVersion, user.id]
    );

    const updatedUser = await this.getUserById(user.id);
    const token = this.generateToken(updatedUser!);
    return { token };
  }

  async verifyToken(token: string): Promise<UserRow | null> {
    try {
      const payload = jwt.verify(token, this.config.jwtSecret) as TokenPayload;
      if (!payload.sub) return null;

      const user = await this.getUserById(payload.sub);
      if (!user) return null;
      if (payload.token_version !== user.token_version) return null;

      return user;
    } catch (err) {
      return null;
    }
  }
}
