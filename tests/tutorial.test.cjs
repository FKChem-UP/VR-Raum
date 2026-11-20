"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const F = {};
const components = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/tutorial.js"), "utf8"), {
  window: {FKCVR: F}, AFRAME: {THREE: {}, registerComponent(name, component) { components[name] = component; }}
});
assert.equal(F.Tutorial.crossed(null, {x: 0, y: 0, z: -1}), false);
assert.equal(F.Tutorial.crossed({x: 0, y: 0, z: 1}, {x: 0, y: 0, z: -1}), true);
assert.equal(F.Tutorial.crossed({x: 2, y: 0, z: 1}, {x: 2, y: 0, z: -1}), false);
assert.equal(F.Tutorial.crossed({x: 0, y: 2, z: 1}, {x: 0, y: 2, z: -1}), false);
assert.equal(F.Tutorial.crossed({x: 0, y: 0, z: -1}, {x: 0, y: 0, z: 1}), false);
let blocks = 0;
F.Menu = {blockDrawing() { blocks++; }};
F.invalidateHits = () => {};
const component = Object.assign({group: {object3D: {visible: true}},
  room: {object3D: {visible: false}}, roomVisible: true}, components["fkc-tutorial"]);
F.Tutorial.active = true;
component.close();
assert.equal(F.Tutorial.active, false);
assert.equal(component.room.object3D.visible, true);
assert.equal(component.group.object3D.visible, false);
let action = 0;
component.buttons = [{x: 80, w: 380, action() { action++; }}];
F.Tutorial.active = true;
component.click({uv: {x: 200/1024, y: 1-520/640}});
assert.equal(action, 1);
component.click({uv: {x: 0, y: 1}});
assert.equal(action, 1);
const board = {};
const cursor = {visible: false, position: {set(...coordinates) { this.coordinates = coordinates; }}};
const overlay = {board, cursor, phase: "question", updateCursor: component.updateCursor};
overlay.updateCursor({el: board, uv: {x: 0.75, y: 0.25}});
assert.equal(cursor.visible, true);
assert.deepEqual(cursor.position.coordinates, [0.35, -0.21875, 0], "Punkt liegt auf der getroffenen Schildfläche");
overlay.phase = "training";
overlay.updateCursor({el: board, uv: {x: 0.5, y: 0.5}});
assert.deepEqual(cursor.position.coordinates, [0, 0, 0.002], "Punkt liegt knapp vor der tiefengeprüften Tafel");
overlay.updateCursor({el: {}, uv: {x: 0.5, y: 0.5}});
assert.equal(cursor.visible, false, "Fremde Treffer zeigen keinen Punkt auf dem Schild");
overlay.updateCursor({el: board, uv: {x: 0.5, y: 0.5}});
overlay.updateCursor(null);
assert.equal(cursor.visible, false, "Beim Wegzielen wird der Punkt ausgeblendet");
let rooms = 0;
F.app = {changeRoom() { rooms++; }};
component.pending = null;
F.getScene = () => ({is: () => true, components: {"fkc-tutorial": component}});
F.Tutorial.start();
assert.equal(component.pending, "training");
assert.equal(rooms, 1);
assert.equal(F.Tutorial.progress(0, true, 0, 0, 1), 1);
assert.equal(F.Tutorial.progress(1, true, 0.2, 0, 1), 1);
assert.equal(F.Tutorial.progress(1, true, 0.2, 1, 1), 2);
assert.equal(F.Tutorial.progress(2, true, 0.2, 1, 1.5), 2);
assert.equal(F.Tutorial.progress(2, true, 0.2, 2, 1.5), 3);
F.Tutorial.active = true;
assert.equal(F.Tutorial.allowsModel({id: "tutorial-co-model", object3D: {visible: true}}), true);
assert.equal(F.Tutorial.allowsModel({id: "tutorial-co-model", object3D: {visible: false}}), false);
assert.equal(F.Tutorial.allowsModel({id: "welcome-model"}), false);
const atomMesh = {userData: {fkcAtom: {}}};
const bondMesh = {userData: {fkcBond: {a: 0, b: 1}}};
assert.equal(F.Tutorial.measurementTarget(atomMesh, "angle"), true);
assert.equal(F.Tutorial.measurementTarget(bondMesh, "angle"), false);
assert.equal(F.Tutorial.measurementTarget(bondMesh, "distance"), true);
assert.equal(F.Tutorial.measurementTarget({userData: {}}, "distance"), false);
assert.equal(F.Tutorial.measurementTarget({userData: {fkcAtom: {}, fkcEnvironmentId: "other"}}, "distance"), false);
// Gemeinsamen Trefferpfad testen: sichtbares Atom vor der Tafel, Stab davor.
const rayRoot = {id: "tutorial-co-model", object3D: {visible: true}, isConnected: true, modelReady: true};
const rayBoard = {isConnected: true, dataset: {fkcTutorial: "true"}};
const vector = {clone() { return this; }, negate() { return this; }, dot() { return 0; }};
const surface = {userData: {}};
const rayTargets = [bondMesh, atomMesh, surface];
for (const mesh of rayTargets) Object.assign(mesh, {isMesh: true, visible: true, updateWorldMatrix() {}});
rayBoard.object3D = {traverse: visit => visit(surface)};
const visualEntity = {object3D: {traverse: visit => [bondMesh, atomMesh].forEach(visit)}, closest: () => rayRoot};
F.RoomBuilder = {build() {}};
F.getScene = () => ({addEventListener() {}, querySelectorAll(selector) {
  return selector === ".vr-action" ? [rayBoard] : selector === ".model-visual" ? [visualEntity] : [];
}});
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/vr-tools.js"), "utf8"), {
  window: {FKCVR: F}, THREE: {}, console: {info() {}}
});
let distances = [0.80, 0.81, 1];
const ray = {ray: {direction: vector}, intersectObjects(objects) {
  return rayTargets.map((object, i) => ({object, distance: distances[i], point: vector}))
    .filter(hit => objects.includes(hit.object)).sort((a, b) => a.distance - b.distance);
}};
F.Measure = {enabled: true, mode: "angle"};
assert.equal(F.findHit(ray, true).mesh, atomMesh, "Bindungsstab blockiert die Winkelauswahl nicht");
F.Measure.mode = "distance";
assert.equal(F.findHit(ray, true).mesh, atomMesh, "Atom am Bindungsende hat Vorrang");
distances = [0.8, 0.9, 1];
assert.equal(F.findHit(ray, true).mesh, bondMesh, "Direkte Distanzmessung am Stab bleibt möglich");
distances = [0.8, 0.81, 0.7];
assert.equal(F.findHit(ray, true).el, rayBoard, "Nur eine tatsächlich nähere Tafel fängt den Strahl ab");
F.Measure.enabled = false;
const trainingRoot = {id: "tutorial-co-model", object3D: {visible: true}};
const training = {phase: "training", target: trainingRoot, step: 4};
const scene = {components: {"fkc-tutorial": training}};
for (const [step, expected] of [[4, "variant:tutorial-coordination"], [5, "measure:distance"],
  [6, "measure:angle"], [7, "variant:tutorial-complex"], [8, "hide-hydrogen"],
  [9, "environment:3"], [10, null], [11, "environment:off"]]) {
  training.step = step;
  assert.equal(F.Tutorial.menuTarget(scene, trainingRoot), expected);
}
training.step = 5;
F.Measure = {enabled: true, mode: "distance"};
assert.equal(F.Tutorial.menuTarget(scene, trainingRoot), null, "Aktive Messung nicht versehentlich ausschalten");
training.step = 4;
trainingRoot.fkcPendingVisual = {};
assert.equal(F.Tutorial.menuTarget(scene, trainingRoot), null);
delete trainingRoot.fkcPendingVisual;
F.Tutorial.active = false;
assert.equal(F.Tutorial.menuTarget(scene, trainingRoot), null);
F.Tutorial.active = true;
const next = (step, tools) => F.Tutorial.progress(step, false, 0, 0, 1, tools);
assert.equal(next(3, {coordination: true}), 3, "Erst das Handmenü öffnen");
assert.equal(next(3, {handMenu: true}), 4);
assert.equal(next(4, {coordination: true}), 5);
assert.equal(next(5, {distance: true}), 5, "Distanz nur in der Koordinationsansicht");
assert.equal(next(5, {coordination: true, angle: true}), 5);
assert.equal(next(5, {coordination: true, distance: true}), 6);
assert.equal(next(6, {coordination: true, angle: true}), 7);
assert.equal(next(7, {coordination: true}), 7);
assert.equal(next(7, {molecule: true}), 8);
assert.equal(next(8, {molecule: true, hydrogenHidden: true}), 9);
assert.equal(next(9, {molecule: true, hydrogenHidden: true}), 9);
assert.equal(next(9, {molecule: true, hydrogenHidden: true, environment3: true}), 10);
const environment = {selected: new Set(["ion"]), records: new Map([
  ["ion", {candidate: {atoms: [{}]}}], ["water", {candidate: {atoms: [{}, {}, {}]}}]
])};
assert.equal(F.Tutorial.hasSelectedMolecule(environment), false, "Einzelion zählt nicht als Molekül");
assert.equal(next(10, {molecule: true, environment3: true, selectedMolecule: false}), 10);
environment.selected.add("water");
assert.equal(F.Tutorial.hasSelectedMolecule(environment), true);
assert.equal(next(10, {molecule: true, environment3: true, selectedMolecule: true}), 11);
assert.equal(next(11, {molecule: true, environmentOff: true}), 11, "Übernommenes Molekül muss bleiben");
assert.equal(next(11, {molecule: true, environmentOff: true, selectedMolecule: true}), 12);
assert.equal(F.Tutorial.palm("right"), "linke Handfläche");
assert.equal(F.Tutorial.palm("left"), "rechte Handfläche");
const visual = {};
const target = {querySelector: () => visual};
const records = [{root: target, visual: {}, measurementMode: "angle"},
  {root: {}, visual, measurementMode: "angle"}, {root: target, visual, measurementMode: "distance"}];
assert.equal(F.Tutorial.hasMeasurement(records, target, "angle"), false);
assert.equal(F.Tutorial.hasMeasurement(records, target, "distance"), true);
assert.equal(F.Tutorial.hasMeasurement(undefined, target, "distance"), false);
const paused = {el: {is: () => true}, phase: "training", step: 4,
  board: {object3D: {visible: true}}, cursor: {visible: true}, previous: {}};
F.app.activeRoom = {};
F.getRig = () => null;
F.HandMenu = {readViewerHead: () => true};
F.Menu.opened = true;
components["fkc-tutorial"].tick.call(paused);
assert.equal(F.Menu.opened, true, "Hauptmenü bleibt im Tutorial geöffnet");
assert.equal(paused.board.object3D.visible, false);
assert.equal(paused.cursor.visible, false);
assert.equal(paused.step, 4, "Tutorial pausiert beim Öffnen des Hauptmenüs");
console.log("Tutorialtest bestanden: Schildüberquerung, Trefferbuttons, Wiederherstellung und manueller Start.");