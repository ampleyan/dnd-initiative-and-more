import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { isLocalNetwork, LOCAL_USER } from './middleware.ts';
import type { RequestHandler } from 'express';

export function createAuthRouter(
  db: any,
  dbAvailable: boolean,
  requireAdmin: RequestHandler,
) {
  const router = Router();

  router.post('/auth/login', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ error: 'DB not available' });
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    (req.session as any).userId = user.id;
    res.json({ id: user.id, username: user.username, role: user.role });
  });

  router.post('/auth/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  router.get('/auth/me', (req, res) => {
    if (isLocalNetwork(req.ip ?? '')) return res.json(LOCAL_USER);
    if (!dbAvailable || !(req.session as any).userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get((req.session as any).userId) as any;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    res.json(user);
  });

  // User management (admin only) — registered before the global requireAuth middleware, so we enforce here
  router.get('/users', requireAdmin, (req, res) => {
    const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at ASC').all();
    res.json(users);
  });

  router.post('/users', requireAdmin, (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(409).json({ error: 'Username already exists' });
    const hash = bcrypt.hashSync(password, 10);
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(id, username, hash, role || 'user');
    res.json({ id, username, role: role || 'user' });
  });

  router.delete('/users/:id', requireAdmin, (req, res) => {
    if ((req.session as any).userId === req.params.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  return router;
}
