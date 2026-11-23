"use strict";

(function () {
  const counts = {pin: 1, distance: 2, angle: 3, torsion: 4};
  const limit = 24;
  const safeId = (id, size) => typeof id === "string" && id.length <= size && /^[a-z0-9_-]+$/i.test(id);
  function normalize(entries, room) {
    if (!Array.isArray(entries)) return [];
    const prefix = room + "-model-";
    const records = new Map();
    for (const entry of entries.slice(-limit)) {
      if (!entry || !safeId(entry.model, 48) || !entry.model.startsWith(prefix) ||
          !/^(?:[1-9]|1[0-6])$/.test(entry.model.slice(prefix.length)) ||
          !safeId(entry.variant, 64) || !safeId(entry.mode, 16) || !Object.hasOwn(counts, entry.mode) ||
          !Array.isArray(entry.atoms) || entry.atoms.length !== counts[entry.mode] ||
          !entry.atoms.every(id => safeId(id, 64)) || new Set(entry.atoms).size !== entry.atoms.length) continue;
      const record = {model: entry.model, variant: entry.variant, mode: entry.mode, atoms: entry.atoms.slice()};
      records.set(JSON.stringify(record), record);
    }
    return [...records.values()];
  }

  function collect(scene, room) {
    const entries = [];
    const add = (root, visual, mode, atoms) => {
      if (root?.isConnected && visual?.fkcStructure && root.querySelector(".model-visual") === visual && !root.fkcPendingVisual) {
        entries.push({model: root.id, variant: root.fkcVariantId || visual.fkcStructure.mode, mode, atoms});
      }
    };
    for (const [mesh, {root, atom}] of scene.components["fkc-atom-labels"]?.pins || []) {
      if (mesh.parent && root.object3D.getObjectById(mesh.id) && root.fkcAtomLabels !== "off") {
        add(root, root.querySelector(".model-visual"), "pin", [atom.id]);
      }
    }
    for (const record of scene.components["fkc-measurements"]?.saved || []) {
      if (record.meshes?.some(mesh => mesh?.userData?.fkcConstruction)) continue;
      add(record.root, record.visual, record.measurementMode, record.points.map(atom => atom.id));
    }
    return normalize(entries, room);
  }

  function resolve(entries, room, getModel) {
    const resolved = new Map();
    const cached = new Map();
    for (const entry of entries) {
      if (!cached.has(entry.model)) {
        const root = getModel(entry.model);
        const visual = root?.modelReady && !root.fkcPendingVisual && root.querySelector(".model-visual");
        const structure = visual?.fkcStructure;
        if (!root?.isConnected || !structure || !entry.model.startsWith(room + "-model-")) continue;
        const points = new Map(structure.atoms.map(atom => [atom.id, atom]));
        const meshes = new Map();
        visual.object3D.traverse(mesh => {
          const atom = mesh.userData.fkcAtom;
          if (atom && points.get(atom.id) === atom) meshes.set(atom.id, mesh);
        });
        cached.set(entry.model, {root, visual, structure, points, meshes});
      }
      const {root, visual, structure, points, meshes} = cached.get(entry.model);
      if (entry.variant !== (root.fkcVariantId || structure.mode)) continue;
      if (!entry.atoms.every(id => points.has(id) && meshes.has(id))) continue;
      resolved.set(JSON.stringify(entry), {root, visual, measurementMode: entry.mode,
        points: entry.atoms.map(id => points.get(id)), meshes: entry.atoms.map(id => meshes.get(id))});
    }
    return resolved;
  }

  const api = {normalize, collect, resolve};
  if (typeof module === "object") module.exports = api;
  else window.FKCVR.SharedAnnotations = api;
})();