import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.js';
test('customer issues retain outlet resolution and audit history',async t=>{const f=await fixture(t);let order=await f.book();order=await f.mutate(order,'issues',{category:'billing',message:'Please clarify the wash and fold charges.'},f.customer);assert.equal(order.issues.length,1);order=await f.mutate(order,`issues/${order.issues[0].id}/resolve`,{resolution:'Explained the item pricing on the booking receipt.'});assert.equal(order.issues[0].status,'resolved');assert.ok(order.events.some(e=>e.kind==='resolved'));});
test('cancellation is only allowed before accepting custody',async t=>{const f=await fixture(t);let order=await f.book();order=await f.mutate(order,'collect',{count:2});const r=await f.customer(`/orders/${order.id}/cancel`,{method:'POST',body:f.action(order)});assert.equal(r.status,409);});
