import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../redis/redis.service';

/**
 * JWT 黑名单内存缓存
 *
 * 每次认证请求都查 Redis 太浪费（Upstash 免费层 50 万次限额）。
 * 黑名单几乎永远为空（仅 logout 时写入），所以缓存 60 秒的「未拉黑」结果，
 * 缓存命中时完全跳过 Redis，可节省 ~15-20% 的 Redis 请求。
 */
const blacklistCache = new Map<string, { blocked: boolean; expiresAt: number }>();
const NEGATIVE_CACHE_TTL_MS = 60_000; // 「未拉黑」缓存 60 秒

function isCacheValid(jti: string, now: number): boolean | null {
  const entry = blacklistCache.get(jti);
  if (!entry || entry.expiresAt <= now) {
    blacklistCache.delete(jti);
    return null; // miss
  }
  return entry.blocked;
}

// 【缺陷7 修复】JwtAuthGuard 校验时查 Redis 黑名单，命中则拒绝
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      userId?: string;
      jti?: string;
    }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = header.slice(7);
    try {
      const payload = this.jwt.verify<{ sub: string; typ?: string; jti?: string }>(token);
      if (payload.typ === 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const bypassRedis = process.env.BYPASS_REDIS === 'true';

      // 【缺陷7 修复】检查 jti 是否在黑名单中（优先查内存缓存）
      if (!bypassRedis && payload.jti) {
        const now = Date.now();
        const cached = isCacheValid(payload.jti, now);

        if (cached === true) {
          throw new UnauthorizedException('Token revoked');
        }

        if (cached === null) {
          // 缓存未命中，查 Redis
          const blocked = await this.redis.client.get(`jwt:blacklist:${payload.jti}`);
          if (blocked) {
            blacklistCache.set(payload.jti, { blocked: true, expiresAt: Infinity });
            throw new UnauthorizedException('Token revoked');
          }
          // 未拉黑 → 缓存 60 秒，避免重复查 Redis
          blacklistCache.set(payload.jti, {
            blocked: false,
            expiresAt: now + NEGATIVE_CACHE_TTL_MS,
          });
        }
      }

      req.userId = payload.sub;
      req.jti = payload.jti;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
