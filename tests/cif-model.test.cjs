"use strict";

// Keine zusätzlichen Pakete: numerischer Test mit den Node.js-Bordmitteln.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const F = {};
vm.runInNewContext(fs.readFileSync(path.join(root, "js/cif-structure.js"), "utf8"), {window: {FKCVR: F}});
const components = {};
vm.runInNewContext(fs.readFileSync(path.join(root, "js/cif-model.js"), "utf8"), {
  window: {FKCVR: F},
  AFRAME: {
    THREE: {},
    registerComponent: (name, component) => { components[name] = component; }
  },
  console: {info() {}}
});
const source = fs.readFileSync(path.join(root, "assets/structures/C60_fullerene.cif"), "utf8");
const molecule = F.CIF.createStructure(source, "molecule");
const cell = F.CIF.createStructure(source, "cell");
assert.equal(molecule.atoms.length, 60);
assert.equal(molecule.bonds.length, 90);
assert.equal(cell.atoms.length, 240);
assert.equal(cell.bonds.length, 360);
assert.equal(cell.moleculeCount, 4);
assert.equal(cell.spaceGroup.name, "Pa-3");
assert.equal(cell.spaceGroup.number, "205");
assert.equal(new Set(cell.atoms.map(atom => atom.id)).size, 240);
assert.equal(new Set(cell.atoms.map(atom => atom.cifLabel)).size, 10);
assert.equal(cell.cellLengthsAngstrom[0], 14.29570032);
for (const atom of cell.atoms) {
  atom.fractional.forEach((value, axis) => {
    assert.ok(value >= 0 && value < 1);
    assert.equal(atom.positionAngstrom[axis], value * cell.cellLengthsAngstrom[axis]);
  });
}
const length = segment => Math.hypot(...segment.endAngstrom.map(
  (value, axis) => value - segment.startAngstrom[axis]
));
for (const bond of cell.bonds) {
  const segments = cell.bondSegments.filter(segment => segment.bondId === bond.id);
  assert.ok(segments.length >= 1);
  assert.ok(Math.abs(segments.reduce((sum, segment) => sum + length(segment), 0) -
    bond.distanceAngstrom) < 1e-8, "Bindungslänge muss beim Teilen erhalten bleiben");
  for (const segment of segments) {
    assert.ok(length(segment) > 0 && length(segment) <= 1.85);
    for (const point of [segment.startAngstrom, segment.endAngstrom]) {
      point.forEach((value, axis) => assert.ok(
        value >= -1e-8 && value <= cell.cellLengthsAngstrom[axis] + 1e-8,
        "Bindungsabschnitt muss innerhalb der Zelle liegen"
      ));
    }
  }
}
assert.ok(cell.bondSegments.length > cell.bonds.length, "Periodische Bindungen müssen geteilt werden");
for (const structure of [molecule, cell]) {
  const degree = structure.atoms.map(() => 0);
  for (const bond of structure.bonds) { degree[bond.a]++; degree[bond.b]++; }
  assert.ok(degree.every(value => value === 3));
}
assert.throws(() => F.CIF.createStructure(source, "unknown"), /Darstellungsmodus/);
assert.throws(() => F.CIF.createStructure(source.replace("14.29570032", "15")), /kubische/);
const calls = [];
const visual = {setAttribute: (...args) => calls.push(args)};
F.loadModelVisual(visual, "model.cif", "cell");
assert.equal(calls[0][0], "fkc-cif-model");
assert.equal(calls[0][1].mode, "cell");
F.loadModelVisual(visual, "model.cif");
assert.equal(calls[1][1].mode, "molecule");
F.loadModelVisual(visual, "model.glb");
assert.equal(calls[2][0], "gltf-model");
assert.equal(components["fkc-cif-model"].schema.mode.default, "molecule");
const atomMesh = {
  userData: {fkcAtom: molecule.atoms[0]},
  scale: {setScalar(value) { this.x = this.y = this.z = value; }}
};
const bondMesh = {userData: {fkcBond: molecule.bonds[0]}, scale: {y: 1.4}, visible: true};
const frameMesh = {userData: {}, scale: {x: 0.035}, visible: true};
const group = {
  userData: {},
  traverse(callback) { [atomMesh, bondMesh, frameMesh].forEach(callback); }
};
const coordinatesBefore = JSON.stringify(molecule.atoms);
for (const style of F.CIF.styles) {
  F.CIF.applyStyle(group, style.id);
  assert.equal(atomMesh.scale.x, style.atomRadius);
  assert.equal(bondMesh.scale.x, style.bondRadius);
  assert.equal(bondMesh.visible, style.bondRadius > 0);
  assert.equal(bondMesh.scale.y, 1.4, "Bindungslänge bleibt erhalten");
  assert.equal(frameMesh.scale.x, 0.035, "Zellrahmen bleibt unverändert");
  assert.equal(group.userData.fkcStyle, style.id);
}
assert.equal(JSON.stringify(molecule.atoms), coordinatesBefore);
assert.throws(() => F.CIF.applyStyle(group, "ellipsoid"), /Nicht unterstützter/);
F.CIF.applyStyle(group, "space-filling");
assert.equal(atomMesh.scale.x, 1.70);
F.CIF.applyStyle(group, "ball-stick");
assert.equal(bondMesh.visible, true, "Bindungen erscheinen nach Style-Rückwechsel");
const coSource = fs.readFileSync(path.join(root, "assets/structures/Co-Produkt1.cif"), "utf8");
const coCell = F.CIF.createStructure(coSource, "cell");
for (const bond of coCell.bonds) {
  const segments = coCell.bondSegments.filter(segment => segment.bondId === bond.id);
  assert.ok(Math.abs(segments.reduce((sum, segment) => sum + length(segment), 0) - bond.distanceAngstrom) < 1e-8);
  for (const segment of segments) {
    for (const position of [segment.startAngstrom, segment.endAngstrom]) {
      const matrix = coCell.cellMatrix;
      const z = position[2] / matrix[2][2];
      const y = (position[1] - z * matrix[2][1]) / matrix[1][1];
      const x = (position[0] - y * matrix[1][0] - z * matrix[2][0]) / matrix[0][0];
      assert.ok([x, y, z].every(value => value >= -1e-7 && value <= 1 + 1e-7));
    }
  }
}
atomMesh.userData.fkcAtom = {element: "O"};
F.CIF.applyStyle(group, "space-filling");
assert.equal(atomMesh.scale.x, 1.52);
console.log("CIF-Styletests bestanden: vier Styles, Radiuskonvention, Rückwechsel und unveränderte Strukturkoordinaten.");
console.log("CIF-Strukturtest bestanden:", {
  molecule: [molecule.atoms.length, molecule.bonds.length],
  cell: [cell.atoms.length, cell.bonds.length],
  segments: cell.bondSegments.length,
  centersFractional: cell.moleculeCentersFractional,
  bondRangeAngstrom: [
    Math.min(...cell.bonds.map(bond => bond.distanceAngstrom)),
    Math.max(...cell.bonds.map(bond => bond.distanceAngstrom))
  ]
});