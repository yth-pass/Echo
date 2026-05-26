import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto, OtpDto, RefreshDto, RegisterDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.phone);
  }

  @Post('otp')
  otp(@Body() dto: OtpDto) {
    return this.auth.sendOtp(dto.phone);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.phone, dto.code);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() userId: string) {
    return this.auth.me(userId);
  }
}
