import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || path.join(__dirname, "data", "dnd_tracker.db");
const db = new Database(dbPath);

interface Monster {
  id: string;
  name: string;
}

const monsters = db.prepare("SELECT id, name FROM monsters").all() as Monster[];

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchMonster(name: string): Monster | null {
  const norm = normalize(name);
  // Exact match
  const exact = monsters.find(m => normalize(m.name) === norm);
  if (exact) return exact;
  // Substring match
  const sub = monsters.find(m => normalize(m.name).includes(norm) || norm.includes(normalize(m.name)));
  if (sub) return sub;
  return null;
}

const journalDir = path.join(__dirname, 'journal');
const files = fs.readdirSync(journalDir).filter(f => f.endsWith('.json'));

const encountersByLocation: Record<string, { creature: string; count: number; matchedId?: string }[]> = {};

for (const file of files) {
  const filePath = path.join(journalDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  for (const page of data.pages || []) {
    const html = page.text?.content || '';
    
    // Simple table parser for ⚔️ Encounter Prep or similar
    const tables = html.match(/<table[\s\S]*?<\/table>/g) || [];
    for (const table of tables) {
      // Check if it's an encounter table by checking headers
      if (!table.includes('Creature') || !table.includes('Count')) continue;
      
      const rows = table.match(/<tr[\s\S]*?<\/tr>/g) || [];
      for (const row of rows) {
        const cells = row.match(/<td[\s\S]*?<\/td>/g);
        if (!cells || cells.length < 4) continue;
        
        const creatureRaw = cells[0].replace(/<[^>]*>/g, '').trim();
        const countRaw = cells[3].replace(/<[^>]*>/g, '').trim();
        const locationRaw = cells[4]?.replace(/<[^>]*>/g, '').trim() || 'Unknown';
        
        // Handle counts like "12+", "25", "3 (x3 reading in chairs)"
        const countMatch = countRaw.match(/(\d+)/);
        const count = countMatch ? parseInt(countMatch[1]) : 1;
        
        const matched = matchMonster(creatureRaw);
        
        // Extract location(s) - handle comma separated or multiple
        const locations = locationRaw.split(/[,&]+/).map(l => l.trim()).filter(l => l.length > 0);
        
        for (const loc of locations) {
          // Normalize location name (e.g., "M7 (x3)" -> "M7")
          const cleanLoc = loc.split(' ')[0].trim();
          if (!encountersByLocation[cleanLoc]) encountersByLocation[cleanLoc] = [];
          
          // Deduplication logic: Check if this creature (by name or ID) already exists for this location
          const existing = encountersByLocation[cleanLoc].find(c => 
            (c.matchedId && c.matchedId === matched?.id) || 
            (!c.matchedId && c.creature === creatureRaw)
          );

          if (existing) {
            // Use Math.max because different pages might list the same creatures for the same location
            // e.g. Overview has total counts, specific pages have partial counts
            existing.count = Math.max(existing.count, count);
          } else {
            encountersByLocation[cleanLoc].push({
              creature: creatureRaw,
              count: count,
              matchedId: matched?.id
            });
          }
        }
      }
    }
  }
}

console.log("\n--- Analyzed Encounters by Location ---\n");

for (const [loc, creatures] of Object.entries(encountersByLocation)) {
  console.log(`Location: ${loc}`);
  creatures.forEach(c => {
    console.log(`  - ${c.count}x ${c.creature} [${c.matchedId ? 'MATCHED: ' + c.matchedId : 'MISSING'}]`);
  });
  console.log("");
}

console.log("\n--- Creating Encounters in Database ---\n");

const insertEncounter = db.prepare(`
  INSERT INTO encounters (id, name, folder) VALUES (?, ?, ?)
`);

const insertCombatant = db.prepare(`
  INSERT INTO combatants (id, encounterId, name, initiative, hp_current, hp_max, ac, speed, subtitle, avatar, type, stats, actions, abilities)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const [loc, creatures] of Object.entries(encountersByLocation)) {
  const encounterId = crypto.randomUUID();
  const encounterName = `Motherhorn: ${loc}`;
  
  try {
    insertEncounter.run(encounterId, encounterName, 'Motherhorn');
    console.log(`Created Encounter: ${encounterName}`);
    
    for (const c of creatures) {
      if (!c.matchedId) {
        console.warn(`  - Skipping ${c.creature} (no match found)`);
        continue;
      }
      
      const monster = db.prepare("SELECT * FROM monsters WHERE id = ?").get(c.matchedId) as any;
      if (!monster) continue;
      
      for (let i = 0; i < c.count; i++) {
        const combatantId = crypto.randomUUID();
        const combatantName = c.count > 1 ? `${monster.name} ${i + 1}` : monster.name;
        
        // Simple initiative roll (1d20 + Dex mod)
        const dexMod = Math.floor(((JSON.parse(monster.stats).dex || 10) - 10) / 2);
        const init = Math.floor(Math.random() * 20) + 1 + dexMod;
        
        insertCombatant.run(
          combatantId,
          encounterId,
          combatantName,
          init,
          monster.hp,
          monster.maxHp,
          monster.ac,
          monster.speed,
          monster.type,
          monster.avatar,
          'monster',
          monster.stats,
          monster.actions,
          monster.abilities
        );
      }
      console.log(`  - Added ${c.count}x ${monster.name}`);
    }
  } catch (e) {
    console.error(`Failed to create encounter ${encounterName}:`, e);
  }
}

console.log("\nImport Complete! You can now find these encounters in the 'Motherhorn' folder in your vault.");

