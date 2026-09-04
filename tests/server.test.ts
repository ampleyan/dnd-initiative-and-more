import { afterEach, expect, it, vi } from 'vitest';

const vite = vi.hoisted(() => ({
  createViteServer: vi.fn(),
}));

vi.mock('vite', () => vite);

import { startServer } from '../server';

let httpServer: Awaited<ReturnType<typeof startServer>>['httpServer'] | undefined;

afterEach(async () => {
  await new Promise<void>(resolve => httpServer?.close(() => resolve()) ?? resolve());
  httpServer = undefined;
});

it('does not initialize Vite middleware in the test runtime', async () => {
  ({ httpServer } = await startServer());

  expect(vite.createViteServer).not.toHaveBeenCalled();
});
