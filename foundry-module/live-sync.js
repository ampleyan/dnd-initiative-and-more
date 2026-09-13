const MODULE_ID = "initiative-tracker-live-sync";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "appUrl", {
    name: "Initiative Tracker URL",
    hint: "Base URL of the Initiative Tracker server.",
    scope: "world",
    config: true,
    type: String,
    default: "http://localhost:3000"
  });

  game.settings.register(MODULE_ID, "token", {
    name: "Initiative Tracker token",
    hint: "Bearer token accepted by the live-sync endpoint.",
    scope: "world",
    config: true,
    type: String,
    default: ""
  });
});

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function spellSlotData(spells = {}) {
  const result = {};
  for (let level = 1; level <= 9; level += 1) {
    const key = `spell${level}`;
    const slot = spells[key];
    const max = numberValue(slot?.max ?? slot?.override);
    if (max > 0) {
      const value = Math.max(0, Math.min(max, numberValue(slot.value, max)));
      result[level] = {
        total: max,
        used: max - value
      };
    }
  }

  const pactLevel = numberValue(spells.pact?.level);
  const pactMax = numberValue(spells.pact?.max ?? spells.pact?.override);
  if (pactLevel > 0 && pactMax > 0) {
    const pactValue = Math.max(0, Math.min(pactMax, numberValue(spells.pact.value, pactMax)));
    const current = result[pactLevel] ?? { total: 0, used: 0 };
    result[pactLevel] = {
      total: current.total + pactMax,
      used: current.used + pactMax - pactValue
    };
  }

  return result;
}

function conditionData(actor) {
  const aliases = {
    blinded: "blinded", charmed: "charmed", deafened: "deafened", frightened: "frightened",
    grappled: "grappled", incapacitated: "incapacitated", invisible: "invisible", paralyzed: "paralyzed",
    petrified: "petrified", poisoned: "poisoned", prone: "prone", restrained: "restrained",
    stunned: "stunned", unconscious: "unconscious", exhaustion: "exhaustion"
  };
  const result = new Set();
  for (const effect of actor.effects ?? []) {
    if (effect.disabled) continue;
    const statuses = effect.statuses instanceof Set ? [...effect.statuses] : Array.isArray(effect.statuses) ? effect.statuses : [];
    for (const status of statuses) {
      const id = aliases[String(status).toLowerCase()] ?? String(status).toLowerCase().split(".").pop();
      if (id) result.add(id);
    }
    const name = String(effect.name ?? "").toLowerCase();
    for (const key of Object.keys(aliases)) if (name.includes(key)) result.add(key);
  }
  return [...result];
}

function tokenConditionData(token) {
  const raw = token?.document?.statuses ?? token?.statuses;
  const statuses = raw == null ? [] : Array.isArray(raw) ? raw : [...raw];
  return statuses.map(status => String(status).toLowerCase().split('.').pop()).filter(Boolean);
}

function itemData(actor) {
  const actions = [];
  const abilities = [];
  const spells = [];
  for (const item of actor.items ?? []) {
    if (!item?.name) continue;
    const entry = {
      name: item.name,
      description: String(item.system?.description?.value ?? item.system?.description ?? ""),
      category: item.type === "spell" ? "spell" : item.type === "weapon" ? "attack" : "ability"
    };
    if (item.type === "spell") spells.push(entry);
    else if (item.type === "weapon") actions.push(entry);
    else if (["feat", "class", "subclass", "background"].includes(item.type)) abilities.push(entry);
  }
  return { actions, abilities, spells };
}

function canonicalValue(value) {
  if (Object.prototype.toString.call(value) === "[object Set]") return canonicalValue(Array.from(value));
  if (Array.isArray(value)) return value.map(canonicalValue).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalValue(value[key])]));
  }
  return value;
}

function sourceDigest(source) {
  let hash = 0x811c9dc5;
  for (const character of JSON.stringify(canonicalValue(source))) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function soleTokenId(actor) {
  const tokens = actor.getActiveTokens?.() ?? [];
  if (tokens.length !== 1) return undefined;
  const tokenId = tokens[0]?.document?.id ?? tokens[0]?.id;
  return typeof tokenId === "string" && tokenId ? tokenId : undefined;
}

function actorPayload(actor, extra = {}) {
  const attributes = actor.system?.attributes ?? {};
  const hp = attributes.hp ?? {};
  const ac = attributes.ac;
  const abilities = actor.system?.abilities ?? {};
  const traits = actor.system?.traits ?? {};

  const stats = Object.fromEntries(
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].map(key => [
      key,
      { value: numberValue(abilities[key]?.value), mod: numberValue(abilities[key]?.mod) }
    ])
  );

  const traitList = (field) => {
    const raw = traits[field]?.value;
    if (!raw) return [];
    if (raw instanceof Set) return [...raw];
    if (Array.isArray(raw)) return raw;
    return Object.keys(raw).filter(k => raw[k]);
  };
  const { actions, abilities: itemAbilities, spells } = itemData(actor);
  const speed = `${numberValue(attributes.movement?.walk)} ft.`;
  const source = {
    hp: hp.value,
    maxHp: hp.max,
    tempHp: hp.temp,
    ac: ac?.value ?? ac,
    speed,
    stats,
    traits,
    items: [...(actor.items ?? [])].map(item => ({ id: item.id, type: item.type, name: item.name, equipped: item.system?.equipped })),
    effects: [...(actor.effects ?? [])].map(effect => ({ id: effect.id, disabled: effect.disabled, statuses: effect.statuses }))
  };

  return {
    actorId: actor.id,
    _id: actor.id,
    name: actor.name,
    hp: numberValue(hp.value),
    tempHp: numberValue(hp.temp),
    maxHp: numberValue(hp.max),
    ac: numberValue(ac?.value ?? ac),
    spellSlots: spellSlotData(actor.system?.spells),
    speed,
    stats,
    resistances: traitList('dr'),
    vulnerabilities: traitList('dv'),
    damageImmunities: traitList('di'),
    conditionImmunities: traitList('ci'),
    actions,
    abilities: itemAbilities,
    spells,
    worldId: game.world?.id,
    sourceHash: sourceDigest(source),
    lastSyncedAt: new Date().toISOString(),
    ...extra
  };
}

const revisions = new Map();
const pendingActors = new Map();
const actorDebounces = new Map();
let syncQueue = Promise.resolve();

function isSyncGM() {
  return game.user?.isGM && game.users.activeGM?.id === game.user.id;
}

function connection() {
  const appUrl = String(game.settings.get(MODULE_ID, "appUrl") || "").replace(/\/$/, "");
  const token = String(game.settings.get(MODULE_ID, "token") || "").trim();
  return appUrl && token ? { appUrl, token } : null;
}

function requestSync(suffix = "", body) {
  const { appUrl, token } = connection();
  return fetch(`${appUrl}/api/foundry/live-sync${suffix}`, {
    method: body ? "POST" : "GET",
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}

function enqueueSync(work) {
  syncQueue = syncQueue.then(work).catch(error => {
    console.warn("Initiative Tracker live sync unavailable", error);
  });
  return syncQueue;
}

function scheduleActorSync(actor, extra = {}, preservePending = false) {
  if (!isSyncGM() || !actor) return;
  const existing = actorDebounces.get(actor.id);
  if (existing) clearTimeout(existing.timer);
  const debounce = {
    extra: preservePending && existing ? { ...existing.extra, ...extra } : extra,
    timer: null
  };
  debounce.timer = setTimeout(() => {
    if (actorDebounces.get(actor.id) !== debounce) return;
    actorDebounces.delete(actor.id);
    pendingActors.set(actor.id, actorPayload(actor, debounce.extra));
    return enqueueSync(flushActors);
  }, 100);
  actorDebounces.set(actor.id, debounce);
}

async function flushActors() {
  if (!isSyncGM() || !connection()) return;
  for (const [actorId, payload] of pendingActors) {
    if (!isSyncGM()) return;
    const response = await requestSync("", { ...payload, revision: revisions.get(actorId) ?? 0 });
    if (response.status === 409 || response.status === 404) {
      if (pendingActors.get(actorId) === payload) pendingActors.delete(actorId);
      console.warn(`Initiative Tracker skipped ${actorId}: ${response.status === 409 ? "newer tracker HP will be applied" : "actor is not imported"}`);
      continue;
    }
    if (!response.ok) throw new Error(`Live sync failed: ${response.status}`);
    const result = await response.json();
    revisions.set(actorId, result.revision);
    if (pendingActors.get(actorId) === payload) pendingActors.delete(actorId);
  }
}

async function pollUpdates() {
  if (!isSyncGM() || !connection()) return;
  await flushActors();
  const response = await requestSync();
  if (!response.ok) throw new Error(`Live sync failed: ${response.status}`);
  const { actors } = await response.json();
  for (const update of actors) {
    if (!isSyncGM()) return;
    if (pendingActors.has(update.actorId)) continue;
    const actor = game.actors.get(update.actorId);
    if (!actor) continue;
    if (![update.hp, update.tempHp, update.revision].every(value => Number.isSafeInteger(value) && value >= 0)) continue;
    if (update.pending) {
      const hp = actor.system?.attributes?.hp ?? {};
      const changes = {};
      if (hp.value !== update.hp || numberValue(hp.temp) !== update.tempHp) {
        changes["system.attributes.hp.value"] = update.hp;
        changes["system.attributes.hp.temp"] = update.tempHp;
      }
      for (let level = 1; level <= 9; level += 1) {
        const slot = update.spellSlots?.[level];
        if (slot && Number.isSafeInteger(slot.total) && Number.isSafeInteger(slot.used)) {
          changes[`system.spells.spell${level}.value`] = Math.max(0, slot.total - slot.used);
        }
      }
      if (Object.keys(changes).length > 0) {
        await actor.update(changes, { [MODULE_ID]: true });
      }
      const combatant = game.combat?.combatants?.find(entry => entry.actorId === update.actorId);
      if (combatant && Number.isSafeInteger(update.initiative) && combatant.initiative !== update.initiative) {
        await combatant.update({ initiative: update.initiative }, { [MODULE_ID]: true });
      }
      if (combatant && Array.isArray(update.conditions)) {
        const token = combatant.token?.object ?? actor.getActiveTokens?.()[0];
        if (token?.toggleStatusEffect || token?.toggleEffect) {
          const current = new Set(conditionData(actor));
          const toggle = async (condition, active) => {
            if (token.toggleStatusEffect) return token.toggleStatusEffect(condition, { active });
            const effect = CONFIG.statusEffects?.find(entry => entry.id === condition || entry.id.endsWith(`.${condition}`));
            if (effect) return token.toggleEffect(effect, { active });
          };
          for (const condition of current) if (!update.conditions.includes(condition)) await toggle(condition, false);
          for (const condition of update.conditions) if (!current.has(condition)) await toggle(condition, true);
        }
      }
      const acknowledged = await requestSync("/ack", { actorId: update.actorId, revision: update.revision });
      if (acknowledged.status === 409) continue;
      if (!acknowledged.ok) throw new Error(`Live sync acknowledgement failed: ${acknowledged.status}`);
    }
    revisions.set(update.actorId, update.revision);
  }
}

async function pollLoop() {
  await enqueueSync(pollUpdates);
  setTimeout(pollLoop, 1000);
}

Hooks.once("ready", () => {
  for (const actor of game.actors?.contents ?? []) {
    pendingActors.set(actor.id, actorPayload(actor));
  }
  for (const combatant of game.combat?.combatants ?? []) {
    if (combatant.actor) pendingActors.set(combatant.actor.id, actorPayload(combatant.actor, { initiative: numberValue(combatant.initiative) }));
  }
  return pollLoop();
});

Hooks.on("updateActor", (actor, _changes, options = {}) => {
  if (!isSyncGM() || options[MODULE_ID]) return;
  if (actorDebounces.has(actor.id)) return scheduleActorSync(actor, {}, true);
  pendingActors.set(actor.id, actorPayload(actor));
  return enqueueSync(flushActors);
});

Hooks.on("updateCombatant", (combatant, _changes, options = {}) => {
  if (!isSyncGM() || options[MODULE_ID] || !combatant.actor) return;
  pendingActors.set(combatant.actor.id, actorPayload(combatant.actor, { initiative: numberValue(combatant.initiative) }));
  return enqueueSync(flushActors);
});

Hooks.on("updateToken", (token, _changes, options = {}) => {
  if (!isSyncGM() || options[MODULE_ID] || !token.actor) return;
  const conditions = tokenConditionData(token);
  return scheduleActorSync(token.actor, {
    conditions,
    ...(token.document?.id ?? token.id ? { tokenId: token.document?.id ?? token.id } : {})
  });
});

for (const event of ["createItem", "updateItem", "deleteItem", "createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) {
  Hooks.on(event, (document, _changes, options = {}) => {
    if (options[MODULE_ID]) return;
    const actor = document.actor ?? document.parent?.actor ?? document.parent;
    const tokenId = soleTokenId(actor);
    scheduleActorSync(actor, tokenId ? { tokenId } : {});
  });
}
