import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';

export const LOCAL_USER = { id: 'local', username: 'Local User', role: 'admin' as const };

export function lanAuthBypassEnabled(): boolean {
  return process.env.DISABLE_LAN_AUTH_BYPASS !== 'true';
}

export function isLocalNetwork(ip: string): boolean {
  const addr = ip.replace(/^::ffff:/, '');
  if (addr === '127.0.0.1' || addr === '::1' || addr === 'localhost') return true;
  if (/^10\./.test(addr)) return true;
  const m = addr.match(/^172\.(\d+)\./);
  if (m && parseInt(m[1]) >= 16 && parseInt(m[1]) <= 31) return true;
  if (/^192\.168\./.test(addr)) return true;
  return false;
}

export function createMiddleware(db: any, dbAvailable: boolean) {
  function requireAuth(req: Request, res: Response, next: NextFunction) {
    if (lanAuthBypassEnabled() && isLocalNetwork(req.ip ?? '')) return next();
    if (!dbAvailable || !(req.session as any).userId) return res.status(401).json({ error: 'Unauthorized' });
    next();
  }

  function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (lanAuthBypassEnabled() && isLocalNetwork(req.ip ?? '')) return next();
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get((req.session as any).userId) as any;
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
  }

  return { requireAuth, requireAdmin };
}
