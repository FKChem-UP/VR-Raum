"use strict";

const assert = require("node:assert/strict");
const {normalize, collect, resolve} = require("../js/shared-annotations.js");
const atoms = ["co-heavy-1", "co-heavy-2", "co-heavy-3"].map(id => ({id}));
const meshes = atoms.map((atom, id) => ({id, parent: {}, userData: {fkcAtom: atom}}));
const visual = {fkcStructure: {mode: "coordination", atoms}, object3D: {traverse: callback => meshes.forEach(callback)}};
const root = {id: "welcome-model-10", modelReady: true, isConnected: true, fkcVariantId: "co-coordination",
  querySelector: () => visual, object3D: {getObjectById: id => meshes[id]}};
const pins = new Map([[meshes[0], {root, atom: atoms[0]}]]);
const saved = [{root, visual, points: [atoms[2], atoms[0], atoms[1]], measurementMode: "angle"}];
const scene = {components: {"fkc-atom-labels": {pins}, "fkc-measurements": {saved}}};
const entries = collect(scene, "welcome");
assert.deepEqual(entries.map(entry => entry.mode), ["pin", "angle"]);
const getModel = id => id === root.id ? root : null;
const [pin, angle] = resolve(entries, "welcome", getModel).values();
assert.equal(pin.meshes[0], meshes[0]);
assert.deepEqual(angle.points, [atoms[2], atoms[0], atoms[1]], "Mittleres Atom bleibt Winkelscheitel");
assert.equal(resolve(entries, "team-a", getModel).size, 0);
root.fkcVariantId = "co-complex";
assert.equal(resolve(entries, "welcome", getModel).size, 0);
root.fkcVariantId = "co-coordination";
assert.equal(resolve([{...entries[0], atoms: ["absent-atom"]}], "welcome", getModel).size, 0);
assert.deepEqual(normalize([...entries, entries[0], {...entries[1], atoms: ["a", "a", "a"]},
  {...entries[0], model: "team-a-model-1"}, {...entries[0], mode: "constructor"}], "welcome"), entries);
pins.clear();
saved.length = 0;
assert.deepEqual(collect(scene, "welcome"), []);
console.log("Geteilte Annotationen: Modell- und Variantenbindung, Atomreihenfolge, Deduplizierung und Entfernen geprüft.");