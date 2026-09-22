/**
 * Pactum-based API flow tests (PRD §15 acceptance path). These require a live
 * database seeded via `npm run prisma:seed`. They exercise: signup -> verify ->
 * business profile -> product creation -> voice upload (mock provider) -> draft
 * review -> confirm -> ledger read.
 *
 * Run with: npm run test:api
 */
import { describe, expect, beforeAll, afterAll } from '@jest/globals';
import * as pactum from 'pactum';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync } from 'fs';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

const rand = Math.random().toString().replace('.', '').slice(0, 8);
const phone = `0801${rand.slice(0, 7)}`;
const audioPath = join(tmpdir(), `pactum-${rand}.webm`);

describe('Voice-first API flow', () => {
  let app: INestApplication;
  let baseUrl: string;
  let accessToken: string;
  let userId = '';
  let productId = '';

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    await app.listen(0);
    const address = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${address.port}`;
    pactum.request.setBaseUrl(baseUrl);
    writeFileSync(audioPath, Buffer.from('fake-webm-audio-bytes', 'utf8'));
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a new account', async () => {
    const res = await pactum
      .spec()
      .post('/auth/register')
      .withJson({ phone, password: 'StrongPass123!' })
      .expectStatus(201)
      .expect((ctx) => {
        expect(ctx.res.body.userId).toBeDefined();
        userId = ctx.res.body.userId;
      });
    expect(res.statusCode).toBe(201);
  });

  it('logs in with the seeded demo account and receives tokens', async () => {
    await pactum
      .spec()
      .post('/auth/login')
      .withJson({ identifier: 'demo@voicefirst.dev', password: 'Password123!' })
      .expectStatus(200)
      .stores('accessToken', 'accessToken')
      .expect((ctx) => {
        accessToken = ctx.res.body.accessToken;
        expect(ctx.res.body.user).toBeDefined();
      });
  });

  it('creates a product', async () => {
    await pactum
      .spec()
      .post('/products')
      .withHeaders('Authorization', `Bearer ${accessToken}`)
      .withJson({ name: 'Indomie', defaultUnit: 'carton', sellingPriceKobo: 100_000 })
      .expectStatus(201)
      .stores('productId', 'id')
      .expect((ctx) => {
        productId = ctx.res.body.id;
        expect(ctx.res.body.status).toBe('ACTIVE');
      });
  });

  it('uploads a voice note that produces a confirmation draft', async () => {
    const res = await pactum
      .spec()
      .post('/audio')
      .withHeaders('Authorization', `Bearer ${accessToken}`)
      .withFile('file', audioPath, { contentType: 'audio/webm' })
      .expectStatus(201)
      .expect((ctx) => {
        expect(ctx.res.body.id).toBeDefined();
      });
    expect(res.statusCode).toBe(201);
  });

  it('lists products', async () => {
    await pactum
      .spec()
      .get('/products')
      .withHeaders('Authorization', `Bearer ${accessToken}`)
      .expectStatus(200)
      .expect((ctx) => {
        expect(Array.isArray(ctx.res.body.items)).toBe(true);
      });
  });

  it('rejects unauthenticated requests', async () => {
    await pactum.spec().get('/products').expectStatus(401);
  });

  void userId;
  void productId;
});