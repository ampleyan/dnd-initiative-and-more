import { Router } from 'express';

const DDG_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

interface DdgRawResult {
  thumbnail: string;
  image: string;
  title: string;
  url: string;
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function createImagesRouter() {
  const router = Router();

  router.get('/images/search', async (req, res) => {
    const q = (req.query.q as string)?.trim();
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

    if (!q) {
      return res.status(400).json({ error: 'q parameter is required' });
    }

    try {
      const homeRes = await fetch(
        `https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`,
        { headers: DDG_HEADERS },
      );
      if (!homeRes.ok) {
        return res.json({ results: [], hasMore: false, error: 'Image search unavailable' });
      }

      const html = await homeRes.text();
      const vqdMatch = html.match(/vqd=['"]([^'"]+)['"]/);
      if (!vqdMatch) {
        return res.json({ results: [], hasMore: false, error: 'Image search unavailable' });
      }
      const vqd = vqdMatch[1];

      const searchRes = await fetch(
        `https://duckduckgo.com/i.js?q=${encodeURIComponent(q)}&vqd=${encodeURIComponent(vqd)}&o=json&s=${offset}&u=bing&f=,,,,,&l=us-en`,
        { headers: DDG_HEADERS },
      );
      if (!searchRes.ok) {
        return res.json({ results: [], hasMore: false, error: 'Image search unavailable' });
      }

      const data = await searchRes.json() as { results?: DdgRawResult[] };
      const raw = data.results ?? [];
      const results = raw.map(r => ({
        thumb: r.thumbnail,
        image: r.image,
        title: r.title,
        source: extractHostname(r.url),
      }));

      res.json({ results, hasMore: results.length === 24 });
    } catch {
      res.json({ results: [], hasMore: false, error: 'Image search unavailable' });
    }
  });

  return router;
}
