import test from 'node:test';
import assert from 'node:assert/strict';
import {demoHistory,evaluate,predict} from '../src/estimates.js';
test('completion model has reproducible chronological evaluation and beats service baseline on synthetic holdout',()=>{const a=evaluate(demoHistory());assert.deepEqual(a,evaluate(demoHistory()));assert.equal(a.trainingRows,192);assert.equal(a.holdoutRows,48);assert.ok(a.maeHours<a.baselineMAEHours);assert.ok(predict(a.weights,{serviceHours:48,itemCount:8,workload:30})>predict(a.weights,{serviceHours:48,itemCount:2,workload:1}));});
