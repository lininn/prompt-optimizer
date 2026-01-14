import type mysql from 'mysql2/promise';
import { ResultSetHeader } from 'mysql2';
import svgCaptcha from 'svg-captcha';
import bcrypt from 'bcryptjs';
import { AuthConfig } from '../config/auth-config.js';
import { CaptchaRow } from './types.js';

function formatCaptchaImage(svg: string): string {
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

export async function generateCaptcha(
  pool: mysql.Pool,
  config: AuthConfig,
  ipAddress?: string | null
): Promise<{ id: number; image: string; expiresIn: number }> {
  if (ipAddress) {
    const [rows] = await pool.query(
      'SELECT COUNT(*) AS count FROM auth_captchas WHERE ip_address = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? SECOND)',
      [ipAddress, config.captchaCooldownSeconds]
    );
    const count = (rows as Array<{ count: number }>)[0]?.count || 0;
    if (count >= config.captchaCooldownMaxRequests) {
      throw new Error('请求过于频繁，请稍后再试');
    }
  }

  const captcha = svgCaptcha.create({
    size: 4,
    noise: 2,
    ignoreChars: '0Oo1Il',
    color: true,
    background: '#f8f9fb',
    width: 140,
    height: 52
  });

  const code = captcha.text.toUpperCase();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + config.captchaTtlSeconds * 1000);

  const [result] = await pool.query<ResultSetHeader>(
    'INSERT INTO auth_captchas (code_hash, ip_address, expires_at) VALUES (?, ?, ?)',
    [codeHash, ipAddress || null, expiresAt]
  );

  return {
    id: result.insertId,
    image: formatCaptchaImage(captcha.data),
    expiresIn: config.captchaTtlSeconds
  };
}

export async function verifyCaptcha(
  pool: mysql.Pool,
  captchaId: number,
  code: string
): Promise<boolean> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT * FROM auth_captchas WHERE id = ? LIMIT 1',
    [captchaId]
  );

  if (!rows.length) {
    return false;
  }

  const record = rows[0] as unknown as CaptchaRow;

  if (record.consumed || new Date(record.expires_at) < new Date()) {
    await pool.query('UPDATE auth_captchas SET consumed = 1 WHERE id = ?', [captchaId]);
    return false;
  }

  const ok = await bcrypt.compare(code.toUpperCase(), record.code_hash);

  await pool.query('UPDATE auth_captchas SET consumed = 1 WHERE id = ?', [captchaId]);
  return ok;
}
