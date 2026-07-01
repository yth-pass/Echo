import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto, OtpDto, RefreshDto, RegisterDto } from './auth.dto';
import type { Request, Response } from 'express';

// 【安全适配·任务1】refresh token cookie 名称与统一配置
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const isProd = process.env.NODE_ENV === 'production';
const sameSite = (process.env.COOKIE_SAME_SITE ?? (isProd ? 'none' : 'strict')) as
  | 'strict'
  | 'lax'
  | 'none';
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true, // 禁止 JS 读取，防 XSS 窃取
  secure: isProd || sameSite === 'none', // SameSite=None 必须 Secure
  sameSite, // 跨域生产环境走 'none'，本地开发走 'strict'
  path: '/v1/auth', // 限制 cookie 仅在 auth 接口发送
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天，与 JWT_REFRESH_TTL 一致
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // 【安全适配·任务1】refresh token 通过 httpOnly cookie 下发，不再出现在 JSON body
    const tokens = await this.auth.registerWithPassword(dto);
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    return this.auth.toSnakeAuthResponse(tokens);
  }

  // 【缺陷2 修复】/auth/otp 限流：每分钟最多 3 次发送
  @Post('otp')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  otp(@Body() dto: OtpDto) {
    return this.auth.sendOtp(dto.phone);
  }

  // 【缺陷2 修复】/auth/login 限流：每分钟最多 5 次登录尝试
  @Post('login')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    let tokens;
    if (dto.password) {
      const identifier = dto.identifier ?? dto.phone;
      if (!identifier) {
        throw new BadRequestException('identifier or phone required for password login');
      }
      tokens = await this.auth.loginWithPassword(identifier, dto.password);
    } else if (dto.code && dto.phone) {
      tokens = await this.auth.loginWithOtp(dto.phone, dto.code);
    } else {
      throw new BadRequestException('Provide password or OTP code');
    }
    // 【安全适配·任务1】登录成功后下发 httpOnly refresh token cookie
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    return this.auth.toSnakeAuthResponse(tokens);
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: RefreshDto,
  ) {
    // 【安全适配·任务1】优先从 httpOnly cookie 读取 refresh token，
    // 兼容旧客户端的 body.refreshToken（cookie 优先）
    const cookieRefreshToken = req.cookies?.refresh_token as string | undefined;
    const refreshToken = cookieRefreshToken ?? dto.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }
    const tokens = await this.auth.refresh(refreshToken);
    // 【安全适配·任务1】刷新成功后重新下发 cookie（rotation），延长 maxAge
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, REFRESH_COOKIE_OPTIONS);
    return this.auth.toSnakeAuthResponse(tokens);
  }

  // 【缺陷7 修复】logout 接口：将当前 access token 加入黑名单
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @Body() body: { access_token?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.logout(body.access_token ?? '');
    // 【安全适配·任务1】登出时清除 refresh token cookie
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/v1/auth' });
    return result;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() userId: string) {
    return this.auth.me(userId);
  }
}
