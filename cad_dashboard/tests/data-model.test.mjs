import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateDataset, summarize, pairType, csvCell } from '../data-model.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const fixture = () => read('../data/template.json');

test('published dataset follows the import contract', () => {
  validateDataset(read('../data/experiment.json'));
});
test('demo records never produce measured metrics', () => {
  const d = fixture(); d.isDemo = true; d.samples[0].methods.ours.metrics.cd = .123;
  validateDataset(d); assert.equal(summarize(d), null);
});
test('unknown records stay in the global denominator and missing CD is not zero', () => {
  const d = fixture(); d.samples[0].methods.ours.status = 'pass';
  const other = structuredClone(d.samples[0]); other.id = 'SECOND'; other.methods.ours.status = 'unknown'; d.samples.push(other);
  validateDataset(d); const summary = summarize(d);
  assert.equal(summary.total, 2); assert.deepEqual(summary.methods[1], { pass: 1, fail: 0, unknown: 1 }); assert.equal(summary.paired, 0);
  assert.equal(pairType(other, d.methods), 'unknown');
});
test('both sides must have actual CD values for paired geometry count', () => {
  const d = fixture(); d.samples[0].methods.baseline.metrics.cd = 0; d.samples[0].methods.ours.metrics.cd = .12;
  validateDataset(d); assert.equal(summarize(d).paired, 1);
  d.samples[0].methods.baseline.metrics.cd = null; assert.equal(summarize(d).paired, 0);
});
test('rejects duplicate IDs, invalid metrics and missing paired methods', () => {
  const d = fixture(); d.samples.push(structuredClone(d.samples[0])); assert.throws(() => validateDataset(d), /重复/);
  d.samples.pop(); d.samples[0].methods.ours.metrics.iou = 1.01; assert.throws(() => validateDataset(d), /iou/);
  d.samples[0].methods.ours.metrics.iou = null; delete d.samples[0].methods.baseline; assert.throws(() => validateDataset(d), /status/);
});
test('real experiment rejects generated demo geometry', () => {
  const d = fixture(); d.samples[0].methods.ours.steps[0].geometry = { kind: 'demo', shape: 'flange' }; assert.throws(() => validateDataset(d), /demo/);
});
test('CSV quotes fields and neutralizes spreadsheet formulas', () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""'); assert.equal(csvCell('=1+1'), '"\'=1+1"'); assert.equal(csvCell(null), '""');
});
