import 'dotenv/config';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from './app.module';
import { LiveWsHub } from './live/live-ws.hub';
import { attachLiveWebSocket } from './live/live-ws.bootstrap';
import { GlobalExceptionFilter } from './common/error.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  // CORS origins: production reads CORS_ORIGINS env (comma-separated),
  // dev defaults to localhost:3000.
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  // 【安全适配】注册 cookie-parser 中间件，用于读写 httpOnly refresh token cookie
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  const httpServer = app.getHttpServer();
  attachLiveWebSocket(httpServer, app.get(LiveWsHub), app.get(JwtService));
  console.log(`Echo API listening on http://localhost:${port}/v1`);
}

bootstrap();
