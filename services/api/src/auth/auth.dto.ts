import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(11)
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}

export class OtpDto {
  @IsString()
  @MinLength(11)
  phone!: string;
}

export class LoginDto {
  @ValidateIf((o: LoginDto) => !!o.code)
  @IsString()
  @MinLength(11)
  phone?: string;

  @ValidateIf((o: LoginDto) => !!o.password)
  @IsString()
  identifier?: string;

  @ValidateIf((o: LoginDto) => !o.password)
  @IsString()
  @MinLength(4)
  code?: string;

  @ValidateIf((o: LoginDto) => !o.code)
  @IsString()
  @MinLength(8)
  password?: string;
}

export class RefreshDto {
  // 【安全适配】refresh token 改走 httpOnly cookie，body 中 refreshToken 仅作旧客户端兼容（优先读 cookie）
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
