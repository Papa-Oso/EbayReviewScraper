import test from 'node:test';
import assert from 'node:assert/strict';
import { feedbackKeyFor, starRatingFor, withStarRating } from './feedbackStore.js';

test('feedback ratings map to numeric stars', () => {
  assert.equal(starRatingFor('positive'), 5);
  assert.equal(starRatingFor('neutral'), 2);
  assert.equal(starRatingFor('negative'), 1);
  assert.equal(starRatingFor(''), '');
});

test('feedback keys are stable for identical rows', () => {
  const row = {
    feedback_id: '123',
    seller_username: 'seller',
    source_item_id: '456',
    feedback_text: 'Great'
  };

  assert.equal(feedbackKeyFor(row), feedbackKeyFor({ ...row }));
});

test('withStarRating adds csv-ready star field', () => {
  assert.deepEqual(withStarRating({ rating: 'neutral', feedback_text: 'Okay' }), {
    rating: 'neutral',
    feedback_text: 'Okay',
    star_rating: 2
  });
});
