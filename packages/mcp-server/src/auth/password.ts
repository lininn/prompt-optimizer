import bcrypt from 'bcryptjs';

export function validatePasswordStrength(
  password: string,
  minLength: number,
  requireAlnum: boolean
): { ok: boolean; message?: string } {
  if (!password || password.length < minLength) {
    return { ok: false, message: `密码长度至少 ${minLength} 位` };
  }

  if (requireAlnum) {
    const hasLetter = /[A-Za-z]/.test(password);
    const hasNumber = /\d/.test(password);
    if (!hasLetter || !hasNumber) {
      return { ok: false, message: '密码必须包含字母和数字' };
    }
  }

  return { ok: true };
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
