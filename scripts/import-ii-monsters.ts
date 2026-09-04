import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || path.join(__dirname, "data", "dnd_tracker.db");
const db = new Database(dbPath);

const iiData = JSON.parse(fs.readFileSync('improved-initiative.json', 'utf-8'));

const insertMonster = db.prepare(`
  INSERT OR REPLACE INTO monsters (id, name, hp, maxHp, ac, speed, avatar, xp, description, cr, type, stats, actions, abilities, source, tags)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let count = 0;
for (const [key, value] of Object.entries(iiData)) {
  if (key.startsWith('Creatures.')) {
    const c = value as any;
    
    const stats = {
      str: c.Abilities?.Str || 10,
      dex: c.Abilities?.Dex || 10,
      con: c.Abilities?.Con || 10,
      int: c.Abilities?.Int || 10,
      wis: c.Abilities?.Wis || 10,
      cha: c.Abilities?.Cha || 10
    };
    
    const actions = (c.Actions || []).map((a: any) => ({
      name: a.Name,
      description: a.Content
    }));
    
    const abilities = (c.Traits || []).map((t: any) => ({
      name: t.Name,
      description: t.Content
    }));
    
    const hp = typeof c.HP?.Value === 'number' ? c.HP.Value : 1;
    const ac = typeof c.AC?.Value === 'number' ? c.AC.Value : 10;
    
    try {
      insertMonster.run(
        c.Id || crypto.randomUUID(),
        c.Name || 'Unknown',
        hp,
        hp,
        ac,
        Array.isArray(c.Speed) ? c.Speed.join(', ') : (c.Speed || '30 ft.'),
        c.ImageURL || '',
        0, // XP not directly in this format easily
        c.Description || '',
        c.Challenge || '0',
        c.Type || 'unknown',
        JSON.stringify(stats),
        JSON.stringify(actions),
        JSON.stringify(abilities),
        c.Source || 'improved-initiative',
        JSON.stringify(c.Tags || [])
      );
      count++;
    } catch (e) {
      console.error(`Failed to insert ${c.Name}:`, e);
    }
  }
}

console.log(`Imported ${count} monsters from improved-initiative.json`);
