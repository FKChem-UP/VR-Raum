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
const coloredMaterial = {};
const neutralMaterial = {};
let neutralColor;
neutralMaterial.color = {set(value) { neutralColor = value; }};
bondMesh.userData.fkcElementMaterial = coloredMaterial;
bondMesh.userData.fkcNeutralMaterial = neutralMaterial;
const frameMesh = {userData: {}, scale: {x: 0.035}, visible: true};
const group = {
  userData: {},
  traverse(callback) { [atomMesh, bondMesh, frameMesh].forEach(callback); }
};
const coordinatesBefore = JSON.stringify(molecule.atoms);
F.getScene = () => ({components: {}});
F.invalidateHits = () => {};
const colorVisual = {fkcStructure: molecule, getObject3D: () => group};
const colorRoot = {querySelector: () => colorVisual};
assert.equal(F.CIF.setBondAppearance(colorRoot, "uniform", "#ff9d38"), true);
assert.equal(neutralColor, "#ff9d38");
assert.equal(bondMesh.material, neutralMaterial);
F.CIF.applyStyle(group, "wires");
assert.equal(bondMesh.material, coloredMaterial, "Wires bleiben unabhängig von Ball-and-Stick zweifarbig");
assert.equal(neutralColor, "#949494");
assert.equal(F.CIF.setBondAppearance(colorRoot, "element"), true);
F.CIF.applyStyle(group, "ball-stick");
assert.equal(bondMesh.material, coloredMaterial, "Endatomfarben auch in Kugel-Stab");
assert.equal(atomMesh.userData.fkcAtom, molecule.atoms[0]);
assert.equal(F.CIF.setBondAppearance(colorRoot, "unknown"), false);
assert.equal(F.CIF.setBondAppearance(colorRoot, "uniform", "invalid"), false);
colorRoot.fkcPendingVisual = {};
assert.equal(F.CIF.setBondAppearance(colorRoot, "auto"), false);
delete colorRoot.fkcPendingVisual;
F.CIF.setBondAppearance(colorRoot, "auto");
assert.equal(neutralColor, "#949494");
assert.equal(F.CIF.setBondThickness(colorRoot, 0.5), true);
assert.equal(bondMesh.scale.x, 0.05);
F.CIF.applyStyle(group, "capped-sticks");
assert.equal(bondMesh.scale.x, 0.14);
assert.equal(bondMesh.material, coloredMaterial);
F.CIF.applyStyle(group, "polyhedral");
assert.equal(bondMesh.scale.x, 0.05, "Nicht unterstütztes Polyhedral fällt auf Ball-and-Stick zurück");
assert.equal(F.CIF.setBondThickness(colorRoot, 3), false);
F.CIF.setBondThickness(colorRoot, 1);
atomMesh.userData.fkcAtom = {element: "H"};
F.CIF.applyStyle(group, "ball-stick");
assert.equal(atomMesh.scale.x, 0.16);
atomMesh.userData.fkcAtom = molecule.atoms[0];
assert.equal(F.CIF.setAtomOptions(colorRoot, true, 0.5), true);
atomMesh.userData.fkcAtom = {element: "H"};
F.CIF.applyStyle(group, "ball-stick");
assert.equal(atomMesh.visible, false);
assert.equal(atomMesh.scale.x, 0.08);
F.CIF.setAtomOptions(colorRoot, false, 1);
assert.equal(atomMesh.visible, true);
assert.equal(F.CIF.setAtomOptions(colorRoot, undefined, 2), false);
atomMesh.userData.fkcAtom = molecule.atoms[0];
for (const style of F.CIF.availableStyles(molecule)) {
  F.CIF.applyStyle(group, style.id);
  assert.equal(atomMesh.scale.x, style.atomRadius);
  assert.equal(bondMesh.scale.x, style.bondRadius);
  assert.equal(bondMesh.visible, style.bondRadius > 0);
  assert.equal(bondMesh.scale.y, 1.4, "Bindungslänge bleibt erhalten");
  assert.equal(bondMesh.material, ["wires", "capped-sticks"].includes(style.id) ? coloredMaterial : neutralMaterial);
  assert.equal(frameMesh.scale.x, 0.035, "Zellrahmen bleibt unverändert");
  assert.equal(group.userData.fkcStyle, style.id);
}
assert.equal(JSON.stringify(molecule.atoms), coordinatesBefore);
assert.throws(() => F.CIF.applyStyle(group, "ellipsoid"), /Nicht unterstützter/);
F.CIF.applyStyle(group, "space-filling");
assert.equal(atomMesh.scale.x, 1.70);
F.CIF.applyStyle(group, "ball-stick");
assert.equal(bondMesh.visible, true, "Bindungen erscheinen nach Style-Rückwechsel");
group.userData.fkcStructure=molecule;
bondMesh.userData.fkcBond.a=0;
F.CIF.setHiddenSites(colorVisual,[molecule.atoms[0].id]);
assert.equal(atomMesh.visible,false);
assert.equal(bondMesh.visible,false);
F.CIF.applyStyle(group,"wires");
assert.equal(atomMesh.visible,false);
F.CIF.setHiddenSites(colorVisual,[],true);
assert.equal(atomMesh.visible,true);
assert.equal(bondMesh.visible,true);
const coSource = fs.readFileSync(path.join(root, "assets/structures/Co-Produkt1.cif"), "utf8");
const coComplex = F.CIF.createStructure(coSource, "molecule");
const coCell = F.CIF.createStructure(coSource, "cell");
assert.equal(F.CIF.cellAxisVectors(coCell),coCell.cellMatrix);
assert.ok(F.CIF.cellAxisVectors(coCell).some((v,i)=>v.some((n,j)=>i!==j&&Math.abs(n)>0.01)));
assert.deepEqual(JSON.parse(JSON.stringify(F.CIF.cellAxisVectors({cellLengthsAngstrom:[2,3,4]}))),[[2,0,0],[0,3,0],[0,0,4]]);
const coordination = F.CIF.createStructure(coSource, "coordination");
assert.equal(coComplex.atoms.length, 64);
assert.equal(coComplex.bonds.length, 72);
assert.equal(coCell.atoms.length, 72);
assert.equal(coCell.bonds.length, 76);
const contactDashes = F.CIF.hydrogenContactDashes(coCell);
assert.ok(contactDashes.length > coCell.hydrogenContacts.length);
for (const [start, end] of contactDashes) {
  const distance = Math.hypot(...end.map((value, axis) => value - start[axis]));
  assert.ok(distance > 0 && distance <= 0.200001);
  for (const point of [start, end]) {
    const matrix = coCell.cellMatrix;
    const z = point[2] / matrix[2][2];
    const y = (point[1] - z * matrix[2][1]) / matrix[1][1];
    const x = (point[0] - y * matrix[1][0] - z * matrix[2][0]) / matrix[0][0];
    assert.ok([x, y, z].every(value => value >= -1e-7 && value <= 1 + 1e-7));
  }
}
assert.equal(F.CIF.hydrogenContactDashes(cell).length, 0);
assert.equal(F.CIF.hydrogenContactDashes(coComplex).length, 0);
const contactOverlay = {visible: false, scale:{}, userData: {fkcHydrogenContacts: true}};
const contactGroup = {userData: {fkcStructure: coCell}, traverse: visit => visit(contactOverlay)};
const contactRoot = {querySelector: () => ({fkcStructure: coCell, getObject3D: () => contactGroup})};
F.CIF.applyStyle(contactGroup, "ball-stick");
assert.equal(contactOverlay.visible, false);
assert.equal(F.CIF.setHydrogenContacts(contactRoot, true), true);
assert.equal(contactOverlay.visible, true);
F.CIF.setHydrogenThickness(contactRoot,2);
assert.equal(contactOverlay.scale.x,0.048);
contactGroup.userData.fkcHideHydrogen = true;
F.CIF.applyStyle(contactGroup, "space-filling");
assert.equal(contactOverlay.visible, false);
contactGroup.userData.fkcHideHydrogen = false;
F.CIF.applyStyle(contactGroup, "wires");
assert.equal(contactOverlay.visible, true);
F.CIF.setHydrogenContacts(contactRoot, false);
assert.equal(contactOverlay.visible, false);
assert.equal(coordination.atoms.length, 7);
assert.equal(coordination.bonds.length, 6);
assert.equal(coordination.atoms[0].cifLabel, "Co1");
const renamed = F.CIF.createStructure(coSource.replace(/\bCo1\b/g, "Metalzentrum"), "coordination");
assert.equal(renamed.atoms[0].element, "Co");
assert.equal(renamed.atoms[0].cifLabel, "Metalzentrum", "Importer erkennt Co ohne Co-Präfix im Atomlabel");
assert.equal(renamed.bonds.length, 6);
assert.equal(F.CIF.availableStyles(coordination).length, 5);
assert.equal(F.CIF.availableStyles(coCell).length, 4);
assert.equal(F.CIF.availableStyles(molecule).length, 4);
assert.throws(() => F.CIF.createStructure(source, "coordination"), /nicht verfügbar/);
const polyMesh = {userData: {fkcPolyhedron: coordination.polyhedra[0]}, visible: false};
const polyGroup = {userData: {fkcStructure: coordination}, traverse(callback) {
  [atomMesh, bondMesh, polyMesh].forEach(callback);
}};
F.CIF.applyStyle(polyGroup, "polyhedral");
assert.equal(polyMesh.visible, true);
assert.equal(bondMesh.visible, true);
F.CIF.applyStyle(polyGroup, "wires");
assert.equal(polyMesh.visible, false);
F.CIF.applyStyle(group, "polyhedral");
assert.equal(group.userData.fkcStyle, "ball-stick", "Nicht unterstützte Ansicht fällt auf Kugel-Stab zurück");
const octahedron = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const faces = F.CIF.polyhedronTriangles(octahedron);
assert.equal(faces.length, 8);
const cube = [[-1,-1,-1],[-1,-1,1],[-1,1,-1],[-1,1,1],[1,-1,-1],[1,-1,1],[1,1,-1],[1,1,1]];
assert.equal(F.CIF.polyhedronTriangles(cube).length, 12, "Koplanare Würfelflächen nicht mehrfach triangulieren");
assert.throws(() => F.CIF.polyhedronTriangles([[0,0,0],[1,0,0],[0,1,0],[1,1,0]]), /Entartetes/);
const neighborPoints = coordination.polyhedra[0].neighbors.map(index => coordination.atoms[index].positionAngstrom);
const actualFaces = F.CIF.polyhedronTriangles(neighborPoints);
assert.equal(actualFaces.length, 8, "Verzerrtes Co-Oktaeder besitzt acht echte Flächen");
const edges = new Map();
const sub = (a, b) => a.map((value, axis) => value - b[axis]);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot = (a, b) => a.reduce((sum, value, axis) => sum + value*b[axis], 0);
for (const triangle of actualFaces) {
  const [a,b,c] = triangle.map(index => neighborPoints[index]);
  const normal = cross(sub(b,a),sub(c,a));
  assert.ok(dot(normal, sub(coordination.atoms[0].positionAngstrom,a)) < 0, "Zentrum innerhalb, Normalen nach außen");
  assert.ok(neighborPoints.every(point => dot(normal,sub(point,a)) < 1e-7));
  for (let i = 0; i < 3; i++) {
    const key = [triangle[i],triangle[(i+1)%3]].sort((a,b) => a-b).join(":");
    edges.set(key,(edges.get(key)||0)+1);
  }
}
assert.ok([...edges.values()].every(count => count === 2), "Geschlossene Hülle");
assert.equal(edges.size, 12);
console.log("Polyedertests bestanden: Co-Hülle, Normalen, geschlossene Kanten, koplanare Flächen und Stylewechsel.");
const environmentRecordGroup = {userData: {}, traverse() {}};
const previewMaterial = {};
const environmentState = {enabled: true, radius: 3, selected: new Set(),
  available: new Set(["candidate"]), records: new Map([["candidate", {
    built: {group: environmentRecordGroup}, materials: new Map([[{}, previewMaterial]])
  }]])};
const environmentGroup = {userData: {fkcEnvironment: environmentState, fkcStyle: "wires"}};
const environmentRoot = {querySelector: () => ({getObject3D: () => environmentGroup})};
F.setStatus = () => {};
F.CIF.updateEnvironment(environmentGroup);
assert.equal(environmentRecordGroup.visible, true);
assert.equal(previewMaterial.opacity, 0.25);
assert.equal(F.CIF.clickEnvironment({el: environmentRoot, mesh: {userData: {fkcEnvironmentId: "candidate"}}}), true);
assert.equal(previewMaterial.opacity, 1);
environmentState.enabled = false;
F.CIF.updateEnvironment(environmentGroup);
assert.equal(environmentRecordGroup.visible, true, "Übernahme bleibt nach Vorschau-Aus");
environmentState.enabled = true;
F.CIF.clickEnvironment({el: environmentRoot, mesh: {userData: {fkcEnvironmentId: "candidate"}}});
environmentState.enabled = false;
F.CIF.updateEnvironment(environmentGroup);
assert.equal(environmentRecordGroup.visible, false, "Nicht übernommener Kandidat verschwindet");
assert.equal(F.CIF.clickEnvironment({el: environmentRoot, mesh: {userData: {}}}), false);
console.log("Umgebungsauswahl bestanden: Vorschau, Übernahme, Abwahl und Ausblenden.");
for (const bond of coCell.bonds) {
  const segments = coCell.bondSegments.filter(segment => segment.bondId === bond.id);
  for (const half of [0, 1]) {
    assert.ok(Math.abs(segments.filter(segment => segment.half === half)
      .reduce((sum, segment) => sum + length(segment), 0) - bond.distanceAngstrom / 2) < 1e-8,
      "Elementfarbgrenze liegt am echten Bindungsmittelpunkt, auch über Zellgrenzen");
  }
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