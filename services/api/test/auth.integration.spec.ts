/**
 * Auth integration tests (REQ-09).
 *
 * Verifies the register → login → JWT flow.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth Integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const testPhone = `+861380000${Math.floor(Math.random() * 10000)}`;
  const testPassword = 'test123456';

  it('should register a new user', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ phone: testPhone, password: testPassword })
      .expect(201);

    expect(res.body.access_token).toBeDefined();
    expect(res.body.user_id).toBeDefined();
  });

  it('should login with registered credentials and return JWT', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ phone: testPhone, password: testPassword })
      .expect(201);

    expect(res.body.access_token).toBeDefined();
    expect(typeof res.body.access_token).toBe('string');
    expect(res.body.access_token.length).toBeGreaterThan(20);
  });

  it('should reject login with wrong password', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ phone: testPhone, password: 'wrongpassword' })
      .expect(401);
  });

  it('should reject unauthenticated access to protected endpoint', async () => {
    await request(app.getHttpServer())
      .get('/v1/feed')
      .expect(401);
  });
});
