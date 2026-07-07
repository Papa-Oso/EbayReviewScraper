import test from 'node:test';
import assert from 'node:assert/strict';
import { findSkuForTitle, parseCsv, slugForHandle } from './productCatalog.js';

test('product catalog csv parser handles quoted titles', () => {
  assert.deepEqual(parseCsv('Title,SKU\n"Widget, Large",ABC-123\n'), [
    ['Title', 'SKU'],
    ['Widget, Large', 'ABC-123']
  ]);
});

test('product sku can be matched from ebay item titles', () => {
  const catalog = [
    {
      title: 'HJC Helmet Adapter Mount for Cardo Packtalk Edge / Neo / Pro / Custom',
      normalizedTitle: 'hjc helmet adapter mount for cardo packtalk edge neo pro custom',
      sku: 'JW-HJC-EDGE-001'
    }
  ];

  assert.equal(
    findSkuForTitle(catalog, 'HJC Helmet Adapter Mount for Cardo Packtalk Edge / Neo / Pro / Custom (#327029277067)'),
    'JW-HJC-EDGE-001'
  );
});

test('bmw z3 visor title maps to shopify product handle', () => {
  const catalog = [
    {
      title: 'BMW Z3 and M Roadster Sun Visor Delete Block off / Blank Plates (2x, Pair)',
      normalizedTitle: 'bmw z3 and m roadster sun visor delete block off blank plates 2x pair',
      sku: 'JW-Z3-VISOR-001'
    }
  ];

  const sku = findSkuForTitle(catalog, 'BMW Z3 and M Roadster Sun Visor Delete Block off / Blank Plates (2x, Pair)');
  assert.equal(sku, 'JW-Z3-VISOR-001');
  assert.equal(slugForHandle(sku), 'jw-z3-visor-001');
});

test('sku handles are import safe', () => {
  assert.equal(slugForHandle('JW-HJC-EDGE-001'), 'jw-hjc-edge-001');
});
