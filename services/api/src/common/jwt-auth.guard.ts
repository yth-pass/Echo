import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      userId?: string;
    }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }
    const token = header.slice(7);
    try {
      const payload = this.jwt.verify<{ sub: string; typ?: string }>(token);
      if (payload.typ === 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }
      req.userId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
