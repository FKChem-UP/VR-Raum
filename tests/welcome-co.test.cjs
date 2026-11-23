"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const nodes = new Map();
const container = {querySelectorAll: () => []};
const F = {getScene: () => ({addEventListener() {}, querySelectorAll: () => []}), getNavigation: () => null,
  RoomBuilder: {build(parent, config, rooms) {
    assert.equal(parent, container);
    for (const [index, room] of rooms.entries()) {
      if (room.id === "team-b") nodes.set(`welcome-model-${index + 1}`, {});
    }
    return {};
  }}};
const context = {window: {FKCVR: F}, THREE: {}, AFRAME: {THREE: {}, registerComponent() {}},
  document: {getElementById: id => nodes.get(id)}, console: {info() {}}};
for (const name of ["cif-structure", "structure-cell", "hkust-structure", "zns-structure", "cif-model", "rooms", "vr-tools"]) {
  vm.runInNewContext(fs.readFileSync(path.join(root, "js", name + ".js"), "utf8"), context);
}
const index = F.rooms.findIndex(room => room.id === "team-b");
const teamB = F.rooms[index];
const station = teamB.stations[1];
assert.equal(teamB.zones[0].models.length, 4);
assert.ok(teamB.zones[0].models.slice(2).every(entry => !entry.model));
assert.equal(teamB.zones[4].wall, "back");
assert.equal(teamB.zones[4].along, 0);
const counts = {BENZIL03_monoklin:156, BENZIL04_trigonal:78, HKUST_1_mitH:65, HKUST_1_ohneH:624,
  Nebenprodukt_VUXBUL:60, YBa2Cu3O7_2016:13, YBa2Cu3O7_2026:13, YBa2Cu3O6_tetragonal_HT:12,
  Eu_Komplex2017:544, Verbindung1_cis_Co_Edukt:156, CoFe2O4:56, Nikotinsaeureamid_NICOAM05:60,
  AgHgI4_Tieftemperaturform:7, AgHgI4_Hochtemperaturform:8, Vanillin_YUHTEA:152};
const referenced = [];
for (const [id, prefix, count] of [["team-a", "A", 4], ["team-b", "B", 5]]) {
  const team = F.rooms.find(room => room.id === id);
  const {zones, stations} = team;
  assert.equal(zones.length, count);
  assert.equal(new Set(zones.map(s => s.accent)).size, count);
  assert.equal(new Set(stations.map(s => `${s.wall}:${s.along}`)).size, stations.length);
  zones.forEach((z, i) => {
    assert.ok(z.title.startsWith(`${prefix}${i + 1} · `));
    assert.ok(z.x0 >= -team.width / 2 && z.x1 <= team.width / 2);
    assert.ok(z.z0 >= -team.depth / 2 && z.z1 <= team.depth / 2);
    for (const other of zones.slice(i + 1)) {
      assert.ok(z.x0 >= other.x1 || z.x1 <= other.x0 || z.z0 >= other.z1 || z.z1 <= other.z0);
    }
  });
  const area = zones.reduce((sum, z) => sum + (z.x1 - z.x0) * (z.z1 - z.z0), 0);
  assert.ok(Math.abs(area - team.width * team.depth) < 1e-8);
  for (const s of stations.filter(entry => entry.model?.startsWith("assets/praktikum/"))) {
    const file = path.basename(s.model);
    referenced.push(file);
    assert.match(s.info, /^Quelle:/);
    const source = fs.readFileSync(path.join(root,s.model), "utf8");
    const structure = F.CIF.createStructure(source, s.variants?.find(v => /(?:-cell|:cell|:sites)$|^cif-network:sites:/.test(v.cifMode))?.cifMode || s.cifMode);
    assert.equal(structure.contactExpansion?.cell.atoms.length ?? structure.atoms.length,
      counts[file.replace(/\.cif$/, "").replaceAll("-", "_")], file);
    assert.ok(structure.measurePositions);
    assert.ok(structure.atoms.every(atom => F.CIF.elements[atom.element] && atom.positionAngstrom.every(Number.isFinite)),file);
  }
}
const activeModels = [...F.welcomeRoom.exhibits, ...F.rooms.filter(r=>r.zones).flatMap(r=>r.stations)];
const hkust = F.welcomeRoom.exhibits.find(entry=>entry.roomId==="team-a");
assert.equal(hkust.cifMode,"cif-hkust:node");
const teamHkust=activeModels.filter(entry=>entry.model?.includes("/HKUST-1_"));
assert.equal(teamHkust.length,3);
for(const entry of teamHkust){
  assert.equal(entry.variants[0].cifMode,entry.cifMode);
  assert.equal(entry.cifMode,entry.model.includes("_mitH") ? "cif-excerpt:hkust:focus" : "cif-hkust:node");
}
const hkustSource=fs.readFileSync(path.join(root,hkust.model),"utf8");
const node=F.CIF.createStructure(hkustSource,hkust.cifMode);
assert.equal(node.contactDepth,0);
assert.equal(node.atoms.length,7);
assert.equal(node.bonds.length,6);
assert.equal(node.atoms.filter(a=>a.element==="Cu").length,2);
assert.equal(node.atoms.filter(a=>a.element==="O").length,5);
let previous=node;
for(let depth=1;depth<=20;depth++){
  const expanded=F.CIF.contactStructure(node,depth);
  assert.equal(expanded.contactDepth,depth);
  assert.ok(expanded.atoms.length>previous.atoms.length);
  assert.ok(expanded.atoms.length<=node.contactExpansion.limit);
  assert.equal(new Set(expanded.atoms.map(a=>a.id)).size,expanded.atoms.length);
  previous=expanded;
}
assert.equal(previous.atoms.length,1308);
const framework=F.CIF.createStructure(hkustSource,"cif-hkust:cell").contactExpansion.cell;
assert.equal(framework.atoms.length,624);
assert.equal(framework.bonds.length,792);
assert.equal(framework.bonds.filter(b=>framework.atoms[b.a].element==="Cu" && framework.atoms[b.b].element==="Cu").length,24);
assert.ok(framework.bonds.some(b=>b.cellShift.some(Boolean)));
const pore=F.CIF.createStructure(hkustSource,"cif-hkust:pore");
assert.equal(pore.atoms.length,312);
for(const axis of [0,1,2]) {
  assert.ok(pore.atoms.some(a=>a.positionAngstrom[axis]>7));
  assert.ok(pore.atoms.some(a=>a.positionAngstrom[axis]<-7));
}
assert.equal(F.CIF.contactStructure(pore,1).atoms.length,384);
const axial=F.CIF.createStructure(hkustSource,"cif-hkust:axial").contactExpansion.cell;
assert.equal(axial.atoms.filter(a=>a.cifLabel==="O1").length,48);
assert.ok(axial.atoms.every(a=>a.cifLabel!=="O3"));
const molecules = {H2O:3,S8:8,BENZIL03_monoklin:26,BENZIL04_trigonal:26,Vanillin_YUHTEA:19,Nikotinsaeureamid_NICOAM05:15};
for(const s of activeModels.filter(entry=>entry.model?.endsWith(".cif"))) {
  for(const v of s.variants || [s]) {
    const structure=F.CIF.createStructure(fs.readFileSync(path.join(root,v.model),"utf8"),v.cifMode);
    if(/^cif-(network|excerpt):/.test(v.cifMode) && !v.cifMode.startsWith("cif-network:asu:"))assert.ok(structure.bonds.length,v.title);
    if(structure.contactExpansion && /^cif-(network|excerpt):/.test(v.cifMode)) {
      const expanded=F.CIF.contactStructure(structure,1);
      assert.ok(expanded.atoms.length>structure.atoms.length,v.title);
      assert.equal(new Set(expanded.atoms.map(a=>a.id)).size,expanded.atoms.length,v.title);
    }
    if(v.cifMode==="cif-excerpt:hkust:focus") {
      assert.equal(structure.atoms.filter(a=>a.element==="Cu").length,2);
      assert.equal(structure.atoms.filter(a=>a.element==="O").length,5);
      assert.equal(F.CIF.contactStructure(structure,1).atoms.length,16);
      assert.equal(F.CIF.contactStructure(structure,20).atoms.length,
        F.CIF.contactStructure(structure,9).atoms.length);
      const terminal=structure.atoms.find(a=>a.element==="O" &&
        F.CIF.contactStructure(structure,1,new Set([a.id])).atoms.length>structure.atoms.length);
      assert.ok(terminal);
      const targeted=F.CIF.contactStructure(structure,1,new Set([terminal.id]));
      assert.ok(targeted.atoms.length<F.CIF.contactStructure(structure,1).atoms.length);
    }
    assert.ok(structure.atoms.length && structure.atoms.every(a=> F.CIF.elements[a.element] && a.positionAngstrom.every(Number.isFinite)),v.title);
    assert.equal(new Set(structure.atoms.map(a=>a.id)).size,structure.atoms.length,v.title);
    if(v.cifMode==="cif-view:molecule")assert.equal(structure.atoms.length,molecules[path.basename(v.model,".cif")]);
    for(const polyhedron of structure.polyhedra || []) {
      assert.ok(F.CIF.polyhedronTriangles(polyhedron.neighbors.map(i=>structure.atoms[i].positionAngstrom)).length >= 4,v.title);
    }
    for(const b of structure.bonds) {
      assert.ok(structure.atoms[b.a] && structure.atoms[b.b] && b.distanceAngstrom>0,v.title);
      if(structure.mode!=="cell") {
        const a=structure.atoms[b.a].positionAngstrom,z=structure.atoms[b.b].positionAngstrom;
        assert.ok(Math.abs(Math.hypot(...a.map((p,i)=>p-z[i]))-b.distanceAngstrom)<0.03,v.title);
      }
    }
  }
}
const mixed = F.CIF.createStructure(fs.readFileSync(path.join(root,"assets/praktikum/AgHgI4-Hochtemperaturform.cif"),"utf8"),"cif-view:sites");
assert.equal(mixed.atoms.filter(a=>a.siteOccupants?.length===2 && a.occupancy===0.75).length,4);
assert.ok(mixed.atoms.some(a=>a.displayLabel==="Hg 25 % / Ag 50 % / leer 25 %"));
const ice = F.welcomeRoom.exhibits.find(e=>e.roomId==="vorlesung-2");
const iceSource = fs.readFileSync(path.join(root,ice.model),"utf8");
const iceCell = F.CIF.createStructure(iceSource,ice.variants[0].cifMode);
const iceLarge = F.CIF.createStructure(iceSource,ice.variants[1].cifMode);
assert.ok(iceCell.showHydrogenByDefault && iceCell.hydrogenContacts.length>0);
assert.equal(iceLarge.atoms.length,4*iceCell.atoms.length);
assert.ok(iceLarge.hydrogenContacts.length>iceCell.hydrogenContacts.length);
const nic = fs.readFileSync(path.join(root,"assets/praktikum/Nikotinsaeureamid_NICOAM05.cif"),"utf8");
assert.ok(F.CIFStructure.environmentCandidates(F.CIF.createStructure(nic,"cif-view:molecule"),3).length>0);
const nicMolecule=F.CIF.createStructure(nic,"cif-view:molecule");
const candidates=F.CIFStructure.environmentCandidates(nicMolecule,3);
const preview=F.CIF.environmentHydrogenDashes(nicMolecule,candidates.map(candidate=>({candidate,alpha:0.25})));
assert.ok(preview.length>0 && preview.every(dash=>dash.alpha===0.25));
const accepted=F.CIF.environmentHydrogenDashes(nicMolecule,candidates.map(candidate=>({candidate,alpha:1})));
assert.equal(accepted.length,preview.length);
assert.ok(accepted.every(dash=>dash.alpha===1));
assert.ok(F.CIF.createStructure(nic,"cif-view:molecular-cell").hydrogenContacts.every(c=>c.inferred));
assert.ok(F.CIF.createStructure(nic,"cif-view:molecular-cell").hydrogenContacts.length>0);
for(const id of ["vorlesung-1","vorlesung-2","vorlesung-3","vorlesung-6","vorlesung-7","vorlesung-8","team-a","team-b"]){
  assert.match(F.welcomeRoom.exhibits.find(e=>e.roomId===id).model,/\.cif$/);
}
const precursor = teamB.stations[0];
const educt = fs.readFileSync(path.join(root, precursor.model), "utf8");
const views = precursor.variants.map(v => F.CIF.createStructure(educt, v.cifMode));
const [complex, cell, coordination] = views;
assert.deepEqual(Array.from(views,v=>[v.atoms.length,v.bonds.length]), [[37,40],[156,160],[7,6]]);
assert.deepEqual(Array.from(coordination.atoms, a=>a.element).sort(), ["Co","N","N","O","O","O","O"]);
assert.equal(coordination.polyhedra[0].neighbors.length,6);
assert.ok(complex.atoms.every(atom=>atom.element!=="Cl"));
assert.equal(cell.atoms.filter(atom=>atom.element==="Cl").length,8);
assert.equal(cell.hydrogenContacts.length,32);
for(const view of [complex,coordination]) for(const bond of view.bonds){
  const a=view.atoms[bond.a].positionAngstrom,b=view.atoms[bond.b].positionAngstrom;
  assert.ok(Math.abs(Math.hypot(...a.map((v,i)=>v-b[i]))-bond.distanceAngstrom)<1e-7);
}
assert.deepEqual(referenced.sort(), fs.readdirSync(path.join(root,"assets/praktikum")).filter(file=>file.endsWith(".cif")).sort());
const exhibit = F.welcomeRoom.exhibits.find(entry => entry.roomId === "team-b");
assert.equal(exhibit.model, "assets/structures/Co-Produkt1.cif");
assert.equal(exhibit.model, station.model);
assert.equal(exhibit.cifMode, "molecule");
assert.deepEqual(exhibit.variants, station.variants);
F.RoomBuilder.build(container, F.welcomeRoom, F.rooms);
const model = nodes.get(`welcome-model-${index + 1}`);
assert.equal(model.fkcVariantAlignment, "individual");
assert.equal(model.fkcVariantId, "co-complex");
assert.equal(model.fkcVariants.length, 3);
assert.equal(model.fkcModelSize, F.welcomeRoom.modelSize);
const expected = {molecule: 64, cell: 72, coordination: 7};
for (const variant of model.fkcVariants) {
  const structure = F.CIF.createStructure(fs.readFileSync(path.join(root, variant.model), "utf8"), variant.cifMode);
  assert.equal(structure.atoms.length, expected[variant.cifMode]);
  assert.ok(structure.atoms.every(atom => atom.positionAngstrom.every(Number.isFinite)));
}
console.log("Co-Begrüßungsmodell: Raumzuordnung, Varianten und CIF-Messkoordinaten geprüft.");