import { IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(11)
  phone!: string;
}

export class OtpDto {
  @IsString()
  @MinLength(11)
  phone!: string;
}

export class LoginDto {
  @IsString()
  @MinLength(11)
  phone!: string;

  @IsString()
  @MinLength(4)
  code!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
