import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { spawn } from 'child_process';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type SoundImport = {
  id: string;
  name: string;
  url: string;
  category: string;
  tags: string[];
  volume: number;
  pack?: string;
  sourceType?: string;
  sourceReference?: string;
  storageType?: string;
  filePath?: string;
  duration?: number;
  fileSize?: number;
  checksum?: string;
  license?: string;
};

type FoundrySound = {
  id: string;
  name: string;
  path: string;
  volume?: number;
  playlist?: string;
};

export function insertSounds(db: any, sounds: SoundImport[]) {
  const insert = db.prepare(`INSERT OR IGNORE INTO sounds (id, name, url, category, tags, spellId, volume, sourceType, sourceReference, storageType, filePath, duration, fileSize, checksum, license) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  let inserted = 0;
  db.transaction(() => {
    for (const sound of sounds) {
      inserted += insert.run(sound.id, sound.name, sound.url, sound.category, JSON.stringify(sound.tags), sound.volume, sound.sourceType ?? null, sound.sourceReference ?? null, sound.storageType ?? null, sound.filePath ?? null, sound.duration ?? null, sound.fileSize ?? null, sound.checksum ?? null, sound.license ?? null).changes;
    }
  })();
  return { inserted, skipped: sounds.length - inserted };
}

const COMBAT_TAGS  = new Set(['combat','battle','fight','war','raid','boss','epic','clash','heroic','action','siege','army']);
const MAGIC_TAGS   = new Set(['magic','ethereal','astral','ritual','mystical','arcane','divine','ghost','strange','void','spooky','enchanted','necromancer','ominous']);
const NATURE_TAGS  = new Set(['forest','rain','wind','ocean','cave','underwater','storm','desert','jungle','wilderness','woods','birds','insects','snow','cold','sea','winter','trees','breeze']);

function classifyTrack(tags: string[]): string {
  const t = new Set(tags.map(s => s.toLowerCase()));
  if ([...COMBAT_TAGS].some(c => t.has(c))) return 'combat';
  if ([...MAGIC_TAGS].some(c => t.has(c))) return 'magic';
  if ([...NATURE_TAGS].some(c => t.has(c))) return 'nature';
  return 'ambient';
}

let cachedLibrary: any[] | null = null;

async function fetchTabletopAudioLibrary(): Promise<any[]> {
  if (cachedLibrary) return cachedLibrary;
  const YAML_URL = 'https://raw.githubusercontent.com/rsek/tabletop-audio-tracks/master/tabletop-audio-tracks.yaml';
  const res = await fetch(YAML_URL);
  if (!res.ok) throw new Error(`Failed to fetch track list: HTTP ${res.status}`);
  const text = await res.text();
  const data = yaml.load(text) as { tracks: any[] };
  cachedLibrary = (data?.tracks ?? []).map(t => ({
    id: t['$id'],
    name: t.title,
    description: t.description ?? '',
    category: classifyTrack(t.tags ?? []),
    tags: t.tags ?? [],
    volume: 0.6,
    url: `/api/sound-proxy?url=${encodeURIComponent(t.src)}`,
    sourceType: 'tabletopaudio',
    sourceReference: t['$id'],
    storageType: 'proxied-stream',
    license: 'CC-BY-NC-ND',
  }));
  return cachedLibrary;
}

const FOLDER_CATEGORY: Record<string, string> = {
  'combat soundpad': 'combat', 'combat_siege_soundpad': 'combat', 'combat future soundpad': 'combat',
  'monster pack soundpad': 'combat', 'vikings soundpad patreon': 'combat', 'wuxia soundpad': 'combat',
  'dungeon soundpad': 'ambient', 'tavern soundpad': 'ambient', 'olde towne soundpad': 'ambient',
  'castle raven soundpad': 'ambient', 'sanctum soundpad': 'ambient', 'bleakwater docks soundpad': 'ambient',
  'film_noir_soundpad': 'ambient', 'house on the hill soundpad': 'ambient', 'age of sail soundpad': 'ambient',
  'dark forest soundpad': 'nature', 'ice planet soundpad': 'nature', 'jungle planet soundpad': 'nature',
  'desert planet soundpad': 'nature', 'wasteland soundpad': 'nature', 'deep six soundpad': 'nature',
  'cthulhu soundpad patreon version': 'magic', 'vampire soundpad': 'magic', 'weirder things soundpad': 'magic',
  'ancient greece soundpad': 'magic', 'atlantis soundpad patreon': 'magic', 'sanctum soundpad patreon': 'magic',
  'starship soundpad': 'ambient', 'future city soundpad': 'ambient', 'secret agent patreon': 'ambient',
  'true west soundpad': 'nature',
};

function classifyFolder(folderName: string): string {
  return FOLDER_CATEGORY[folderName.toLowerCase()] ?? 'custom';
}

function prettifyFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '').replace(/^[^-]+-/, '').replace(/[_-]+/g, ' ')
    .replace(/\bloop\b/gi, '').replace(/\s+/g, ' ').trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

const AMBIENCE_GENRES: Record<string, string> = {
  'Barghest Fell': 'Wilderness', 'Battle Stations': 'Sci-Fi', 'Boiler Room': 'Urban',
  'Crimson Haboob': 'Desert', 'Dedication Day': 'Celebration', 'Docks Noir': 'Urban',
  'Drow Slave Camp': 'Dungeon', 'Frost Giant Ridge': 'Wilderness', 'Gravedigger': 'Horror',
  'High Alert': 'Battle', 'Ice Harvester Station': 'Sci-Fi', 'Ice Mephit Cavern': 'Dungeon',
  'Kingdom of Mist': 'Mystical', 'Lady of the Wood': 'Forest', 'Lifeboat': 'Naval',
  'Light the Beacons': 'Battle', 'Lost Contact': 'Sci-Fi', 'Manor Dark': 'Horror',
  'Maturation Chamber': 'Sci-Fi', 'Monsoon Temple': 'Exotic', 'News from the Front': 'Battle',
  'Petrified Forest': 'Wilderness', "Pharaoh's Chamber": 'Dungeon', 'Prison Block': 'Urban',
  'Prisoner Transport': 'Urban', 'Privy Council': 'Court', 'Ravaged Lands': 'Wilderness',
  'Ready the Castle': 'Castle', 'Red Dragon Dawn': 'Battle', 'Sentient Eye': 'Sci-Fi',
  'Steampunk Telescope': 'Steampunk', 'Stone Barrow': 'Dungeon', 'The Crown Road': 'Travel',
  'The Threshing Hour': 'Rural', 'Upriver Recon': 'Travel', 'Urban Rooftop': 'Urban',
  'Village Festival': 'Celebration', 'Village Raid': 'Battle', 'Visitation': 'Mystical',
  'War Wagon': 'Battle', "Winter's Veil": 'Winter', "Witches' Dance": 'Horror',
};

const AMBIENCE_GENRE_TO_CATEGORY: Record<string, string> = {
  'Dungeon': 'ambient', 'Wilderness': 'nature', 'Forest': 'nature', 'Battle': 'combat',
  'Urban': 'ambient', 'Desert': 'nature', 'Horror': 'magic', 'Sci-Fi': 'ambient',
  'Naval': 'nature', 'Exotic': 'ambient', 'Court': 'ambient', 'Mystical': 'magic',
  'Castle': 'ambient', 'Travel': 'nature', 'Rural': 'nature', 'Winter': 'nature',
  'Steampunk': 'ambient', 'Celebration': 'ambient',
};

function classifyAmbience(name: string): string {
  if (AMBIENCE_GENRES[name]) return AMBIENCE_GENRES[name];
  const n = name.toLowerCase();
  if (/dungeon|cave|barrow|crypt|tomb|cavern|prison|slave/i.test(n)) return 'Dungeon';
  if (/battle|war|raid|siege|combat|alert|beacons|front/i.test(n)) return 'Battle';
  if (/forest|wood|wild|fell|ridge|moor|glade|grove|mountain|vale|recon/i.test(n)) return 'Wilderness';
  if (/city|town|village|urban|rooftop|docks|noir|boiler/i.test(n)) return 'Urban';
  if (/desert|haboob|pharaoh|pyramid|temple|monsoon/i.test(n)) return 'Exotic';
  if (/ghost|witch|dark|horror|manor|grave|mist|haunted/i.test(n)) return 'Horror';
  if (/station|sci|mech|android|cyber|robot|alien|contact|sentinel|maturation/i.test(n)) return 'Sci-Fi';
  if (/sea|ocean|ship|boat|naval|water|river/i.test(n)) return 'Travel';
  if (/festival|celebration|ceremony|council|dedication/i.test(n)) return 'Celebration';
  if (/winter|snow|ice|frost|blizzard|cold|frozen/i.test(n)) return 'Winter';
  return 'Adventure';
}

export function createSoundsRouter(
  db: any,
  dbAvailable: boolean,
  localAudioDir: string,
  ambiencesDir: string,
  soundsUploadDirOverride?: string,
  getFoundryRoot: () => string = () => '',
  getFoundrySounds: (world: string) => Promise<FoundrySound[]> = async () => [],
) {
  const router = Router();

  const soundsUploadDir = soundsUploadDirOverride ?? path.join(__dirname, '..', 'uploads', 'sounds');
  if (!fs.existsSync(soundsUploadDir)) fs.mkdirSync(soundsUploadDir, { recursive: true });
  const soundStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, soundsUploadDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  });
  const soundUpload = multer({
    storage: soundStorage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (/^audio\//.test(file.mimetype)) return cb(null, true);
      cb(new Error('Only audio files are allowed'));
    },
  });

  router.get('/sounds', (req, res) => {
    if (!dbAvailable) return res.json([]);
    const rows = db.prepare('SELECT * FROM sounds ORDER BY createdAt ASC').all() as any[];
    res.json(rows.map((r: any) => ({ ...r, isFavorite: r.isFavorite ?? 0, tags: (() => { try { return JSON.parse(r.tags || '[]'); } catch { return []; } })() })));
  });

  router.get('/sounds/library', async (_req, res) => {
    try {
      res.json(await fetchTabletopAudioLibrary());
    } catch (e: any) {
      res.status(502).json({ error: e.message });
    }
  });

  router.post('/sounds/library/import', async (req, res) => {
    if (!dbAvailable) return res.status(503).json({ error: 'DB not available' });
    try {
      const library = await fetchTabletopAudioLibrary();
      if (req.body.ids !== undefined && !Array.isArray(req.body.ids)) return res.status(400).json({ error: 'ids must be an array' });
      const ids = (Array.isArray(req.body.ids) ? [...new Set(req.body.ids.filter((id: unknown): id is string => typeof id === 'string'))] : undefined) as string[] | undefined;
      const toImport = ids ? library.filter(s => ids.includes(s.id)) : library;
      res.json({ ...insertSounds(db, toImport), invalid: ids ? ids.length - toImport.length : 0 });
    } catch (e: any) {
      res.status(502).json({ error: e.message });
    }
  });

  router.get('/sounds/local', (_req, res) => {
    if (!fs.existsSync(localAudioDir)) return res.json([]);
    const results: SoundImport[] = [];
    for (const folder of fs.readdirSync(localAudioDir)) {
      if (folder.startsWith('.')) continue;
      const folderPath = path.join(localAudioDir, folder);
      if (!fs.statSync(folderPath).isDirectory()) continue;
      const category = classifyFolder(folder);
      for (const file of fs.readdirSync(folderPath).filter(f => !f.startsWith('.') && /\.(ogg|mp3|wav)$/i.test(f))) {
        results.push({
          id: `local-${folder.replace(/\W+/g, '-').toLowerCase()}-${file.replace(/\W+/g, '-').toLowerCase()}`,
          name: prettifyFilename(file),
          pack: folder.replace(/ SoundPad.*| Patreon.*/i, ''),
          category, tags: [folder.replace(/ SoundPad.*| Patreon.*/i, '').toLowerCase()], volume: 0.8,
          url: `/audio/local/${encodeURIComponent(folder)}/${encodeURIComponent(file)}`,
          sourceType: 'local',
          sourceReference: path.relative(localAudioDir, path.join(folder, file)),
          storageType: 'mounted-file',
        });
      }
    }
    res.json(results);
  });

  router.post('/sounds/local/import', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ error: 'DB not available' });
    if (!fs.existsSync(localAudioDir)) return res.status(404).json({ error: 'Local audio folder not found' });
    if (req.body.ids !== undefined && !Array.isArray(req.body.ids)) return res.status(400).json({ error: 'ids must be an array' });
    const ids = (Array.isArray(req.body.ids) ? [...new Set(req.body.ids.filter((id: unknown): id is string => typeof id === 'string'))] : undefined) as string[] | undefined;
    const toInsert: SoundImport[] = [];
    for (const folder of fs.readdirSync(localAudioDir)) {
      if (folder.startsWith('.')) continue;
      const folderPath = path.join(localAudioDir, folder);
      if (!fs.statSync(folderPath).isDirectory()) continue;
      const category = classifyFolder(folder);
      for (const file of fs.readdirSync(folderPath).filter(f => !f.startsWith('.') && /\.(ogg|mp3|wav)$/i.test(f))) {
        const id = `local-${folder.replace(/\W+/g, '-').toLowerCase()}-${file.replace(/\W+/g, '-').toLowerCase()}`;
        if (ids && !ids.includes(id)) continue;
        toInsert.push({ id, name: prettifyFilename(file), category, tags: [folder.replace(/ SoundPad.*| Patreon.*/i, '').toLowerCase()], volume: 0.8, url: `/audio/local/${encodeURIComponent(folder)}/${encodeURIComponent(file)}`, sourceType: 'local', sourceReference: path.relative(localAudioDir, path.join(folder, file)), storageType: 'mounted-file' });
      }
    }
    res.json({ ...insertSounds(db, toInsert), invalid: ids ? ids.length - toInsert.length : 0 });
  });

  router.get('/sounds/ambiences', (_req, res) => {
    if (!fs.existsSync(ambiencesDir)) return res.json([]);
    const groups = new Map<string, { name: string; genre: string; variants: { label: string; url: string }[] }>();
    for (const file of fs.readdirSync(ambiencesDir)) {
      if (file.startsWith('.') || !/\.(mp3|ogg|wav)$/i.test(file) || /\.part$/i.test(file)) continue;
      const noExt = file.replace(/\.[^.]+$/, '');
      const vmatch = noExt.match(/^(.+?)\s*\(([^)]+)\)$/);
      const baseName = vmatch ? vmatch[1].trim() : noExt.trim();
      const variantLabel = vmatch ? vmatch[2].trim() : 'Full';
      if (!groups.has(baseName)) groups.set(baseName, { name: baseName, genre: classifyAmbience(baseName), variants: [] });
      groups.get(baseName)!.variants.push({ label: variantLabel, url: `/audio/ambiences/${encodeURIComponent(file)}` });
    }
    const result = Array.from(groups.values()).map(g => ({
      id: `ambience-${g.name.replace(/[^\w]+/g, '-').toLowerCase()}`,
      name: g.name, genre: g.genre,
      defaultUrl: g.variants.find(v => v.label === 'Full')?.url ?? g.variants[0]?.url ?? '',
      variants: g.variants.sort((a, b) => a.label === 'Full' ? -1 : b.label === 'Full' ? 1 : a.label.localeCompare(b.label)),
    }));
    result.sort((a, b) => a.genre.localeCompare(b.genre) || a.name.localeCompare(b.name));
    res.json(result);
  });

  router.post('/sounds/ambiences/import', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ error: 'DB not available' });
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!fs.existsSync(ambiencesDir)) return res.status(404).json({ error: 'Ambiences folder not found' });
    const available = new Map<string, { name: string; genre: string; urls: Set<string> }>();
    for (const file of fs.readdirSync(ambiencesDir)) {
      if (file.startsWith('.') || !/\.(mp3|ogg|wav)$/i.test(file)) continue;
      const noExt = file.replace(/\.[^.]+$/, '');
      const vmatch = noExt.match(/^(.+?)\s*\(([^)]+)\)$/);
      const name = vmatch ? vmatch[1].trim() : noExt.trim();
      const url = `/audio/ambiences/${encodeURIComponent(file)}`;
      const id = `ambience-${name.replace(/[^\w]+/g, '-').toLowerCase()}`;
      const entry = available.get(id) ?? { name, genre: classifyAmbience(name), urls: new Set<string>() };
      entry.urls.add(url);
      available.set(id, entry);
    }
    const sounds = items.flatMap((item: any) => {
      if (typeof item?.id !== 'string' || typeof item?.url !== 'string') return [];
      const source = available.get(item.id);
      if (!source || !source.urls.has(item.url)) return [];
      return [{ id: item.id, name: source.name, url: item.url, category: AMBIENCE_GENRE_TO_CATEGORY[source.genre] ?? 'ambient', tags: [source.genre.toLowerCase()], volume: 0.8 }];
    });
    res.json({ ...insertSounds(db, sounds), invalid: items.length - sounds.length });
  });

  router.post('/sounds/foundry/import', async (req, res) => {
    if (!dbAvailable) return res.status(503).json({ error: 'DB not available' });
    const world = typeof req.body?.world === 'string' ? req.body.world.trim() : '';
    const ids = Array.isArray(req.body?.ids) ? [...new Set(req.body.ids.filter((id: unknown): id is string => typeof id === 'string'))] : null;
    if (!world || !ids) return res.status(400).json({ error: 'world and ids are required' });
    const createdPaths: string[] = [];
    try {
      const catalog = await getFoundrySounds(world);
      const selected = catalog.filter(sound => ids.includes(sound.id));
      const invalid = ids.length - selected.length;
      let unavailable = 0;
      const imports: SoundImport[] = [];
      for (const sound of selected) {
        const id = `foundry-${world}-${sound.id}`;
        if (db.prepare('SELECT 1 FROM sounds WHERE id = ?').get(id)) continue;
        const rootValue = getFoundryRoot();
        if (!rootValue) { unavailable++; continue; }
        const root = path.resolve(rootValue);
        const sourcePath = path.resolve(path.join(root, sound.path));
        if (!sourcePath.startsWith(root + path.sep) || !fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) { unavailable++; continue; }
        const realSourcePath = fs.realpathSync(sourcePath);
        if (!realSourcePath.startsWith(root + path.sep)) { unavailable++; continue; }
        const filename = `${crypto.randomBytes(8).toString('hex')}-${path.basename(sound.path).replace(/[^a-z0-9._-]/gi, '_')}`;
        const destination = path.join(soundsUploadDir, filename);
        fs.copyFileSync(realSourcePath, destination);
        createdPaths.push(destination);
        const fileSize = fs.statSync(destination).size;
        const checksum = crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex');
        imports.push({
          id,
          name: sound.name,
          url: `/uploads/sounds/${filename}`,
          category: 'ambient',
          tags: ['foundry', ...(sound.playlist ? [sound.playlist.toLowerCase()] : [])],
          volume: sound.volume ?? 0.5,
          sourceType: 'foundry',
          sourceReference: sound.path,
          storageType: 'managed-file',
          filePath: destination,
          fileSize,
          checksum,
        });
      }
      const result = insertSounds(db, imports);
      res.json({ ...result, invalid: invalid + unavailable });
    } catch (e: any) {
      for (const createdPath of createdPaths) fs.rmSync(createdPath, { force: true });
      res.status(500).json({ error: e.message ?? 'Foundry import failed' });
    }
  });

  // ── YouTube / yt-dlp import ────────────────────────────────────────────────

  router.get('/sounds/youtube/search', async (req, res) => {
    const q = req.query.q as string;
    if (!q) return res.status(400).json({ error: 'q required' });
    try {
      const results = await new Promise<any[]>((resolve, reject) => {
        // Get top 8 results: title, id, duration, uploader
        const proc = spawn('yt-dlp', [
          '--print', '%(title)s|%(id)s|%(duration_string)s|%(uploader)s',
          '--no-playlist', '--flat-playlist',
          `ytsearch8:${q}`
        ]);
        let out = '';
        let err = '';
        proc.stdout.on('data', (d: Buffer) => { out += d; });
        proc.stderr.on('data', (d: Buffer) => { err += d; });
        proc.on('close', code => {
          if (code === 0) {
            const lines = out.trim().split('\n').filter(l => l.includes('|'));
            const items = lines.map(line => {
              const [title, id, duration, uploader] = line.split('|');
              return {
                id,
                title,
                duration,
                uploader,
                url: `https://www.youtube.com/watch?v=${id}`,
                thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
              };
            });
            resolve(items);
          } else {
            reject(new Error(err.slice(-200) || 'yt-dlp search failed'));
          }
        });
        setTimeout(() => { proc.kill(); reject(new Error('Search timed out')); }, 15_000);
      });
      res.json(results);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/sounds/youtube/meta', async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ error: 'url required' });
    try {
      const title = await new Promise<string>((resolve, reject) => {
        const proc = spawn('yt-dlp', ['--get-title', '--no-playlist', '--', url]);
        let out = '';
        proc.stdout.on('data', (d: Buffer) => { out += d; });
        proc.on('close', code => { if (code === 0) resolve(out.trim()); else reject(new Error('yt-dlp exited with code ' + code)); });
        proc.on('error', (e: NodeJS.ErrnoException) => reject(new Error(e.code === 'ENOENT' ? 'yt-dlp not installed' : e.message)));
        setTimeout(() => { proc.kill(); reject(new Error('timeout')); }, 10_000);
      });
      res.json({ title });
    } catch {
      res.json({ title: '' });
    }
  });

  router.post('/sounds/youtube/download', async (req, res) => {
    if (!dbAvailable) return res.status(503).json({ error: 'DB not available' });
    const { url, name, category = 'ambient', volume = 0.8 } = req.body;
    if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url required' });

    const id = `yt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const outputTemplate = path.join(soundsUploadDir, `${id}.%(ext)s`);

    try {
      await new Promise<void>((resolve, reject) => {
        const proc = spawn('yt-dlp', [
          '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '5',
          '--no-playlist', '--max-filesize', '50m',
          '-o', outputTemplate, '--', url,
        ]);
        let stderr = '';
        proc.stderr.on('data', (d: Buffer) => { stderr += d; });
        proc.on('close', code => { if (code === 0) resolve(); else reject(new Error(stderr.slice(-400) || `yt-dlp exited ${code}`)); });
        proc.on('error', (e: NodeJS.ErrnoException) => reject(new Error(
          e.code === 'ENOENT'
            ? 'yt-dlp is not installed. Install it with: pip install yt-dlp  (or download from https://github.com/yt-dlp/yt-dlp)'
            : e.message
        )));
        setTimeout(() => { proc.kill(); reject(new Error('Download timed out (5 min)')); }, 5 * 60_000);
      });

      const files = fs.readdirSync(soundsUploadDir).filter(f => f.startsWith(id));
      if (!files.length) throw new Error('Download produced no output file');

      const filename = files[0];
      const soundUrl = `/uploads/sounds/${filename}`;
      const soundName = (name as string)?.trim() || filename.replace(/\.[^.]+$/, '').replace(/-/g, ' ');
      db.prepare('INSERT INTO sounds (id, name, url, category, tags, spellId, volume) VALUES (?, ?, ?, ?, ?, NULL, ?)')
        .run(id, soundName, soundUrl, category, JSON.stringify(['youtube']), volume);
      res.json({ id, name: soundName, url: soundUrl, category });
    } catch (e: any) {
      try {
        fs.readdirSync(soundsUploadDir).filter(f => f.startsWith(id)).forEach(f => fs.unlinkSync(path.join(soundsUploadDir, f)));
      } catch {}
      res.status(500).json({ error: e.message ?? 'Download failed' });
    }
  });

  router.post('/sounds', soundUpload.single('file'), (req, res) => {
    if (!dbAvailable) return res.status(503).json({ error: 'DB not available' });
    const { id, name, category, tags, spellId, volume } = req.body as Record<string, string>;
    if (!id || !name) return res.status(400).json({ error: 'id and name required' });
    let url = req.body.url ?? '';
    if ((req as any).file) url = `/uploads/sounds/${(req as any).file.filename}`;
    if (!url) return res.status(400).json({ error: 'url or file required' });
    db.prepare('INSERT INTO sounds (id, name, url, category, tags, spellId, volume) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, name, url, category ?? 'custom', tags ?? '[]', spellId ?? null, parseFloat(volume ?? '1'));
    res.status(201).json({ id, name, url });
  });

  router.put('/sounds/:id', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ error: 'DB not available' });
    const existing = db.prepare('SELECT * FROM sounds WHERE id = ?').get(req.params.id) as any;
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { name = existing.name, category = existing.category, tags, spellId, volume, isFavorite } = req.body;
    db.prepare('UPDATE sounds SET name = ?, category = ?, tags = ?, spellId = ?, volume = ?, isFavorite = ? WHERE id = ?').run(name, category, tags != null ? JSON.stringify(tags) : existing.tags, spellId ?? existing.spellId, volume ?? existing.volume, isFavorite !== undefined ? isFavorite : existing.isFavorite, req.params.id);
    res.json({ success: true });
  });

  router.delete('/sounds/:id', (req, res) => {
    if (!dbAvailable) return res.status(503).json({ error: 'DB not available' });
    const row = db.prepare('SELECT url FROM sounds WHERE id = ?').get(req.params.id) as any;
    if (row?.url?.startsWith('/uploads/sounds/')) {
      fs.unlink(path.join(__dirname, '..', row.url), () => {});
    }
    db.prepare('DELETE FROM sounds WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Sound proxy — bypasses CORS, supports range requests for audio seeking
  router.get('/sound-proxy', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl || !targetUrl.startsWith('https://sounds.tabletopaudio.com/')) {
      return res.status(400).json({ error: 'Invalid or missing url parameter' });
    }
    try {
      const upstreamHeaders: Record<string, string> = {
        'Origin': 'https://tabletopaudio.com',
        'Referer': 'https://tabletopaudio.com/',
        'User-Agent': 'Mozilla/5.0 (compatible; DnDTracker/1.0)',
      };
      const rangeHeader = req.headers['range'];
      if (rangeHeader) upstreamHeaders['Range'] = rangeHeader;
      const upstream = await fetch(targetUrl, { headers: upstreamHeaders });
      if (!upstream.ok && upstream.status !== 206) return res.status(upstream.status).send(`Upstream returned ${upstream.status}`);
      res.status(upstream.status === 206 ? 206 : 200);
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const contentLength = upstream.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      const contentRange = upstream.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);
      Readable.fromWeb(upstream.body as any).pipe(res);
    } catch (err) {
      console.error('[sound-proxy] error:', err);
      if (!res.headersSent) res.status(500).send('Proxy failed');
    }
  });

  return { router, soundsUploadDir };
}
