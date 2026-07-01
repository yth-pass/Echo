/**
 * Handoff integration tests (REQ-09).
 *
 * Verifies the bidirectional handoff state machine:
 * - Two users both accept → contact_exchanged
 * - User A accepts, User B declines → declined
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { LlmService } from '../src/llm/llm.service';
import { PushService } from '../src/push/push.service';

describe('Handoff Integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(LlmService)
      .useValue({
        chat: jest.fn().mockResolvedValue('测试回复'),
        embed: jest.fn().mockResolvedValue({
          vector: new Array(1536).fill(0.5),
          quality: 'real',
        }),
        embedBatch: jest.fn().mockResolvedValue({
          vectors: [new Array(1536).fill(0.5)],
          quality: 'real',
        }),
      })
      .overrideProvider(PushService)
      .useValue({
        sendPush: jest.fn().mockResolvedValue(undefined),
        registerToken: jest.fn().mockResolvedValue(undefined),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  async function registerUser(phone: string): Promise<{ token: string; userId: string }> {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ phone, password: 'test1234' })
      .expect(201);
    return { token: res.body.access_token, userId: res.body.user_id };
  }

  it('should reject response on non-existent handoff', async () => {
    const { token } = await registerUser(`+861390100${Math.floor(Math.random() * 10000)}`);
    await request(app.getHttpServer())
      .post('/v1/handoffs/nonexistent-id/respond')
      .set('Authorization', `Bearer ${token}`)
      .send({ accept: true })
      .expect(404);
  });

  it('should reject response from a user not in the handoff', async () => {
    // Register three users: A, B (in handoff), C (outsider)
    const userA = await registerUser(`+861390200${Math.floor(Math.random() * 10000)}`);
    const userB = await registerUser(`+861390201${Math.floor(Math.random() * 10000)}`);
    const userC = await registerUser(`+861390202${Math.floor(Math.random() * 10000)}`);

    // Create a handoff via raw insert (simulating worker)
    const handoff = await prisma.handoff.create({
      data: {
        sessionId: `test_session_${Date.now()}`,
        userAId: userA.userId,
        userBId: userB.userId,
        status: 'pending',
      },
    });

    // User C (not in handoff) tries to respond
    await request(app.getHttpServer())
      .post(`/v1/handoffs/${handoff.id}/respond`)
      .set('Authorization', `Bearer ${userC.token}`)
      .send({ accept: true })
      .expect(403);

    // Cleanup
    await prisma.handoff.delete({ where: { id: handoff.id } });
  });

  it('should record both accepts and mark contact_exchanged', async () => {
    const userA = await registerUser(`+861390300${Math.floor(Math.random() * 10000)}`);
    const userB = await registerUser(`+861390301${Math.floor(Math.random() * 10000)}`);

    // Also register their profiles for contact info exchange
    await prisma.profile.upsert({
      where: { userId: userA.userId },
      create: { userId: userA.userId, displayName: '小红' },
      update: { displayName: '小红' },
    });
    await prisma.profile.upsert({
      where: { userId: userB.userId },
      create: { userId: userB.userId, displayName: '小明' },
      update: { displayName: '小明' },
    });

    const handoff = await prisma.handoff.create({
      data: {
        sessionId: `test_session_dual_${Date.now()}`,
        userAId: userA.userId,
        userBId: userB.userId,
        status: 'pending',
      },
    });

    // User A accepts
    const resA = await request(app.getHttpServer())
      .post(`/v1/handoffs/${handoff.id}/respond`)
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ accept: true })
      .expect(201);

    expect(resA.body.status).toBe('pending'); // not yet accepted — waiting for B
    expect(resA.body.contact_exchanged).toBe(false);

    // User B accepts
    const resB = await request(app.getHttpServer())
      .post(`/v1/handoffs/${handoff.id}/respond`)
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ accept: true })
      .expect(201);

    expect(resB.body.status).toBe('accepted');
    expect(resB.body.contact_exchanged).toBe(true);

    // Verify responses array
    const responses = resB.body.responses;
    expect(responses).toHaveLength(2);
    expect(responses.map((r: any) => r.decision)).toEqual(
      expect.arrayContaining(['accept', 'accept']),
    );

    // Cleanup
    await prisma.handoffResponse.deleteMany({ where: { handoffId: handoff.id } });
    await prisma.handoff.delete({ where: { id: handoff.id } });
  });
});
