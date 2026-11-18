"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const F = {};
const components = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/atom-labels.js"), "utf8"), {
  window: {FKCVR: F},
  AFRAME: {THREE: {}, registerComponent: (name, component) => { components[name] = component; }}
});
const rootObject = {visible: true, parent: null};
const root = {isConnected: true, modelReady: true, fkcAtomLabels: "hover", object3D: rootObject};
const atom = {cifLabel: "C0", modelNumber: 17, id: "atom-17"};
const mesh = {visible: true, parent: rootObject, userData: {fkcAtom: atom}};
const hit = {type: "model", el: root, mesh};
assert.equal(F.AtomLabels.atomFromHit(hit).atom, atom);
assert.equal(F.AtomLabels.text(atom), "C0 · Atom 17");
assert.equal(F.AtomLabels.atomFromHit(null), null);
assert.equal(F.AtomLabels.atomFromHit({...hit, type: "action"}), null);
assert.equal(F.AtomLabels.atomFromHit({...hit, mesh: {...mesh, userData: {}}}), null);
assert.equal(F.AtomLabels.atomFromHit({...hit, mesh: {...mesh, parent: null}}), null);
for (const [object, field, value] of [
  [root, "isConnected", false], [root, "modelReady", false],
  [root, "fkcAtomLabels", "off"], [mesh, "visible", false], [rootObject, "visible", false]
]) {
  const original = object[field];
  object[field] = value;
  assert.equal(F.AtomLabels.atomFromHit(hit), null);
  object[field] = original;
}
let disposed = 0;
let clones = 0;
const originalMaterial = {
  clone() {
    clones++;
    return {color: {set() {}}, emissive: {set() {}}, dispose() { disposed++; }};
  }
};
mesh.material = originalMaterial;
const component = Object.assign({
  active: null, label: {visible: false}, texture: {},
  labelCanvas: {getContext: () => ({clearRect() {}, fillRect() {}, strokeRect() {}, fillText() {}})}
}, components["fkc-atom-labels"]);
const target = F.AtomLabels.atomFromHit(hit);
component.show(target);
assert.notEqual(mesh.material, originalMaterial);
assert.equal(component.label.visible, true);
component.show(target);
assert.equal(clones, 1, "Kein neues Material pro Frame");
const second = {...mesh, material: originalMaterial};
component.show({mesh: second, atom: {...atom, modelNumber: 18}});
assert.equal(mesh.material, originalMaterial, "Altes Atom erhält Originalmaterial zurück");
assert.equal(disposed, 1);
component.show(null);
assert.equal(second.material, originalMaterial);
assert.equal(component.label.visible, false);
assert.equal(disposed, 2);
F.getScene = () => ({components: {"fkc-atom-labels": component}});
F.AtomLabels.setMode(root, "off");
assert.equal(root.fkcAtomLabels, "off");
F.AtomLabels.setMode(root, "hover");
assert.equal(root.fkcAtomLabels, "hover");
F.AtomLabels.setMode(root, "invalid");
assert.equal(root.fkcAtomLabels, "hover");
console.log("Atomlabel-Test bestanden: CIF-Metadaten, GLB-Ausschluss, veraltete/unsichtbare Treffer, Materialwechsel und Rücksetzung.");