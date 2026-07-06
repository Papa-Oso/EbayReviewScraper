import test from 'node:test';
import assert from 'node:assert/strict';
import { scraperInternals } from './scraper.js';

test('test runner is wired', () => {
  assert.equal(1 + 1, 2);
});

test('seller urls are recognized without store listing discovery', () => {
  assert.equal(scraperInternals.inferMode('https://www.ebay.com/usr/joshswidgets'), 'seller');
  assert.equal(
    scraperInternals.extractSellerUsernameFromUrl('https://www.ebay.com/usr/joshswidgets?_tab=feedback'),
    'joshswidgets'
  );
});

test('ebay error pages stop with a clear message', () => {
  assert.throws(
    () =>
      scraperInternals.throwIfEbayErrorPage(
        '<title>Error Page | eBay</title><body>SORRY Something went wrong on our end Please go back and try again or go to eBay Homepage.</body>',
        'https://www.ebay.com/itm/326840154179'
      ),
    /eBay returned an error page/
  );
});

test('closed browser errors are user readable', () => {
  const error = scraperInternals.normalizeScrapeError(
    new Error('page.goto: Target page, context or browser has been closed')
  );
  assert.match(error.message, /browser window was closed/);
});
