import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

export function initDatabase(): { db: any; dbAvailable: boolean } {
  let db: any;
  let dbAvailable = false;

  try {
    const dbPath = process.env.DB_PATH || 'dnd_tracker.db';
    db = new Database(dbPath);
    db.pragma('foreign_keys = ON');
    dbAvailable = true;

    db.exec(`
      CREATE TABLE IF NOT EXISTS encounters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        currentRound INTEGER DEFAULT 1,
        isEncounterActive INTEGER DEFAULT 0,
        showSummary INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS combatants (
        id TEXT PRIMARY KEY,
        encounterId TEXT,
        name TEXT NOT NULL,
        initiative INTEGER DEFAULT 0,
        hp_current INTEGER DEFAULT 0,
        hp_max INTEGER DEFAULT 0,
        ac INTEGER DEFAULT 0,
        speed TEXT,
        subtitle TEXT,
        avatar TEXT,
        type TEXT,
        isCurrentTurn INTEGER DEFAULT 0,
        conditions TEXT,
        tags TEXT,
        stats TEXT,
        actions TEXT,
        abilities TEXT,
        FOREIGN KEY (encounterId) REFERENCES encounters(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS monsters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        hp INTEGER DEFAULT 0,
        maxHp INTEGER DEFAULT 0,
        ac INTEGER DEFAULT 0,
        speed TEXT,
        avatar TEXT,
        xp INTEGER DEFAULT 0,
        description TEXT,
        cr TEXT,
        type TEXT,
        stats TEXT,
        actions TEXT,
        abilities TEXT
      );
    `);

    const migrations: [string, string][] = [
      ['encounters', 'currentTurnIndex INTEGER DEFAULT 0'],
      ['encounters', "backgroundImage TEXT DEFAULT ''"],
      ['encounters', "youtubeUrl TEXT DEFAULT ''"],
      ['encounters', "encounterStats TEXT DEFAULT ''"],
      ['encounters', "folder TEXT DEFAULT ''"],
      ['encounters', "musicUrl TEXT DEFAULT ''"],
      ['encounters', 'completedAt DATETIME'],
      ['encounters', "difficulty TEXT DEFAULT ''"],
      ['encounters', 'backgroundOpacity REAL DEFAULT 0.22'],
      ['encounters', 'panelOpacity REAL DEFAULT 0.92'],
      ['encounters', "animationLevel TEXT DEFAULT 'minimal'"],
      ['encounters', 'soundIds TEXT DEFAULT NULL'],
      ['encounters', 'sessionId TEXT DEFAULT NULL'],
      ['encounters', 'trackingData TEXT DEFAULT NULL'],
      ['combatants', 'tempHp INTEGER DEFAULT 0'],
      ['combatants', 'ownerId TEXT DEFAULT NULL'],
      ['combatants', "customTagDescriptions TEXT DEFAULT '{}'"],
      ['combatants', "conditionTimers TEXT DEFAULT '{}'"],
      ['combatants', 'concentratingOn TEXT DEFAULT NULL'],
      ['combatants', 'concentrationTargets TEXT DEFAULT NULL'],
      ['combatants', 'deathSaves TEXT DEFAULT NULL'],
      ['combatants', "spells TEXT DEFAULT '[]'"],
      ['combatants', 'playerId TEXT DEFAULT NULL'],
      ['monsters', "source TEXT DEFAULT 'custom'"],
      ['monsters', "tags TEXT DEFAULT '[]'"],
      ['monsters', "spells TEXT DEFAULT '[]'"],
      ['monsters', "data_hash TEXT DEFAULT ''"],
      ['monsters', "vulnerabilities TEXT DEFAULT '[]'"],
      ['monsters', "resistances TEXT DEFAULT '[]'"],
      ['monsters', "damageImmunities TEXT DEFAULT '[]'"],
      ['monsters', "conditionImmunities TEXT DEFAULT '[]'"],
      ['combatants', "vulnerabilities TEXT DEFAULT '[]'"],
      ['combatants', "resistances TEXT DEFAULT '[]'"],
      ['combatants', "damageImmunities TEXT DEFAULT '[]'"],
      ['combatants', "conditionImmunities TEXT DEFAULT '[]'"],
      ['combatants', 'spellSlots TEXT DEFAULT NULL'],
      ['combatants', 'featureUses TEXT DEFAULT NULL'],
      ['combatants', "spellIds TEXT DEFAULT '[]'"],
      ['combatants', "featureIds TEXT DEFAULT '[]'"],
      ['combatants', 'legendaryActions TEXT DEFAULT NULL'],
      ['combatants', 'isFriendly INTEGER DEFAULT 0'],
      ['encounters', 'lairActionsEnabled INTEGER DEFAULT 0'],
      ['encounters', 'favorite INTEGER DEFAULT 0'],
      ['encounters', 'notes TEXT DEFAULT NULL'],
      ['encounters', "waves TEXT DEFAULT '[]'"],
      ['combatants', 'hidden INTEGER DEFAULT 0'],
      ['combatants', "waveId TEXT DEFAULT 'default'"],
    ];

    for (const [table, col] of migrations) {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col}`); } catch (e: any) { if (!/duplicate column|already exists/i.test(e.message)) throw e; }
    }

    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS folder_settings (
          folder TEXT PRIMARY KEY,
          backgroundImage TEXT DEFAULT '',
          musicUrl TEXT DEFAULT ''
        );
      `);
    } catch (e: any) { if (!/duplicate column|already exists/i.test(e.message)) throw e; }

    db.exec(`
      CREATE TABLE IF NOT EXISTS spells (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        level INTEGER DEFAULT 0,
        school TEXT,
        time TEXT,
        range TEXT,
        components TEXT,
        duration TEXT,
        description TEXT,
        higherLevels TEXT,
        classes TEXT,
        source TEXT
      );

      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        dndBeyondId TEXT UNIQUE,
        hp_max INTEGER DEFAULT 0,
        ac INTEGER DEFAULT 10,
        speed TEXT DEFAULT '30 ft.',
        subtitle TEXT DEFAULT '',
        avatar TEXT DEFAULT '',
        stats TEXT DEFAULT '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
        lastImported TEXT
      );
    `);

    const playerMigrations = [
      'passive_perception INTEGER DEFAULT 10',
      'level INTEGER DEFAULT 1',
      "actions TEXT DEFAULT '[]'",
      "abilities TEXT DEFAULT '[]'",
      "spells TEXT DEFAULT '[]'",
      "spell_ids TEXT DEFAULT '[]'",
      "feature_ids TEXT DEFAULT '[]'",
      "spell_slots TEXT DEFAULT '{}'",
      "feature_uses TEXT DEFAULT '{}'",
      "data_hash TEXT DEFAULT ''",
      'hp_current INTEGER DEFAULT NULL',
    ];
    for (const col of playerMigrations) {
      try { db.exec(`ALTER TABLE players ADD COLUMN ${col}`); } catch (e: any) { if (!/duplicate column|already exists/i.test(e.message)) throw e; }
    }

    try { db.exec('CREATE INDEX IF NOT EXISTS idx_monsters_name_source ON monsters (name, source);'); } catch (e) {}
    try { db.exec('CREATE INDEX IF NOT EXISTS idx_players_dndBeyondId ON players (dndBeyondId);'); } catch (e) {}

    try {
      db.exec(`CREATE TABLE IF NOT EXISTS class_features (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        className TEXT NOT NULL,
        classSource TEXT NOT NULL,
        level INTEGER NOT NULL DEFAULT 1,
        source TEXT,
        description TEXT,
        subclassName TEXT,
        isSubclass INTEGER NOT NULL DEFAULT 0
      )`);
    } catch (e: any) { if (!/duplicate column|already exists/i.test(e.message)) throw e; }

    try {
      db.exec(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
    } catch (e: any) { if (!/duplicate column|already exists/i.test(e.message)) throw e; }

    // Seed default admin user if none exist
    const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as any).cnt;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (userCount === 0) {
      const password = adminPassword ?? crypto.randomUUID().slice(0, 12);
      const hash = bcrypt.hashSync(password, 10);
      db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(crypto.randomUUID(), 'admin', hash, 'admin');
      if (!adminPassword) console.log(`\n⚠️  No ADMIN_PASSWORD env var set. Generated admin password: ${password}\n   Change it after first login!\n`);
    }

    // Backfill monster sources
    const alreadyBackfilled = (db.prepare("SELECT COUNT(*) as count FROM monsters WHERE source = '5etools'").get() as any)?.count > 0;
    if (!alreadyBackfilled) db.exec("UPDATE monsters SET source = '5etools' WHERE source = 'custom'");

    db.exec(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        campaignId TEXT NOT NULL,
        name TEXT NOT NULL,
        date TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaignId) REFERENCES campaigns(id) ON DELETE CASCADE
      );
    `);

    try { db.exec("ALTER TABLE campaigns ADD COLUMN mapImage TEXT DEFAULT ''"); } catch (e: any) { if (!/duplicate column|already exists/i.test(e.message)) throw e; }

    db.exec(`
      CREATE TABLE IF NOT EXISTS sounds (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        category TEXT DEFAULT 'custom',
        tags TEXT DEFAULT '[]',
        spellId TEXT DEFAULT NULL,
        volume REAL DEFAULT 1.0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    try { db.exec("ALTER TABLE sounds ADD COLUMN isFavorite INTEGER NOT NULL DEFAULT 0"); } catch (e: any) { if (!/duplicate column|already exists/i.test(e.message)) throw e; }
    try { db.exec(`ALTER TABLE combatants ADD COLUMN polymorph_form TEXT`); } catch (e: any) { if (!/duplicate column|already exists/i.test(e.message)) throw e; }

    // Seed one default sound if empty
    const soundCount = (db.prepare('SELECT COUNT(*) as count FROM sounds').get() as any).count;
    if (soundCount === 0) {
      console.log('Seeding default sound library...');
      db.prepare('INSERT INTO sounds (id, name, url, category, tags, spellId, volume) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        'spell-fireball', 'Fireball / Fire Bolt',
        'https://www.myinstants.com/media/sounds/a1-0001_pitbull-fireball-edited00086400-online-audio-converter.mp3',
        'spells', '["fire","explosion","evocation"]', 'fireball', 0.9
      );
    }

    // Settings table (used by lights/hue and home assistant)
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    } catch (e: any) { if (!/duplicate column|already exists/i.test(e.message)) throw e; }

  } catch (error) {
    console.error('Database initialization failed. Running without persistent storage.', error);
    dbAvailable = false;
  }

  return { db, dbAvailable };
}
