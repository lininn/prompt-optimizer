import express from 'express';
import type mysql from 'mysql2/promise';
import { AuthConfig } from '../config/auth-config.js';
import { ensureSchema, getPool } from './db.js';
import { generateCaptcha, verifyCaptcha } from './captcha.js';
import { AuthService } from './service.js';
import { validatePasswordStrength } from './password.js';

function getClientIp(req: express.Request): string {
  const forwarded = (req.headers['x-forwarded-for'] as string) || '';
  const ip = forwarded.split(',')[0].trim() || req.socket.remoteAddress || '';
  return ip;
}

function sendError(res: express.Response, message: string, status = 400) {
  res.status(status).json({ code: status, message });
}

async function buildEnabledRouters(app: express.Express, config: AuthConfig): Promise<void> {
  const pool: mysql.Pool = getPool(config.db);
  await ensureSchema(pool);
  const service = new AuthService(pool, config);

  const authRouter = express.Router();
  const captchaRouter = express.Router();

  captchaRouter.get('/image', async (req, res) => {
    try {
      const ip = getClientIp(req);
      const captcha = await generateCaptcha(pool, config, ip);
      res.json({ code: 200, data: { captcha_id: captcha.id, image: captcha.image, expires_in: captcha.expiresIn } });
    } catch (error: any) {
      sendError(res, error?.message || '验证码生成失败', 429);
    }
  });

  authRouter.get('/config', (_req, res) => {
    res.json({
      code: 200,
      data: {
        enabled: true,
        allowRegistration: config.allowRegistration,
        passwordMinLength: config.passwordMinLength,
        requireLetterAndNumber: config.requireLetterAndNumber
      }
    });
  });

  authRouter.get('/health', (_req, res) => {
    res.json({ code: 200, data: { status: 'ok' } });
  });

  authRouter.post('/register', async (req, res) => {
    try {
      const { username, password, captcha_id, captcha_code } = req.body || {};
      if (!username || !password || !captcha_id || !captcha_code) {
        return sendError(res, '参数缺失');
      }

      const captchaOk = await verifyCaptcha(pool, Number(captcha_id), String(captcha_code));
      if (!captchaOk) {
        return sendError(res, '验证码错误或已过期');
      }

      const result = await service.register(String(username), String(password));
      res.json({ code: 200, data: result });
    } catch (error: any) {
      sendError(res, error?.message || '注册失败');
    }
  });

  authRouter.post('/login', async (req, res) => {
    try {
      const { username, password, captcha_id, captcha_code } = req.body || {};
      if (!username || !password || !captcha_id || !captcha_code) {
        return sendError(res, '参数缺失');
      }

      const captchaOk = await verifyCaptcha(pool, Number(captcha_id), String(captcha_code));
      if (!captchaOk) {
        return sendError(res, '验证码错误或已过期');
      }

      const ip = getClientIp(req);
      const result = await service.login(String(username), String(password), ip);
      res.json({ code: 200, data: result });
    } catch (error: any) {
      sendError(res, error?.message || '登录失败', 401);
    }
  });

  const authGuard: express.RequestHandler = async (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return sendError(res, '未登录', 401);
    }

    const user = await service.verifyToken(token);
    if (!user) {
      return sendError(res, '登录已过期，请重新登录', 401);
    }

    (req as any).user = user;
    next();
  };

  authRouter.get('/me', authGuard, async (req, res) => {
    const user = (req as any).user;
    res.json({
      code: 200,
      data: {
        id: user.id,
        username: user.username,
        is_admin: user.is_admin,
        last_login_at: user.last_login_at
      }
    });
  });

  authRouter.post('/change-password', authGuard, async (req, res) => {
    try {
      const user = (req as any).user;
      const { old_password, new_password } = req.body || {};
      if (!old_password || !new_password) {
        return sendError(res, '参数缺失');
      }

      const strength = validatePasswordStrength(
        String(new_password),
        config.passwordMinLength,
        config.requireLetterAndNumber
      );
      if (!strength.ok) {
        return sendError(res, strength.message || '密码不符合要求');
      }

      const result = await service.changePassword(user.id, String(old_password), String(new_password));
      res.json({ code: 200, data: result });
    } catch (error: any) {
      sendError(res, error?.message || '修改密码失败');
    }
  });

  app.use('/api/auth', authRouter);
  app.use('/api/captcha', captchaRouter);
}

function buildDisabledRouters(app: express.Express) {
  app.get('/api/auth/config', (_req, res) => {
    res.json({
      code: 200,
      data: { enabled: false }
    });
  });

  app.all('/api/auth/*', (_req, res) => {
    res.status(503).json({ code: 503, message: '认证未启用' });
  });

  app.all('/api/captcha/*', (_req, res) => {
    res.status(503).json({ code: 503, message: '认证未启用' });
  });
}

export async function setupAuthRoutes(app: express.Express, config: AuthConfig): Promise<void> {
  if (!config.enabled) {
    buildDisabledRouters(app);
    return;
  }

  await buildEnabledRouters(app, config);
}
