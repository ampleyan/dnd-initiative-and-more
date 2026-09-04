
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'dnd_tracker.db');
const db = new Database(dbPath);

// All URLs are routed through /api/sound-proxy to bypass CORS.
// Source: sounds.tabletopaudio.com — ambient audio packs licensed for free streaming.
const proxy = (slug: string) =>
  `/api/sound-proxy?url=https://sounds.tabletopaudio.com/${slug}.mp3`;

const defaultSounds = [
  // ── Ambient ──────────────────────────────────────────────────
  {
    id: 'ambient-manor-dark',
    name: 'Manor Dark',
    url: proxy('488_Manor_Dark'),
    category: 'ambient',
    tags: JSON.stringify(['dark', 'indoor', 'ominous']),
    spellId: null,
    volume: 0.5,
  },
  {
    id: 'ambient-dungeon',
    name: 'Ice Mephit Cavern',
    url: proxy('472_Ice_Mephit_Cavern'),
    category: 'ambient',
    tags: JSON.stringify(['dungeon', 'cave', 'cold']),
    spellId: null,
    volume: 0.5,
  },
  {
    id: 'ambient-stone-barrow',
    name: 'Stone Barrow',
    url: proxy('490_Stone_Barrow'),
    category: 'ambient',
    tags: JSON.stringify(['dungeon', 'tomb', 'dark']),
    spellId: null,
    volume: 0.5,
  },
  {
    id: 'ambient-foghaven',
    name: 'Foghaven',
    url: proxy('462_Foghaven'),
    category: 'ambient',
    tags: JSON.stringify(['city', 'fog', 'night']),
    spellId: null,
    volume: 0.5,
  },
  {
    id: 'ambient-kingdom-of-mist',
    name: 'Kingdom of Mist',
    url: proxy('474_Kingdom_of_Mist'),
    category: 'ambient',
    tags: JSON.stringify(['outdoors', 'mysterious', 'mist']),
    spellId: null,
    volume: 0.5,
  },
  {
    id: 'ambient-village-festival',
    name: 'Village Festival',
    url: proxy('500_Village_Festival'),
    category: 'ambient',
    tags: JSON.stringify(['tavern', 'settlement', 'crowd']),
    spellId: null,
    volume: 0.55,
  },
  // ── Combat ───────────────────────────────────────────────────
  {
    id: 'combat-red-dragon-dawn',
    name: 'Red Dragon Dawn',
    url: proxy('491_Red_Dragon_Dawn'),
    category: 'combat',
    tags: JSON.stringify(['dragon', 'intense', 'battle']),
    spellId: null,
    volume: 0.7,
  },
  {
    id: 'combat-high-alert',
    name: 'High Alert',
    url: proxy('487_High_Alert'),
    category: 'combat',
    tags: JSON.stringify(['tense', 'chase', 'danger']),
    spellId: null,
    volume: 0.7,
  },
  {
    id: 'combat-war-wagon',
    name: 'War Wagon',
    url: proxy('486_War_Wagon'),
    category: 'combat',
    tags: JSON.stringify(['battle', 'travel', 'skirmish']),
    spellId: null,
    volume: 0.7,
  },
  {
    id: 'combat-ready-the-castle',
    name: 'Ready the Castle',
    url: proxy('484_Ready_the_Castle'),
    category: 'combat',
    tags: JSON.stringify(['siege', 'castle', 'preparation']),
    spellId: null,
    volume: 0.65,
  },
  {
    id: 'combat-village-raid',
    name: 'Village Raid',
    url: proxy('496_Village_Raid'),
    category: 'combat',
    tags: JSON.stringify(['ambush', 'raid', 'chaos']),
    spellId: null,
    volume: 0.7,
  },
  {
    id: 'combat-barghest-fell',
    name: 'Barghest Fell',
    url: proxy('476_Barghest_Fell'),
    category: 'combat',
    tags: JSON.stringify(['undead', 'dark', 'chase']),
    spellId: null,
    volume: 0.65,
  },
  {
    id: 'combat-battle-stations',
    name: 'Battle Stations',
    url: proxy('467_Battle_Stations'),
    category: 'combat',
    tags: JSON.stringify(['combat', 'urgent', 'ship']),
    spellId: null,
    volume: 0.7,
  },
  // ── Magic ────────────────────────────────────────────────────
  {
    id: 'magic-sentient-eye',
    name: 'Sentient Eye',
    url: proxy('502_Sentient_Eye'),
    category: 'magic',
    tags: JSON.stringify(['arcane', 'mysterious', 'eye']),
    spellId: null,
    volume: 0.55,
  },
  {
    id: 'magic-witches-dance',
    name: "Witches' Dance",
    url: proxy('481_Witches_Dance'),
    category: 'magic',
    tags: JSON.stringify(['ritual', 'dark', 'witches']),
    spellId: null,
    volume: 0.6,
  },
  {
    id: 'magic-resurrection',
    name: 'Resurrection',
    url: proxy('461_Resurrection'),
    category: 'magic',
    tags: JSON.stringify(['divine', 'holy', 'resurrection']),
    spellId: null,
    volume: 0.6,
  },
  {
    id: 'magic-pharaohs-chamber',
    name: "Pharaoh's Chamber",
    url: proxy('480_Pharaohs_Chamber'),
    category: 'magic',
    tags: JSON.stringify(['ancient', 'tomb', 'arcane']),
    spellId: null,
    volume: 0.55,
  },
  // ── Nature ───────────────────────────────────────────────────
  {
    id: 'nature-lady-of-the-wood',
    name: 'Lady of the Wood',
    url: proxy('485_Lady_of_the_Wood'),
    category: 'nature',
    tags: JSON.stringify(['forest', 'fey', 'serene']),
    spellId: null,
    volume: 0.5,
  },
  {
    id: 'nature-petrified-forest',
    name: 'Petrified Forest',
    url: proxy('464_Petrified_Forest'),
    category: 'nature',
    tags: JSON.stringify(['forest', 'eerie', 'petrified']),
    spellId: null,
    volume: 0.5,
  },
  {
    id: 'nature-hunting-grounds',
    name: 'Hunting Grounds',
    url: proxy('457_Hunting_Grounds'),
    category: 'nature',
    tags: JSON.stringify(['wilderness', 'hunt', 'outdoors']),
    spellId: null,
    volume: 0.5,
  },
  {
    id: 'nature-ravaged-lands',
    name: 'Ravaged Lands',
    url: proxy('499_Ravaged_Lands'),
    category: 'nature',
    tags: JSON.stringify(['wasteland', 'barren', 'desolate']),
    spellId: null,
    volume: 0.5,
  },
  {
    id: 'nature-crown-road',
    name: 'The Crown Road',
    url: proxy('489_The_Crown_Road'),
    category: 'nature',
    tags: JSON.stringify(['travel', 'road', 'outdoors']),
    spellId: null,
    volume: 0.5,
  },
];

function seed() {
  console.log('Seeding default sounds...');

  // Ensure table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS sounds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      category TEXT,
      tags TEXT,
      spellId TEXT,
      volume REAL DEFAULT 1.0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  const insert = db.prepare(`
    INSERT OR REPLACE INTO sounds (id, name, url, category, tags, spellId, volume)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((sounds) => {
    for (const s of sounds) {
      insert.run(s.id, s.name, s.url, s.category, s.tags, s.spellId, s.volume);
    }
  });

  transaction(defaultSounds);
  console.log(`Successfully seeded ${defaultSounds.length} sounds.`);
}

seed();
db.close();
