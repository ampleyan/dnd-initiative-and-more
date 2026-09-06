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

function actorPayload(actor) {
  const attributes = actor.system?.attributes ?? {};
  const hp = attributes.hp ?? {};
  const ac = attributes.ac;
  return {
    actorId: actor.id,
    _id: actor.id,
    name: actor.name,
    hp: numberValue(hp.value),
    tempHp: numberValue(hp.temp),
    maxHp: numberValue(hp.max),
    ac: numberValue(ac?.value ?? ac),
    spellSlots: spellSlotData(actor.system?.spells)
  };
}

const revisions = new Map();
const pendingActors = new Map();
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
      if (hp.value !== update.hp || numberValue(hp.temp) !== update.tempHp) {
        await actor.update({
          "system.attributes.hp.value": update.hp,
          "system.attributes.hp.temp": update.tempHp
        }, { [MODULE_ID]: true });
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

Hooks.once("ready", pollLoop);

Hooks.on("updateActor", (actor, _changes, options = {}) => {
  if (!isSyncGM() || options[MODULE_ID]) return;
  pendingActors.set(actor.id, actorPayload(actor));
  return enqueueSync(flushActors);
});
