import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';

import { initDatabase } from './db/init.ts';
import { createMiddleware, isLocalNetwork } from './routes/middleware.ts';
import { createSettingsHelpers } from './routes/settings.ts';
import { createSeedFunctions } from './routes/seed.ts';
import { createAuthRouter } from './routes/auth.ts';
import { createEncountersRouter } from './routes/encounters.ts';
import { createCampaignsRouter } from './routes/campaigns.ts';
import { createMonstersRouter } from './routes/monsters.ts';
import { createSoundsRouter } from './routes/sounds.ts';
import { createLightsRouter } from './routes/lights.ts';
import { createDndBeyondRouter } from './routes/dnd-beyond.ts';
import { createFoundryRouter } from './routes/foundry.ts';
import { createImagesRouter } from './routes/images.ts';
import { createBackupsRouter } from './routes/backups.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { db, dbAvailable } = initDatabase();

async function startServer() {
  const { ensureMonstersInDb, autoSeedIfEmpty, seedClassFeatures } = createSeedFunctions(db, dbAvailable);
  if (process.env.NODE_ENV !== 'test') await seedClassFeatures();

  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = process.env.NODE_ENV === 'test' ? 0 : 3000;

  app.use(express.json({ limit: '20mb' }));

  // Static file serving for uploads and local audio
  const soundsUploadDir = path.join(__dirname, 'uploads', 'sounds');
  if (!fs.existsSync(soundsUploadDir)) fs.mkdirSync(soundsUploadDir, { recursive: true });
  const portraitsUploadDir = path.join(__dirname, 'uploads', 'portraits');
  if (!fs.existsSync(portraitsUploadDir)) fs.mkdirSync(portraitsUploadDir, { recursive: true });
  app.use('/uploads/portraits', express.static(portraitsUploadDir));

  const localAudioDir = process.env.AUDIO_SFX_DIR ?? path.join(__dirname, 'data', 'tabletopaudio');
  const magicIconsDir = path.join(__dirname, 'data', 'magic');
  const foundryIconsDir = path.join(__dirname, 'data', 'foundry-icons');
  const ambiencesDir = process.env.AUDIO_AMBIENCES_DIR ?? path.join(__dirname, 'data', 'ambiences');

  app.use('/uploads/sounds', express.static(soundsUploadDir));
  if (fs.existsSync(localAudioDir)) app.use('/audio/local', express.static(localAudioDir));
  if (fs.existsSync(magicIconsDir)) app.use('/audio/local/magic', express.static(magicIconsDir));
  if (fs.existsSync(foundryIconsDir)) app.use('/foundry-icons', express.static(foundryIconsDir));
  if (fs.existsSync(ambiencesDir)) app.use('/audio/ambiences', express.static(ambiencesDir));

  // Session middleware — shared with Socket.IO so socket handlers can read session data
  const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET ?? (process.env.NODE_ENV === 'production'
      ? (() => { throw new Error('SESSION_SECRET env var is required in production'); })()
      : 'dev-only-insecure-secret'),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 },
  });
  app.use(sessionMiddleware);
  io.engine.use(sessionMiddleware);

  // Settings helpers + env seeding
  const { getSetting, setSetting } = createSettingsHelpers(db, dbAvailable);
  const ENV_SETTING_MAP: Record<string, string> = {
    HUE_BRIDGE_IP: 'hue_bridge_ip', HUE_USERNAME: 'hue_username',
    HA_URL: 'ha_url', HA_TOKEN: 'ha_token',
  };
  for (const [envKey, settingKey] of Object.entries(ENV_SETTING_MAP)) {
    const envVal = process.env[envKey];
    if (envVal && !getSetting(settingKey)) {
      setSetting(settingKey, envVal);
      console.log(`[config] Seeded ${settingKey} from env ${envKey}`);
    }
  }

  // Auth middleware
  const { requireAuth, requireAdmin } = createMiddleware(db, dbAvailable);

  // Auth + user routes (must be mounted BEFORE the global requireAuth middleware)
  app.use('/api', createAuthRouter(db, dbAvailable, requireAdmin));

  // Global API auth guard
  app.use('/api', requireAuth);
  app.use('/api', createBackupsRouter(db, dbAvailable, requireAdmin));

  // Socket.IO — join rooms for per-encounter real-time updates
  io.on('connection', (socket) => {
    socket.on('join-encounter', (encounterId) => socket.join(`encounter:${encounterId}`));
    socket.on('leave-encounter', (encounterId) => socket.leave(`encounter:${encounterId}`));
    socket.on('dm-log-sync', ({ encounterId, show, entries }: { encounterId: string; show: boolean; entries: unknown[] }) => {
      const socketIp = socket.handshake.address;
      const session = (socket.request as any).session;
      const authed = isLocalNetwork(socketIp) || (session?.userId && session?.role === 'admin');
      if (!authed) return;
      io.to(`encounter:${encounterId}`).emit('player-log-updated', { show, entries });
    });
  });

  // Domain routers
  app.use('/api', createEncountersRouter(db, dbAvailable, io));
  app.use('/api', createCampaignsRouter(db, dbAvailable));
  app.use('/api', createMonstersRouter(db, dbAvailable, requireAdmin));
  const { router: soundsRouter } = createSoundsRouter(db, dbAvailable, localAudioDir, ambiencesDir);
  app.use('/api', soundsRouter);
  app.use('/api', createLightsRouter(getSetting, setSetting, db));
  app.use('/api', createDndBeyondRouter(db, dbAvailable, ensureMonstersInDb));
  app.use('/api', createFoundryRouter(portraitsUploadDir));
  app.use('/api', createImagesRouter());

  // Frontend (Vite dev or static production build)
  if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  httpServer.listen(PORT, process.env.NODE_ENV === 'test' ? '127.0.0.1' : '0.0.0.0', async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Auto-update monsters every 24 hours or if first time
    const { getSetting, setSetting } = createSettingsHelpers(db, dbAvailable);
    const lastUpdate = getSetting('last_monster_update');
    const now = Date.now();
    const shouldUpdate = !lastUpdate || (now - parseInt(lastUpdate)) > 24 * 60 * 60 * 1000;

    if (shouldUpdate && process.env.NODE_ENV !== 'test') {
      console.log('[update] Running monster data update...');
      const { fork } = await import('child_process');
      const child = fork(path.join(__dirname, 'scripts/update-monsters.ts'), [], {
        env: { ...process.env, DB_PATH: process.env.DB_PATH ?? path.join(__dirname, 'data', 'dnd_tracker.db') },
        execArgv: ['--import', 'tsx']
      });
      child.on('exit', (code) => {
        if (code === 0) {
          setSetting('last_monster_update', String(now));
          console.log('[update] Monster data update complete.');
        } else {
          console.error(`[update] Monster data update failed with code ${code}`);
        }
      });
    }

    autoSeedIfEmpty().catch(e => console.error('[seed] Error:', e));
  });

  return { app, httpServer };
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { startServer };
