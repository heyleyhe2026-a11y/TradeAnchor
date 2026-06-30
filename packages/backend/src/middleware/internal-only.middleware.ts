import { Request, Response, NextFunction } from 'express';

function normalizeIp(ip: string): string {
  return ip.replace(/^::ffff:/, '');
}

function isPrivateIp(ip: string): boolean {
  const normalized = normalizeIp(ip);
  if (!normalized) return false;
  if (normalized === '127.0.0.1' || normalized === '::1') return true;

  const parts = normalized.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;

  return false;
}

/**
 * Restrict route to private networks or a valid METRICS_TOKEN bearer.
 * Returns 404 in production to avoid revealing the endpoint exists.
 */
export function restrictInternalAccess(req: Request, res: Response, next: NextFunction): void {
  const metricsToken = process.env.METRICS_TOKEN;
  if (metricsToken) {
    const auth = req.headers.authorization;
    if (auth === `Bearer ${metricsToken}`) {
      next();
      return;
    }
  }

  const clientIp = normalizeIp(req.ip || req.socket.remoteAddress || '');
  if (isPrivateIp(clientIp)) {
    next();
    return;
  }

  res.status(404).json({ success: false, message: 'Not found' });
}
