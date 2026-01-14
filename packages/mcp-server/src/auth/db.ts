import mysql from 'mysql2/promise';
import { DbConfig } from '../config/auth-config.js';

let pool: mysql.Pool | null = null;

export function getPool(dbConfig: DbConfig): mysql.Pool {
  if (pool) return pool;

  pool = mysql.createPool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4'
  });

  return pool;
}

export async function ensureSchema(dbPool: mysql.Pool): Promise<void> {
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      username VARCHAR(191) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      is_admin TINYINT(1) NOT NULL DEFAULT 0,
      token_version INT NOT NULL DEFAULT 0,
      failed_attempts INT NOT NULL DEFAULT 0,
      lock_until DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      last_login_at DATETIME NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS auth_captchas (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      code_hash VARCHAR(255) NOT NULL,
      ip_address VARCHAR(45) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      consumed TINYINT(1) NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      INDEX idx_captcha_expire (expires_at),
      INDEX idx_captcha_ip (ip_address)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS auth_login_failures (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      username VARCHAR(191) NULL,
      ip_address VARCHAR(45) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_login_fail_username (username),
      INDEX idx_login_fail_ip (ip_address),
      INDEX idx_login_fail_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}
