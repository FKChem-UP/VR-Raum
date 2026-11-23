"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const F = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/mirror-tutorial.js"), "utf8"), {window: {FKCVR: F}});
const {atoms, project, plane, reflect, solution, check} = F.MirrorTutorial;
const near = (a, b) => Math.hypot(...a.map((p, k) => p - b[k])) < 1e-8;
assert.equal(new Set(atoms.map(p => project(1, p)[0])).size, 4, "Getrennte Atomzentren in der Seitenansicht");
for (const view of [0, 1]) {
  const line = solution(view), m = plane(view, ...line);
  assert.ok(check(view, line)); assert.ok(check(view, line.slice().reverse()));
  for (const [i, p] of atoms.entries()) {
    const q = reflect(p, m);
    assert.ok(near(reflect(q, m), p));
    assert.ok(near(q, atoms[view === 0 ? [0, 1, 3, 2][i] : i]));
  }
  assert.equal(check(view, [[0, 0], [0, 0]]), null);
  assert.equal(check(view, [[0, 1], [0.1, 1]]), null);
  assert.equal(check(view, [[-1, 0.5], [1, 0.5]]), null);
  assert.ok(check(view, line.map(p => [p[0] + 0.02, p[1] - 0.03])), "Toleranz für Handstrich");
}
for (const f of [2, 3]) {
  assert.equal(check(0, solution(0, f), false), null);
  assert.ok(check(0, solution(0, f), true), "Weitere Spiegelebenen im freien Modus");
}
console.log("BF₃: Projektionen, beide Spiegelungen, Treffertoleranz und freie Symmetriesuche geprüft.");