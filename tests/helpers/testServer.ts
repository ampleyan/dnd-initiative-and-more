import { startServer } from '../../server';
import supertest from 'supertest';

let app: any;
let httpServer: any;

export async function setupTestServer() {
  const result = await startServer();
  app = result.app;
  httpServer = result.httpServer;
  return { app, httpServer, request: supertest(app) };
}

export async function teardownTestServer() {
  await new Promise<void>(resolve => httpServer?.close(() => resolve()));
}

/** Returns a supertest agent logged in as admin. */
export async function loginAdmin() {
  const agent = supertest.agent(app);
  // The test server seeds an admin with ADMIN_PASSWORD env var or a random pass.
  // We set ADMIN_PASSWORD in tests/setup.ts so we know the password.
  const res = await agent
    .post('/api/auth/login')
    .send({ username: 'admin', password: process.env.ADMIN_PASSWORD! });
  if (res.status !== 200) {
    throw new Error(`Admin login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}

/** Returns a supertest agent logged in as a regular user. */
export async function loginUser(username: string, password: string) {
  const agent = supertest.agent(app);
  const res = await agent.post('/api/auth/login').send({ username, password });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${username}: ${res.status}`);
  }
  return agent;
}
