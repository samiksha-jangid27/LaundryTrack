import test from 'node:test';
import assert from 'node:assert/strict';
import { filterOrders } from '../src/lib/order-filters.js';

test('order filters combine stage, customer search and staff assignment without mutating the list', () => {
  const rows = [
    {
      id: 'a',
      number: 'LT-100',
      customer_name: 'Sam',
      stage: 'booked',
      assigned_to: 'staff',
      created_at: '2026-01-01',
      pickup_date: '2026-01-03',
      slot: '09:00',
      total: 100,
    },
    {
      id: 'b',
      number: 'LT-101',
      customer_name: 'Sam',
      stage: 'cleaning',
      assigned_to: null,
      created_at: '2026-01-02',
      pickup_date: '2026-01-02',
      slot: '09:00',
      total: 300,
    },
    {
      id: 'c',
      number: 'LT-102',
      customer_name: 'Riya',
      stage: 'delivered',
      assigned_to: 'staff',
      created_at: '2026-01-03',
      pickup_date: '2026-01-01',
      slot: '09:00',
      total: 200,
    },
  ];
  assert.deepEqual(
    filterOrders(rows, { search: ' SAM ', mine: true, userId: 'staff' }).map((row) => row.id),
    ['a'],
  );
  assert.deepEqual(
    filterOrders(rows).map((row) => row.id),
    ['b', 'a'],
  );
  assert.deepEqual(
    filterOrders(rows, { stage: 'all', sort: 'pickup' }).map((row) => row.id),
    ['c', 'b', 'a'],
  );
  assert.deepEqual(
    filterOrders(rows, { stage: 'all', sort: 'amount' }).map((row) => row.id),
    ['b', 'c', 'a'],
  );
  assert.deepEqual(
    rows.map((row) => row.id),
    ['a', 'b', 'c'],
  );
});
