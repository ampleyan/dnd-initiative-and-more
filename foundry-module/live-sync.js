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
    maxHp: numberValue(hp.max),
    ac: numberValue(ac?.value ?? ac),
    spellSlots: spellSlotData(actor.system?.spells)
  };
}

async function syncActor(actor) {
  if (!game.user?.isGM) return;

  const appUrl = String(game.settings.get(MODULE_ID, "appUrl") || "").replace(/\/$/, "");
  const token = String(game.settings.get(MODULE_ID, "token") || "").trim();
  if (!appUrl || !token) return;

  try {
    const response = await fetch(`${appUrl}/api/foundry/live-sync`, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(actorPayload(actor))
    });
    if (!response.ok) {
      console.warn(`Initiative Tracker live sync failed: ${response.status}`);
    }
  } catch (error) {
    console.warn("Initiative Tracker live sync unavailable", error);
  }
}

Hooks.on("updateActor", actor => {
  void syncActor(actor);
});
