import test from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
import express from 'express';
import { createApp } from '../server.ts';
import { createRateLimiter, isPlainObject, sanitizeText } from '../server/middleware.ts';
import { formatLocalIsoDate } from '../server/seed.ts';

function listenOnEphemeralPort(app: express.Express): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

test('sanitizeText strips control characters and clamps length', () => {
  const dirty = '  Hello\x00\x07\nWorld\tTest  ';
  assert.equal(sanitizeText(dirty, 50), 'Hello World Test');
  assert.equal(sanitizeText('abcdefghij', 5), 'abcde');
  assert.equal(sanitizeText(12345, 10), '');
});

test('isPlainObject rejects arrays, primitives, and null', () => {
  assert.equal(isPlainObject({ ok: true }), true);
  assert.equal(isPlainObject([]), false);
  assert.equal(isPlainObject(null), false);
  assert.equal(isPlainObject('text'), false);
});

test('createRateLimiter enforces request ceiling and sets Retry-After', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 2 });
  let nextCalls = 0;
  let lastStatus = 200;
  const headers: Record<string, string> = {};

  const fakeReq = { ip: '10.0.0.1', baseUrl: '/api/ai', socket: {} } as unknown as express.Request;
  const fakeRes = {
    setHeader(name: string, val: string) {
      headers[name] = val;
    },
    status(code: number) {
      lastStatus = code;
      return { json: () => {} };
    },
  } as unknown as express.Response;

  limiter(fakeReq, fakeRes, () => {
    nextCalls += 1;
  });
  limiter(fakeReq, fakeRes, () => {
    nextCalls += 1;
  });
  limiter(fakeReq, fakeRes, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 2);
  assert.equal(lastStatus, 429);
  assert.ok(Number(headers['Retry-After']) >= 1);
});

test('Express API enforces security headers, input validation, booking lifecycle, and conflict semantics', async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevApiKey = process.env.GEMINI_API_KEY;
  process.env.NODE_ENV = 'production';
  const app = await createApp();
  const server = await listenOnEphemeralPort(app);
  const addr = server.address();
  assert.ok(addr && typeof addr === 'object');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(healthRes.headers.get('x-powered-by'), null);
    assert.equal(healthRes.headers.get('cache-control'), 'no-store');

    const badJsonRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"broken":',
    });
    assert.equal(badJsonRes.status, 400);

    const badIdRes = await fetch(`${baseUrl}/api/requests/..%2Fetc%2Fpasswd/decision`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'approve' }),
    });
    assert.equal(badIdRes.status, 400);

    const today = formatLocalIsoDate();
    const conflictRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stationId: 'cs-102',
        studentName: 'Test Student',
        studentDepartment: 'CS & AI',
        projectTitle: 'Peak Annex Collision Check',
        requiredSpecs: 'CUDA 12',
        projectDeadline: today,
        date: today,
        startHour: 14,
        endHour: 16,
        bayTrack: 'cross_dept_bay',
        seatsRequested: 2,
      }),
    });
    assert.equal(conflictRes.status, 409);

    const createRes = await fetch(`${baseUrl}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stationId: 'bio-204',
        studentName: 'Test Bio Researcher',
        studentDepartment: 'CS & AI',
        projectTitle: 'Cross-Dept Molecular Docking Run',
        requiredSpecs: 'CUDA, Python',
        projectDeadline: today,
        date: today,
        startHour: 14,
        endHour: 16,
        bayTrack: 'cross_dept_bay',
        seatsRequested: 1,
        safetyCleared: false,
      }),
    });
    assert.equal(createRes.status, 201);
    const createdData = (await createRes.json()) as { request: { id: string; status: string } };
    assert.equal(createdData.request.status, 'pending_faculty');

    const decisionRes = await fetch(
      `${baseUrl}/api/requests/${createdData.request.id}/decision`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'approve' }),
      }
    );
    assert.equal(decisionRes.status, 200);
    const decisionData = (await decisionRes.json()) as { request: { status: string } };
    assert.equal(decisionData.request.status, 'approved');

    delete process.env.GEMINI_API_KEY;
    const aiNoKeyRes = await fetch(`${baseUrl}/api/ai/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stationId: 'cs-102',
        studentDepartment: 'CS & AI',
        projectTitle: 'No Key Guard Check',
        requiredSpecs: 'CUDA',
      }),
    });
    assert.equal(aiNoKeyRes.status, 503);

    const resetRes = await fetch(`${baseUrl}/api/reset`, { method: 'POST' });
    assert.equal(resetRes.status, 200);
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    if (prevApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = prevApiKey;
    }
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
