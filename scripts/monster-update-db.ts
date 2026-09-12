export function insertMonsterIfMissing(db: any, monster: any): boolean {
  const result = db.prepare(`
    INSERT INTO monsters (id, name, hp, maxHp, ac, speed, avatar, xp, description, cr, type, source, stats, actions, abilities, spells, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]')
    ON CONFLICT(id) DO NOTHING
  `).run(
    monster.id, monster.name, monster.hp, monster.maxHp, monster.ac, monster.speed,
    monster.avatar, monster.xp, monster.description, monster.cr, monster.type,
    monster.source, monster.stats, monster.actions, monster.abilities, monster.spells,
  );

  return result.changes === 1;
}
