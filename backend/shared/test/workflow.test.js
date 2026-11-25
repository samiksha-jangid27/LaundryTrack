import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTag, tagPayload, nextStage, bookingTotal, bookingSchema } from '../index.js';
test('opaque garment codes reject arbitrary URLs and personal data', () => {
  assert.equal(parseTag(tagPayload('g-123')), 'g-123');
  assert.equal(parseTag('https://evil.example'), null);
  assert.equal(parseTag('laundrytrack:garment:alice@example.com'), null);
});
test('workflow is ordered and delivered is terminal', () => {
  assert.equal(nextStage('packing'), 'ready');
  assert.equal(nextStage('delivered'), null);
  assert.equal(nextStage('cancelled'), null);
  assert.equal(nextStage('unknown'), null);
});
test('money calculation uses integer paise and rejects unknown services', () => {
  assert.equal(bookingTotal([{ serviceId: 's', quantity: 3 }], [{ id: 's', price: 3500 }]), 10500);
  assert.throws(() => bookingTotal([{ serviceId: 'x', quantity: 1 }], []));
});
test('booking quantities reject fractions and unbounded submissions', () => {
  assert.equal(
    bookingSchema.safeParse({
      address: 'Hostel A',
      phone: '9876543210',
      pickupDate: '2026-11-21',
      slot: '09:00–12:00',
      items: [{ serviceId: 's', quantity: 1.5 }],
    }).success,
    false,
  );
});
