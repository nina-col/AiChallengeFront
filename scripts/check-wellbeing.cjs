const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, { exports });
  return exports;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const { EMPTY_SESSION, sessionReducer: reduce, sessionRemaining, zenDuration, guideIndex } = load('src/lib/zen-session.ts');
const { selectedDomainIds, checkinOrder } = load('src/lib/checkin-route.ts');
const all = ['sound', 'light', 'sight', 'body'];
assert.deepEqual(plain(selectedDomainIds(undefined, all)), all);
assert.deepEqual(plain(selectedDomainIds(['light', 'bogus'], all)), ['light']);
assert.deepEqual(plain(selectedDomainIds([], all)), []);
const short = checkinOrder(false, ['light']);
assert.equal(short.includes('sound'), false);
assert.equal(short.includes('body'), false);
assert.equal(short.includes('place'), false);
assert.ok(short.length < checkinOrder(true, all).length);
assert.equal(zenDuration('garden', 300), 120);
assert.equal(zenDuration('grounding', 300), 300);
assert.equal(zenDuration('breathing', 17), 120);
let session = reduce(EMPTY_SESSION, { type: 'start', duration: 120, now: 1000 });
assert.equal(session.deadline, 121000);
assert.equal(guideIndex(session), 0);
const protectedSession = reduce(session, { type: 'start', duration: 300, now: 1001 });
assert.equal(protectedSession, session); // Double taps cannot extend a running session.
session = reduce(session, { type: 'tick', now: 31000 });
assert.equal(guideIndex(session), 1);
session = reduce(session, { type: 'pause', now: 51000 });
assert.equal(session.remainingMs, 70000);
assert.equal(session.status, 'paused');
assert.equal(sessionRemaining(session, 1000000), 70000);
session = reduce(session, { type: 'resume', now: 1000000 });
assert.equal(session.deadline, 1070000);
assert.equal(sessionRemaining(session, 1070000), 0); // Game input must stop even before the next timer callback.
session = reduce(session, { type: 'tick', now: 2000000 });
assert.equal(session.status, 'done'); // Delayed timers still respect the deadline.
assert.equal(session.remainingMs, 0);
assert.equal(reduce(session, { type: 'resume', now: 3000000 }).status, 'done');
assert.equal(reduce(session, { type: 'start', duration: 120, now: 3000000 }).status, 'done');
session = reduce(EMPTY_SESSION, { type: 'start', duration: 60, now: 0 });
assert.equal(reduce(session, { type: 'pause', now: 61000 }).status, 'done');
assert.equal(reduce(session, { type: 'finish', now: 10 }).status, 'done');
console.log('Wellbeing: targeted routing, deadline cutoff, double starts, pause/resume, delayed callbacks and terminal completion passed.');
