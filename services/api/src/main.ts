import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from './app.module';
import { LiveWsHub } from './live/live-ws.hub';
import { attachLiveWebSocket } from './live/live-ws.bootstrap';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('v1');
  app.enableCors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  const httpServer = app.getHttpServer();
  attachLiveWebSocket(httpServer, app.get(LiveWsHub), app.get(JwtService));
  console.log(`Echo API listening on http://localhost:${port}/v1`);
}

bootstrap();
