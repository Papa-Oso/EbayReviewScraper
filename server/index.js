import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scrapeEbayFeedback } from './scraper.js';
import { applyFeedbackHistory, resetFeedbackHistory } from './feedbackStore.js';
import { enrichRowsWithProducts } from './productCatalog.js';

const app = express();
const port = process.env.PORT || 4141;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/scrape', async (req, res) => {
  const {
    url,
    mode = 'auto',
    maxItems = 25,
    maxPages = 8,
    allowManualVerification = true,
    useSavedSession = false,
    scanMode = 'full'
  } = req.body ?? {};

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Paste an eBay listing or store URL.' });
    return;
  }

  try {
    const result = await scrapeEbayFeedback({
      inputUrl: url,
      mode,
      maxItems: clampNumber(maxItems, 1, 250, 25),
      maxPages: clampNumber(maxPages, 1, 100, 8),
      allowManualVerification: Boolean(allowManualVerification),
      useSavedSession: Boolean(useSavedSession)
    });

    // Scraped rows are deliberately processed in this order:
    // 1. history filtering decides whether rows are new enough to export,
    // 2. product enrichment maps the surviving rows to Shopify handles.
    const history = await applyFeedbackHistory(result.rows, { scanMode });
    result.rows = await enrichRowsWithProducts(history.rows);
    result.history = history.stats;
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: error.message || 'The scrape failed.',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.post('/api/feedback-history/reset', async (_req, res) => {
  try {
    const stats = await resetFeedbackHistory();
    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: error.message || 'The incremental history reset failed.'
    });
  }
});

app.use(express.static(path.join(rootDir, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(rootDir, 'dist', 'index.html'), (error) => {
    if (error) res.status(404).send('Run npm run dev to start the app.');
  });
});

app.listen(port, () => {
  console.log(`eBay feedback exporter listening on http://127.0.0.1:${port}`);
});

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}
