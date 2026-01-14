export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  is_admin: number;
  token_version: number;
  failed_attempts: number;
  lock_until: Date | null;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
}

export interface CaptchaRow {
  id: number;
  code_hash: string;
  ip_address: string | null;
  created_at: Date;
  expires_at: Date;
  consumed: number;
}
