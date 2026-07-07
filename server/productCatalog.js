import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const catalogPath = path.join(rootDir, 'data', 'ebay_titles_skus_in_display_order.csv');
let cachedCatalog;

export async function enrichRowsWithProducts(rows) {
  const catalog = await loadProductCatalog();
  return rows.map((row) => {
    const title = row.matched_item_title || row.source_item_title || '';
    const sku = findSkuForTitle(catalog, title);

    return {
      ...row,
      product_sku: sku,
      product_handle: sku ? slugForHandle(sku) : ''
    };
  });
}

export async function loadProductCatalog() {
  if (cachedCatalog) return cachedCatalog;

  try {
    const csv = await fs.readFile(catalogPath, 'utf8');
    const [, ...records] = parseCsv(csv);
    cachedCatalog = records
      .map(([title, sku]) => ({
        title: cleanTitle(title),
        normalizedTitle: normalizeTitle(title),
        sku: cleanText(sku)
      }))
      .filter((record) => record.title && record.sku);
  } catch {
    cachedCatalog = [];
  }

  return cachedCatalog;
}

export function findSkuForTitle(catalog, title = '') {
  const normalized = normalizeTitle(title);
  if (!normalized) return '';

  const exact = catalog.find((record) => record.normalizedTitle === normalized);
  if (exact) return exact.sku;

  const contains = catalog.find((record) => {
    return normalized.includes(record.normalizedTitle) || record.normalizedTitle.includes(normalized);
  });
  return contains?.sku || '';
}

export function parseCsv(csv) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else if (char !== '\r') {
      value += char;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

export function slugForHandle(value = '') {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanTitle(value = '') {
  return cleanText(value).replace(/\s+\(#\d+\)\s*$/i, '');
}

function normalizeTitle(value = '') {
  return cleanTitle(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(value = '') {
  return String(value).replace(/\s+/g, ' ').trim();
}
