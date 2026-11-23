import type { NextFunction, Request, Response } from 'express';

const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/g;

export function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(CONTROL_CHARS_RE, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
}

export function jsonSyntaxErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof SyntaxError && typeof err === 'object' && err !== null && 'body' in err) {
    res.status(400).json({ error: 'Invalid JSON request payload.' });
    return;
  }
  next(err);
}

interface RateBucket {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  maxBuckets?: number;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const buckets = new Map<string, RateBucket>();
  const maxBuckets = options.maxBuckets ?? 2000;

  return function rateLimiter(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${clientIp}:${req.baseUrl}`;

    if (buckets.size >= maxBuckets) {
      for (const [k, b] of buckets.entries()) {
        if (b.resetAt <= now) {
          buckets.delete(k);
        }
      }
      if (buckets.size >= maxBuckets) {
        buckets.clear();
      }
    }

    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    existing.count += 1;
    if (existing.count > options.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: `Too many requests. Please retry in ${retryAfterSec} seconds.`,
      });
      return;
    }

    next();
  };
}
