import { Router } from 'express';

type GetSetting = (key: string) => string | undefined;
type SetSetting = (key: string, value: string) => void;

function hsToRgb(hScale: number, sScale: number): [number, number, number] {
  const l = 0.5;
  if (sScale === 0) return [Math.round(l * 255), Math.round(l * 255), Math.round(l * 255)];
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + sScale) : l + sScale - l * sScale;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, hScale + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, hScale) * 255),
    Math.round(hue2rgb(p, q, hScale - 1 / 3) * 255),
  ];
}

const HUE_EFFECTS: Record<string, { hue: number; sat: number; bri: number; alert: string; transitiontime: number }> = {
  heal:            { hue: 25500, sat: 254, bri: 200, alert: 'lselect', transitiontime: 4  },
  damage:          { hue: 0,     sat: 254, bri: 254, alert: 'select',  transitiontime: 1  },
  creature_downed: { hue: 0,     sat: 220, bri: 100, alert: 'lselect', transitiontime: 10 },
  stabilized:      { hue: 25500, sat: 180, bri: 150, alert: 'select',  transitiontime: 12 },
  condition:       { hue: 46920, sat: 180, bri: 180, alert: 'select',  transitiontime: 4  },
  round_start:     { hue: 46920, sat: 80,  bri: 160, alert: 'select',  transitiontime: 8  },
  death_save_fail: { hue: 0,     sat: 254, bri: 120, alert: 'lselect', transitiontime: 2  },
  death_save_pass: { hue: 25500, sat: 200, bri: 150, alert: 'select',  transitiontime: 4  },
  encounter_end:   { hue: 12750, sat: 254, bri: 254, alert: 'lselect', transitiontime: 4  },
};

export function createLightsRouter(getSetting: GetSetting, setSetting: SetSetting, db: any) {
  const router = Router();

  function getRestoreEffect() {
    const defaultRestore = { hue: 8602, sat: 60, bri: 180, alert: 'none', transitiontime: 20 };
    try {
      const stored = getSetting('hue_restore_state');
      if (stored) return { ...defaultRestore, ...JSON.parse(stored) };
    } catch {}
    return defaultRestore;
  }

  async function hueRequest(method: string, urlPath: string, body?: any) {
    const bridgeIp = getSetting('hue_bridge_ip');
    const username = getSetting('hue_username');
    if (!bridgeIp || !username) throw new Error('Hue not configured');
    const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`http://${bridgeIp}/api/${username}${urlPath}`, opts);
    return res.json();
  }

  async function haRequest(method: string, urlPath: string, body?: any) {
    const haUrl = getSetting('ha_url');
    const haToken = getSetting('ha_token');
    if (!haUrl || !haToken) throw new Error('Home Assistant not configured');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const opts: RequestInit = {
      method, signal: controller.signal,
      headers: { 'Authorization': `Bearer ${haToken}`, 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    try {
      const res = await fetch(`${haUrl.replace(/\/$/, '')}${urlPath}`, opts);
      if (!res.ok) throw new Error(`HA Error: ${res.status} ${res.statusText}`);
      return res.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function triggerHaEffect(effectDef: any, targetLights: string[], briScale: number, effectName: string) {
    if (!targetLights.length) return;
    try {
      const rgb_color = hsToRgb(effectDef.hue / 65535, effectDef.sat / 254);
      const brightness = Math.round(effectDef.bri * briScale);
      await haRequest('POST', '/api/services/light/turn_on', { entity_id: targetLights, rgb_color, brightness, transition: Math.max(0.5, effectDef.transitiontime / 10) });
      if (effectName !== 'encounter_end' && effectDef.alert !== 'lselect') {
        setTimeout(async () => {
          try {
            const restore = getRestoreEffect();
            const restoreRgb = hsToRgb(restore.hue / 65535, restore.sat / 254);
            await haRequest('POST', '/api/services/light/turn_on', { entity_id: targetLights, rgb_color: restoreRgb, brightness: Math.round(restore.bri * briScale), transition: restore.transitiontime / 10 });
          } catch (e) { console.error('HA restore failed', e); }
        }, 3000);
      } else if (effectName === 'encounter_end') {
        setTimeout(async () => { await haRequest('POST', '/api/services/light/turn_on', { entity_id: targetLights, rgb_color: [255, 255, 255], brightness: Math.round(254 * briScale), transition: 1.5 }).catch(() => {}); }, 5000);
        setTimeout(async () => { await haRequest('POST', '/api/services/light/turn_on', { entity_id: targetLights, rgb_color: [255, 200, 0], brightness: Math.round(220 * briScale), transition: 0.8 }).catch(() => {}); }, 8000);
        setTimeout(async () => {
          const restore = getRestoreEffect();
          await haRequest('POST', '/api/services/light/turn_on', { entity_id: targetLights, rgb_color: hsToRgb(restore.hue / 65535, restore.sat / 254), brightness: Math.round(restore.bri * briScale), transition: restore.transitiontime / 10 }).catch(() => {});
        }, 15000);
      }
    } catch (e) { console.error('HA effect failed:', e); }
  }

  // ── Image proxy (used by Hue scene color extraction) ──
  const ALLOWED_IMAGE_HOSTS = new Set([
    'www.dndbeyond.com', 'dndbeyond.com', 'media.dndbeyond.com',
    'www.gmbinder.com', 'i.imgur.com', 'imgur.com',
    'cdn.discordapp.com', 'media.discordapp.net',
    'raw.githubusercontent.com', 'pbs.twimg.com',
    'www.dropbox.com', 'dl.dropboxusercontent.com',
    '5e.tools', 'img.5e.tools',
  ]);

  router.get('/image-proxy', async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl || !/^https?:\/\//.test(targetUrl)) return res.status(400).send('Invalid URL');
    let parsedHost: string;
    try { parsedHost = new URL(targetUrl).hostname.toLowerCase(); } catch { return res.status(400).send('Invalid URL'); }
    if (!ALLOWED_IMAGE_HOSTS.has(parsedHost)) return res.status(403).send(`Image host not allowed: ${parsedHost}`);
    try {
      const upstream = await fetch(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Accept': 'image/webp,image/avif,image/*,*/*;q=0.8', 'Referer': targetUrl },
      });
      if (!upstream.ok) return res.status(upstream.status).send(`Upstream returned ${upstream.status}`);
      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/') && !contentType.includes('octet-stream')) return res.status(400).send('Not an image');
      res.setHeader('Content-Type', contentType.startsWith('image/') ? contentType : 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch (err) {
      console.error('[image-proxy] error:', err);
      if (!res.headersSent) res.status(500).send('Proxy failed');
    }
  });

  // ── Home Assistant ──
  router.get('/ha/config', (req, res) => {
    res.json({
      url:      getSetting('ha_url') ?? '',
      token:    getSetting('ha_token') ?? '',
      lightIds: (() => { try { return JSON.parse(getSetting('ha_light_ids') ?? '[]'); } catch { return []; } })(),
      enabled:  getSetting('ha_enabled') === 'true',
    });
  });

  router.post('/ha/config', (req, res) => {
    const { url, token, lightIds, enabled } = req.body;
    if (url !== undefined) setSetting('ha_url', url);
    if (token !== undefined) setSetting('ha_token', token);
    if (lightIds !== undefined) setSetting('ha_light_ids', JSON.stringify(lightIds));
    if (enabled !== undefined) setSetting('ha_enabled', enabled ? 'true' : 'false');
    res.json({ ok: true });
  });

  router.get('/ha/lights', async (req, res) => {
    try {
      const states = await haRequest('GET', '/api/states');
      res.json(states.filter((s: any) => s.entity_id.startsWith('light.')));
    } catch {
      res.json([]);
    }
  });

  // ── Philips Hue ──
  router.get('/hue/discover', async (req, res) => {
    try {
      const r = await fetch('https://discovery.meethue.com/');
      res.json({ bridges: await r.json(), savedIp: getSetting('hue_bridge_ip') ?? '', savedUsername: getSetting('hue_username') ?? '' });
    } catch (e: any) {
      res.status(502).json({ error: e.message });
    }
  });

  router.post('/hue/pair', async (req, res) => {
    const { bridgeIp } = req.body as { bridgeIp: string };
    if (!bridgeIp) return res.status(400).json({ error: 'bridgeIp required' });
    try {
      const result = await fetch(`http://${bridgeIp}/api`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ devicetype: 'dnd_tracker#server', generateclientkey: true }) });
      const data = await result.json() as any[];
      if (data[0]?.error) return res.status(400).json({ error: data[0].error.description });
      const username = data[0]?.success?.username;
      if (!username) return res.status(400).json({ error: 'No username returned — did you press the bridge button?' });
      setSetting('hue_bridge_ip', bridgeIp);
      setSetting('hue_username', username);
      res.json({ username, bridgeIp });
    } catch (e: any) { res.status(502).json({ error: e.message }); }
  });

  router.get('/hue/lights', async (req, res) => {
    try { res.json(await hueRequest('GET', '/lights')); }
    catch (e: any) { res.status(502).json({ error: e.message }); }
  });

  router.get('/hue/config', (req, res) => {
    res.json({
      bridgeIp:       getSetting('hue_bridge_ip') ?? '',
      username:       getSetting('hue_username') ?? '',
      enabled:        getSetting('hue_enabled') !== 'false',
      lightIds:       (() => { try { return JSON.parse(getSetting('hue_light_ids') ?? '[]'); } catch { return []; } })(),
      enabledEffects: (() => { try { return JSON.parse(getSetting('hue_enabled_effects') ?? '{}'); } catch { return {}; } })(),
      brightness:     parseInt(getSetting('hue_brightness') ?? '100'),
      syncSceneColor: getSetting('hue_sync_scene') === 'true',
    });
  });

  router.post('/hue/config', (req, res) => {
    const { lightIds, enabled, enabledEffects, brightness, bridgeIp, syncSceneColor } = req.body;
    if (bridgeIp !== undefined) setSetting('hue_bridge_ip', bridgeIp);
    if (enabled !== undefined) setSetting('hue_enabled', enabled ? 'true' : 'false');
    if (lightIds !== undefined) setSetting('hue_light_ids', JSON.stringify(lightIds));
    if (enabledEffects !== undefined) setSetting('hue_enabled_effects', JSON.stringify(enabledEffects));
    if (brightness !== undefined) setSetting('hue_brightness', String(brightness));
    if (syncSceneColor !== undefined) setSetting('hue_sync_scene', syncSceneColor ? 'true' : 'false');
    res.json({ ok: true });
  });

  router.post('/hue/scene-color', async (req, res) => {
    const { colors, hueEnabled, haEnabled } = req.body as { colors: string[]; hueEnabled?: boolean; haEnabled?: boolean };
    if (!colors || !colors.length) {
      db.prepare('DELETE FROM settings WHERE key = ?').run('hue_restore_state');
      return res.json({ ok: true, cleared: true });
    }
    const targetLights: string[] = (hueEnabled ?? getSetting('hue_enabled') !== 'false') ? (() => { try { return JSON.parse(getSetting('hue_light_ids') ?? '[]'); } catch { return []; } })() : [];
    const targetHaLights: string[] = (haEnabled ?? getSetting('ha_enabled') === 'true') ? (() => { try { return JSON.parse(getSetting('ha_light_ids') ?? '[]'); } catch { return []; } })() : [];
    if (!targetLights.length && !targetHaLights.length) return res.json({ ok: true, skipped: 'no lights' });

    const briScale = parseInt(getSetting('hue_brightness') ?? '100') / 100;
    const bri = 180;
    const hexToHS = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0;
      if (max !== min) {
        const d = max - min, l = (max + min) / 2;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      return { hue: Math.round(h * 65535), sat: Math.round(s * 254) };
    };

    try {
      const huePromises = targetLights.map((id, index) => {
        const hex = colors[index % colors.length];
        const { hue, sat } = hexToHS(hex);
        const state = { hue, sat, bri: Math.round(bri * briScale), transitiontime: 60 };
        if (index === 0) setSetting('hue_restore_state', JSON.stringify({ ...state, alert: 'none' }));
        return hueRequest('PUT', `/lights/${id}/state`, state).catch(() => {});
      });

      let haPromise = Promise.resolve<any>(undefined);
      if (targetHaLights.length) {
        const hex = colors[0];
        const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        haPromise = haRequest('POST', '/api/services/light/turn_on', { entity_id: targetHaLights, rgb_color: [r, g, b], brightness: Math.round(bri * briScale), transition: 6 }).catch(console.error);
      }

      await Promise.all([...huePromises, haPromise]);
      res.json({ ok: true });
    } catch (e: any) { res.status(502).json({ error: e.message }); }
  });

  router.post('/hue/flash', async (req, res) => {
    const { effect, hueEnabled: requestedHueEnabled, haEnabled: requestedHaEnabled } = req.body as { effect: string; hueEnabled?: boolean; haEnabled?: boolean };
    const effectDef = HUE_EFFECTS[effect];
    if (!effectDef) return res.status(400).json({ error: 'Unknown effect' });

    const hueEnabled = requestedHueEnabled ?? getSetting('hue_enabled') !== 'false';
    const haEnabled = requestedHaEnabled ?? getSetting('ha_enabled') === 'true';
    const targetLights: string[] = hueEnabled ? (() => { try { return JSON.parse(getSetting('hue_light_ids') ?? '[]'); } catch { return []; } })() : [];
    const targetHaLights: string[] = haEnabled ? (() => { try { return JSON.parse(getSetting('ha_light_ids') ?? '[]'); } catch { return []; } })() : [];
    if (!targetLights.length && !targetHaLights.length) return res.json({ ok: true, skipped: 'no lights configured' });

    const briScale = parseInt(getSetting('hue_brightness') ?? '100') / 100;
    triggerHaEffect(effectDef, targetHaLights, briScale, effect);
    if (!targetLights.length) return res.json({ ok: true });

    const state = { on: true, hue: effectDef.hue, sat: effectDef.sat, bri: Math.round(effectDef.bri * briScale), alert: effectDef.alert, transitiontime: effectDef.transitiontime };

    try {
      if (effect === 'encounter_end') {
        const phases = [
          { hue: 12750, sat: 254, bri: Math.round(254 * briScale), alert: 'lselect', transitiontime: 4 },
          { hue: 8000,  sat: 80,  bri: Math.round(254 * briScale), alert: 'none',    transitiontime: 15 },
          { hue: 12750, sat: 240, bri: Math.round(220 * briScale), alert: 'select',  transitiontime: 8  },
        ];
        await Promise.all(targetLights.map(id => hueRequest('PUT', `/lights/${id}/state`, phases[0])));
        setTimeout(async () => { await Promise.all(targetLights.map(id => hueRequest('PUT', `/lights/${id}/state`, phases[1]))); }, 5000);
        setTimeout(async () => { await Promise.all(targetLights.map(id => hueRequest('PUT', `/lights/${id}/state`, phases[2]))); }, 8000);
        setTimeout(async () => {
          const restore = getRestoreEffect();
          const restoreState = { hue: restore.hue, sat: restore.sat, bri: Math.round(restore.bri * briScale), transitiontime: restore.transitiontime };
          await Promise.all(targetLights.map(id => hueRequest('PUT', `/lights/${id}/state`, restoreState)));
        }, 15000);
      } else {
        await Promise.all(targetLights.map(id => hueRequest('PUT', `/lights/${id}/state`, state)));
        if (effectDef.alert !== 'lselect') {
          setTimeout(async () => {
            const restore = getRestoreEffect();
            const restoreState = { hue: restore.hue, sat: restore.sat, bri: Math.round(restore.bri * briScale), transitiontime: restore.transitiontime };
            await Promise.all(targetLights.map(id => hueRequest('PUT', `/lights/${id}/state`, restoreState)));
          }, 3000);
        }
      }
      res.json({ ok: true });
    } catch (e: any) { res.status(502).json({ error: e.message }); }
  });

  return router;
}
