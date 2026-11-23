"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const F = {}, components = {};
const context = {window: {FKCVR: F}, AFRAME: {THREE: {}, registerComponent(name, component) { components[name] = component; }}};
for (const file of ["bragg-tutorial", "tutorial"]) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js", file + ".js"), "utf8"), context);
}
const B = F.Bragg, s = B.initial();
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-10);
const g = B.geometry(B.angleFor(1)), other = B.geometry(B.angleFor(1.5));
assert.ok(g.matched && !other.matched);
close(g.extra, 0.7107); close(other.extra, 1.5 * 0.7107);
close(Math.cos(other.periods * 2 * Math.PI), -1);
for (const geometry of [g, other]) {
  const [start, center, end] = B.lowerPath(geometry);
  for (const edge of [start, end]) close(Math.hypot(edge[0] - center[0], edge[1] - center[1]), geometry.extra / 2);
  close(start[0] * geometry.cos - start[1] * geometry.sin, 0);
  close(end[0] * geometry.cos + end[1] * geometry.sin, 0);
}
close(B.waveComparison(0.25, g.periods)[2], 2);
close(B.waveComparison(0.25, other.periods)[2], 0);
close(B.waveComparison(0.25, 0.25)[2], 1);
const sweep = B.initial();
B.command(sweep, "sweep");
assert.equal(sweep.sweepHold, 3);
B.advance(sweep, 3);
B.advance(sweep, 0.1);
close(sweep.angle, B.angleFor(1) + 0.6);
close(sweep.time, 0);
sweep.angle = 79.8; B.advance(sweep, 0.1);
close(sweep.angle, 79.6); assert.equal(sweep.sweep, -1);
sweep.angle = 10.2; B.advance(sweep, 0.1);
close(sweep.angle, 10.4); assert.equal(sweep.sweep, 1);
B.command(sweep, "sweep"); B.advance(sweep, 0.1); close(sweep.angle, 10.4);
B.command(sweep, "sweep"); B.command(sweep, "bragg");
assert.equal(sweep.sweep, 0); close(sweep.angle, B.angleFor(1));
for (const [source, order, direction] of [["mo", 2, 1], ["mo", 3, -1], ["cu", 1, 1]]) {
  const exact = B.angleFor(order, source);
  Object.assign(sweep, {source, angle: exact - direction * 0.2, sweep: direction, sweepHold: 0, running: true});
  B.advance(sweep, 0.1);
  close(sweep.angle, exact); assert.equal(sweep.sweepHold, 3);
  const time = sweep.time;
  B.advance(sweep, 2.9); close(sweep.angle, exact); assert.ok(sweep.time > time);
  B.advance(sweep, 0.2); close(sweep.angle, exact + direction * 0.6);
}
for (const [source, wavelength] of [["mo", 0.7107], ["cu", 1.5406]]) {
  for (const n of source === "mo" ? [1, 2, 3] : [1]) {
    const result = B.geometry(B.angleFor(n, source), source);
    assert.equal(result.matched, true, `Bragg-Bedingung gilt auch für ungerades n = ${n}`);
    close(result.extra, n * wavelength);
  }
  const off = B.geometry(B.angleFor(1.5, source), source);
  assert.equal(off.matched, false);
  close(off.periods, 1.5);
  assert.ok(B.angleFor(1.5, source) <= 80);
}
assert.equal(B.geometry(0).matched, false);
const fixedAngle = s.angle;
B.command(s, "cu");
close(s.angle, fixedAngle);
assert.equal(B.geometry(s.angle, s.source).matched, false);
B.command(s, "bragg");
assert.equal(B.geometry(s.angle, s.source).matched, true);
B.command(s, "compare");
assert.equal(B.progress(5, true, true, true, s), 6);
B.command(s, "reset");
assert.equal(B.progress(0, false, true, true, s), 0);
assert.equal(B.progress(0, true, false, false, s), 1);
assert.equal(B.progress(1, true, true, false, s), 2);
assert.equal(B.progress(2, true, true, true, s), 3);
B.command(s, "play"); assert.equal(B.progress(3, true, true, true, s), 3);
s.time = 4; assert.equal(B.progress(3, true, true, true, s), 4);
B.command(s, "slow"); assert.equal(B.progress(4, true, true, true, s), 5); close(s.angle, B.angleFor(1));
B.command(s, "compare"); assert.equal(B.progress(5, true, true, true, s), 6);
B.command(s, "play"); assert.equal(B.progress(6, true, true, true, s), 7);
for (let i = 0; i < 90; i++) B.command(s, "plus"); assert.equal(s.angle, 80);
for (let i = 0; i < 90; i++) B.command(s, "minus"); assert.equal(s.angle, 10);
B.command(s, "reset"); assert.deepEqual(s, B.initial());

// Übergang ohne Raumwechsel, mit freier Bewegung und Trigger-Auswahl.
const board = {}, station = {el: {}, state: s, dispose() {}, toggleInfo(id) { return id !== "close"; }};
F.releaseModel = F.invalidateHits = () => {}; B.station = () => station;
const welcomeWalkable = (x, z) => Math.hypot(x, z) >= 2.73;
const room = {isWalkable: welcomeWalkable};
F.app = {activeRoom: room};
const tutorial = Object.assign({board, group: {object3D: {}}, target: {object3D: {visible: true}},
  body: {querySelectorAll: () => []}, el: {components: {}, object3D: {}}}, components["fkc-tutorial"]);
F.Tutorial.active = true; tutorial.beginAnimation();
assert.equal(tutorial.board, board); assert.equal(tutorial.phase, "bragg");
assert.equal(tutorial.selectedAnimation, null);
for (const z of [3, 2, 1, 0.25, 0, -1, -2]) assert.ok(room.isWalkable(-0.55, z), "Weg bis durch die Station bleibt frei");
assert.equal(room.isWalkable(-0.55, 8.1), false);
tutorial.click({el: station.el}); assert.equal(tutorial.selectedAnimation, station.el);
const clickInfo = id => tutorial.click({el: station.el, mesh: {userData: {braggInfo: id}}});
clickInfo("waves"); assert.equal(B.progress(7, true, true, false, s, tutorial.distanceInfoOpened), 7);
clickInfo("distance"); assert.equal(B.progress(7, true, true, false, s, tutorial.distanceInfoOpened), 8);
assert.equal(B.progress(0, false, true, false, s), 0, "Früher Klick ersetzt nicht das Hingehen");
tutorial.animationStep = 5;
assert.equal(F.Tutorial.menuTarget({components: {"fkc-tutorial": tutorial}}, station.el), "compare");
tutorial.close();
assert.equal(room.isWalkable, welcomeWalkable, "Begrüßungsraum erhält seine Kollisionsregel zurück");
assert.equal(room.isWalkable(-0.55, 0.25), false);

const text = [];
const ctx = {fillRect() {}, fillText(value) { text.push(value); }};
tutorial.canvas = {getContext: () => ctx};
tutorial.texture = {};
tutorial.phase = "structure-practice";
tutorial.target.object3D.visible = true;
F.Tutorial.active = true;
tutorial.render();
assert.equal(tutorial.target.object3D.visible, true, "Co-Modell bleibt bis zur ausdrücklichen Fortsetzung erhalten");
assert.equal(tutorial.animation, null);
assert.ok(text.includes("Strukturteil geschafft!"));
assert.equal(tutorial.buttons[0].title, "Teil 2: Bragg-Animation");
tutorial.buttons[0].action();
assert.equal(tutorial.phase, "bragg");
assert.equal(tutorial.board, board);
tutorial.click({el: station.el});
tutorial.animationStep = B.tasks.length;
tutorial.render();
assert.ok(text.includes("Animationsteil geschafft!"));
assert.equal(tutorial.selectedAnimation, station.el, "Animationsauswahl bleibt nach Abschluss bestehen");
assert.equal(F.Tutorial.menuTarget({components: {"fkc-tutorial": tutorial}}, station.el), null, "Freies Üben ohne Pflicht-Hinweis");
assert.equal(tutorial.buttons[1].title, "Zum Begrüßungsraum");
assert.equal(tutorial.buttons[0].title, "Teil 3: Zeichne den Spiegel");
let disposed = false;
F.MirrorTutorial = {station: () => ({dispose() { disposed = true; }})};
tutorial.buttons[0].action();
assert.equal(tutorial.phase, "mirror"); assert.equal(tutorial.selectedAnimation, null);
tutorial.close();
assert.ok(disposed); assert.equal(room.isWalkable, welcomeWalkable);
console.log("Bragg-Geometrie, Steuerung, begehbare Station und beide freien Übungsphasen geprüft.");