const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/lib/mascot-motion.ts'), 'utf8');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsObject });
const { MASCOT_REST, MASCOT_DURATION_MS, MASCOT_FRAME_MS, mascotMotionReducer: reduce, mascotCell } = exportsObject;
let state = reduce(MASCOT_REST, { type: 'start', now: 1000 });
assert.equal(state.frame, 0);
assert.equal(reduce(state, { type: 'start', now: 1100 }), state); // Rapid taps cannot extend the animation.
state = reduce(state, { type: 'tick', now: 1000 + MASCOT_FRAME_MS });
assert.equal(state.frame, 1);
state = reduce(state, { type: 'tick', now: 1000 + 2 * MASCOT_FRAME_MS });
assert.equal(state.frame, 2);
assert.equal(reduce(state, { type: 'cancel' }).frame, 0); // Reduced motion, blur and background return to rest.
assert.equal(reduce(state, { type: 'cancel' }).startedAt, null);
state = reduce(state, { type: 'tick', now: 1000 + MASCOT_DURATION_MS + 9000 });
assert.equal(state.frame, 0);
assert.equal(state.startedAt, null); // Late callbacks never leave the sprite cycling.
assert.equal(reduce(state, { type: 'tick', now: 99999 }), state);
state = reduce(state, { type: 'start', now: 20000 });
assert.equal(state.startedAt, 20000); // Deliberate replay is possible after rest.
for (let frame = 0; frame < 4; frame++) {
  const cell = mascotCell(frame);
  assert.equal(cell.column >= 0 && cell.column < 2, true);
  assert.equal(cell.row >= 0 && cell.row < 2, true);
  assert.equal(cell.row * 2 + cell.column, frame);
}
console.log('Mascot: one-shot limit, rapid taps, cancellation, delayed callbacks, replay and sprite cells passed.');
