import { Router } from 'express';

export function createCampaignsRouter(db: any, dbAvailable: boolean) {
  const router = Router();

  router.get('/campaigns', (req, res) => {
    if (!dbAvailable) return res.json([]);
    res.json(db.prepare(`
      SELECT c.*, COALESCE(s.sessionCount, 0) as sessionCount
      FROM campaigns c
      LEFT JOIN (SELECT campaignId, COUNT(*) as sessionCount FROM sessions GROUP BY campaignId) s ON s.campaignId = c.id
      ORDER BY c.createdAt DESC
    `).all());
  });

  router.post('/campaigns', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false, message: 'DB not available' });
    const { id, name, description, mapImage } = req.body as { id: string; name: string; description?: string; mapImage?: string };
    if (!id || !name) return res.status(400).json({ error: 'id and name required' });
    db.prepare('INSERT INTO campaigns (id, name, description, mapImage) VALUES (?, ?, ?, ?)').run(id, name, description ?? '', mapImage ?? '');
    res.status(201).json({ id, name });
  });

  router.put('/campaigns/:id', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false });
    const existing = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { name = existing.name, description = existing.description, mapImage = existing.mapImage } = req.body;
    db.prepare('UPDATE campaigns SET name = ?, description = ?, mapImage = ? WHERE id = ?').run(name, description, mapImage, req.params.id);
    res.json({ success: true });
  });

  router.delete('/campaigns/:id', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false });
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  router.get('/campaigns/:campaignId/sessions', (req, res) => {
    if (!dbAvailable) return res.json([]);
    res.json(db.prepare('SELECT * FROM sessions WHERE campaignId = ? ORDER BY createdAt DESC').all(req.params.campaignId));
  });

  router.post('/campaigns/:campaignId/sessions', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false });
    const { id, name, date, notes } = req.body as { id: string; name: string; date?: string; notes?: string };
    if (!id || !name) return res.status(400).json({ error: 'id and name required' });
    db.prepare('INSERT INTO sessions (id, campaignId, name, date, notes) VALUES (?, ?, ?, ?, ?)').run(id, req.params.campaignId, name, date ?? '', notes ?? '');
    res.status(201).json({ id, name });
  });

  router.put('/sessions/:id', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false });
    const existing = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { name = existing.name, date = existing.date, notes = existing.notes } = req.body;
    db.prepare('UPDATE sessions SET name = ?, date = ?, notes = ? WHERE id = ?').run(name, date, notes, req.params.id);
    res.json({ success: true });
  });

  router.delete('/sessions/:id', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ success: false });
    db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  return router;
}
