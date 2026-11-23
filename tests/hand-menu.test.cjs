"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const F = {Settings: {laserHand: "right", lasers:{right:"#ff9d38"},laserDiameter:0.003}};
F.Draw = {mode: "laser", color: "#ffcc33", opacity: 0.35, strokes: [],
  setMode(mode) { this.mode = mode; }, clear() {}, remove() {}};
const components = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/hand-menu.js"), "utf8"), {
  window: {FKCVR: F}, document:{getElementById:()=>null},
  AFRAME: {THREE: {}, registerComponent: (name, component) => { components[name] = component; }}
});
const state = {open: false, since: null};
assert.equal(F.HandMenu.gate(state, true, 0.9, 0), false);
assert.equal(F.HandMenu.gate(state, true, 0.9, 299), false);
assert.equal(F.HandMenu.gate(state, true, 0.9, 300), true);
assert.equal(F.HandMenu.gate(state, true, 0.6, 400), true, "Hysterese hält Menü offen");
assert.equal(F.HandMenu.gate(state, true, 0.4, 450), false);
assert.equal(F.HandMenu.gate(state, true, 0.6, 500), false, "Schwelle zum Öffnen höher");
assert.equal(F.HandMenu.gate(state, true, 0.9, 600), false);
assert.equal(F.HandMenu.gate(state, false, 0.9, 950), false);
assert.equal(state.since, null, "Trackingverlust/Greifen/Hauptmenü setzt Verzögerung zurück");
let hidden = 0;
let blocked = 0;
F.getScene = () => ({components: {"fkc-hand-menu": {hide() { hidden++; }}}});
F.Menu = {blockDrawing() { blocked++; }};
assert.equal(F.HandMenu.laserHand(), "right");
F.HandMenu.setLaserHand("left");
assert.equal(F.HandMenu.laserHand(), "left");
assert.equal(hidden, 1);
assert.equal(blocked, 1);
F.HandMenu.setLaserHand("invalid");
assert.equal(F.HandMenu.laserHand(), "left");
F.HandMenu.setLaserHand("right");
assert.equal(F.HandMenu.laserHand(), "right");
assert.ok(components["fkc-hand-menu"]);
assert.equal(F.HandMenu.legendInk("#000000"), "#ffffff");
assert.equal(F.HandMenu.legendInk("#515151"), "#ffffff");
assert.equal(F.HandMenu.legendInk("#ffffff"), "#000000");
assert.equal(F.HandMenu.legendInk("#eeeeee"), "#000000");
// Viewerpose muss Vorrang vor einer möglicherweise versetzten XR-Kamera haben.
const position = {
  copy(value) { this.value = value; return this; },
  applyMatrix4(matrix) { this.matrix = matrix; return this; }
};
const reference = {};
const matrixWorld = {};
let rigUpdated = false;
const rig = {object3D: {
  matrixWorld,
  updateWorldMatrix() { rigUpdated = true; }
}};
const viewerPosition = {x: 0.1, y: 1.6, z: 0.2};
const scene = {
  renderer: {xr: {getReferenceSpace: () => reference}},
  frame: {getViewerPose(space) {
    assert.equal(space, reference);
    return {transform: {position: viewerPosition}};
  }},
  camera: {getWorldPosition() { throw new Error("Keine XR-Kamera statt Viewerpose verwenden"); }}
};
assert.equal(F.HandMenu.readViewerHead(scene, rig, position), true);
assert.equal(position.value, viewerPosition);
assert.equal(position.matrix, matrixWorld);
assert.equal(rigUpdated, true);
scene.frame.getViewerPose = () => null;
assert.equal(F.HandMenu.readViewerHead(scene, rig, position), false);
let cameraUpdated = false;
const fallback = {camera: {
  updateWorldMatrix() { cameraUpdated = true; },
  getWorldPosition(out) { out.copy(viewerPosition); }
}};
assert.equal(F.HandMenu.readViewerHead(fallback, null, position), true);
assert.equal(cameraUpdated, true);
assert.equal(F.HandMenu.readViewerHead({}, null, position), false);
const ctx = {};
for (const method of ["save","restore","translate","ellipse"]) ctx[method]=()=>{};
const drawnTexts = [];
const drawnRectangles = [];
for (const method of ["fillRect", "fillText", "strokeRect", "beginPath", "moveTo", "lineTo", "stroke", "arc", "fill"]) {
  ctx[method] = function () {};
}
ctx.fillText = function (text, x, y) { drawnTexts.push({text, x, y, ink: this.fillStyle}); };
ctx.fillRect = function (x, y, w, h) { drawnRectangles.push({x, y, w, h}); };
let mode = "distance";
let enabled = false;
F.Measure = {
  titles: {distance: "Distanz", angle: "Winkel", torsion: "Torsion"},
  counts: {distance: 2, angle: 3, torsion: 4},
  get mode() { return mode; }, get enabled() { return enabled; },
  toggleMode(value) { enabled = !(enabled && mode === value); mode = value; }
};
F.CIF = {styles: ["ball-stick", "space-filling", "wires", "capped-sticks"].map(id => ({id})), setStyle() {}};
F.CIF.availableStyles = structure => structure.polyhedra ? F.CIF.styles.concat({id: "polyhedral"}) : F.CIF.styles;
F.AtomLabels = {modes:{hover:"Beim Anvisieren",all:"Alle","no-h":"Keine H","no-ch":"Keine C/H",off:"Aus"},setMode() {}};
const model = {
  dataset: {title: "C60"},
  fkcVariants: [1, 2, 3].map(id => ({id, title: "Ansicht " + id})),
  querySelector: () => ({object3D: {traverse() {}}})
};
const menu = Object.assign({ctx, model, offset: 0, texture: {},
  el: {components: {"fkc-measurements": {reset() {}}}}}, components["fkc-hand-menu"]);
const structure = {mode: "molecule", atoms: new Array(60), spaceGroup: {name: "Pa-3"}};
menu.render(structure);
const inkOf = title => drawnTexts.findLast(entry => entry.text === title)?.ink;
assert.equal(inkOf("Modellmenü"),"#203f30");
const press=label=>{const b=menu.buttons.find(entry=>entry.label===label);assert.ok(b,label);b.action();};
assert.equal(inkOf("H-Atome"),"#191919");
const h=menu.buttons.find(b=>b.label==="Sichtbar"),hb=menu.buttons.find(b=>b.label==="Aus · keine Daten");
assert.equal(h.y,hb.y);assert.ok(h.w>=340 && h.h>=72);
press("Distanz · Winkel · Torsion");menu.render(structure);
press("Distanz");assert.equal(mode,"distance");assert.ok(enabled);
press("Winkel");assert.equal(mode,"angle");press("Winkel");assert.ok(!enabled);
const b=menu.buttons.find(b=>b.label==="Winkel");
assert.equal(menu.buttons[menu.buttonIndex({x:(b.x+b.w/2)/768,y:1-(b.y+b.h/2)/900})],b);
press("‹ Modellmenü");menu.render(structure);press("Kugel–Stab");
menu.render({...structure,polyhedra:[{}]});
assert.ok(menu.buttons.some(b=>b.kind==="polyhedral"));
assert.ok(menu.buttons.filter(b=>b.y>=115).every(b=>b.w>=340 && b.y+b.h<=900));
press("‹ Modellmenü");menu.render(structure);
F.invalidateHits = () => {};
let menuScale = 1;
menu.root = {object3D: {scale: {setScalar(value) { menuScale = value; }}, updateWorldMatrix() {}}};
F.getScene = () => ({components: {"fkc-hand-menu": menu}});
menu.buttons.at(-1).action();
assert.equal(menu.page, "settings");
const bondChanges = [];
F.CIF.setBondAppearance = (...args) => bondChanges.push(args);
menu.render(structure);
assert.equal(menu.buttons.length, 17, "Einstellungen einschließlich drei Atomgrößen");
assert.ok(menu.buttons.every(button => button.y + button.h <= 900));
menu.buttons[1].action();
assert.equal(menuScale, 0.85);
menu.buttons[3].action();
assert.equal(menuScale, 1.15);
F.HandMenu.setSize("invalid");
assert.equal(menuScale, 1.15);
menu.buttons[2].action();
assert.equal(menuScale, 1);
menu.buttons[5].action();
assert.equal(bondChanges.at(-1)[1], "element");
menu.buttons[9].action();
assert.equal(bondChanges.at(-1)[1], "uniform");
assert.equal(bondChanges.at(-1)[2], "#ff9d38");
menu.buttons[10].action();
assert.equal(bondChanges.at(-1)[2], "#000000");
F.CIF.environmentState = () => ({radius: 3, enabled: false, selected: new Set()});
const environmentActions = [];
F.CIF.setEnvironment = (...args) => environmentActions.push(args);
const thicknessActions = [];
F.CIF.setBondThickness = (...args) => thicknessActions.push(args);
menu.render({...structure, environmentCell: {}});
assert.ok(menu.buttons.every(button => button.y + button.h <= 900), "Umgebungsradius passt auf Einstellungsseite");
menu.buttons[11].action();
assert.equal(thicknessActions.at(-1)[1], 0.5);
menu.buttons[0].action();
assert.equal(menu.page, "model");
menu.render({...structure, environmentCell: {}});
assert.ok(menu.buttons.every(button => button.y + button.h <= 900), "Umgebungsbuttons passen auf Werkzeugseite");
assert.ok(drawnTexts.at(-1).y <= 890, "Kurzinfo bleibt innerhalb der Fläche");
press("Ausschnitt erweitern");
menu.render({...structure,environmentCell:{}});
press("Vorschau einschalten"); assert.equal(environmentActions.at(-1)[1],true);
press("− Radius"); assert.equal(environmentActions.at(-1)[2],2.5);
press("+ Radius"); assert.equal(environmentActions.at(-1)[2],4);
press("‹ Modellmenü");
const originalQuery = model.querySelector;
model.querySelector = () => ({object3D: {traverse(callback) {
  ["Co", "N", "O", "Cl", "C", "H"].forEach(element => callback({userData: {fkcAtom: {element}},
    material: {color: {getHexString: () => "ffffff"}}}));
}}});
menu.render({...structure, environmentCell: {}});
const hLegend = drawnTexts.findLast(entry => entry.text === "H");
assert.ok(hLegend && hLegend.y < 890, "Sechste Atomsorte H vollständig im Co-Menü sichtbar");
model.querySelector = originalQuery;
const atomOptions = [];
F.CIF.setAtomOptions = (...args) => atomOptions.push(args);
F.CIF.maxContactDepth = 20;
const knot = {...structure, mode: "sites", contactExpansion: {}, contactDepth: 0,
  atoms: [{element: "Cu"}, {element: "O"}]};
menu.render(knot);
menu.buttons.find(button => button.label === "Sichtbar").action();
assert.deepEqual(atomOptions.at(-1), [model, true], "H schon vor der ersten Kontaktschale ausblendbar");
model.fkcHideHydrogen = true;
menu.render({...knot, atoms: [...knot.atoms, {element: "H"}], contactDepth: 4});
assert.ok(menu.buttons.every(button => button.y + button.h <= 900), "H-Schalter und Kontaktschalen passen auf die Fläche");
menu.buttons.find(button => button.label === "Ausgeblendet").action();
assert.deepEqual(atomOptions.at(-1), [model, false], "H nach der Erweiterung wieder einblendbar");
delete model.fkcHideHydrogen;
press("Ausschnitt erweitern");menu.render(knot);
const depths=[]; F.CIF.setContactDepth=(_,d)=>depths.push(d);
press("+ Eine Schale");assert.deepEqual(depths,[1]);
assert.ok(!menu.buttons.some(b=>b.label==="− Eine Schale"),"Keine negative Schalentiefe");
F.StructureAnalysis={begin(root){this.state={root,points:new Map()};},apply(poly){assert.equal(poly,false);},cancel(){this.state=null;}};
menu.render(knot);press("Startpunkte wählen");menu.render(knot);
assert.ok(!menu.buttons.some(b=>b.label==="Auswahl erweitern"));
F.StructureAnalysis.state.points.set({},{});menu.render(knot);press("Auswahl erweitern");
press("Auswahl beenden");assert.equal(F.StructureAnalysis.state,null);
menu.render(knot);press("‹ Modellmenü");menu.render(knot);
menu.buttons.find(button => button.label === "tool-mode").action();
assert.equal(F.Draw.mode, "laser", "Pinsel öffnet das Zeichenmenü, ohne gleich zu malen");
menu.render(structure);
assert.equal(inkOf("Zeichenmenü"),"#6b4613");
assert.equal(inkOf("Stiftfarbe"),"#6b4613");
assert.equal(inkOf("Malmodus: Aus"),"#191919");
assert.equal(inkOf("Schwarz"),"#ffffff");
assert.equal(inkOf("Weiß"),"#000000");
menu.buttons.find(button => button.label === "Malmodus: Aus").action();
assert.equal(F.Draw.mode, "paint");
menu.render(structure);
assert.equal(menu.buttons.some(button => button.kind === "variant"), false, "Malen hat keine Atom-/Messwerkzeuge");
menu.buttons.find(button => button.label === "Rot").action();
assert.equal(F.Draw.color, "#ee5151");
menu.buttons.find(button => button.label === "20 %").action();
assert.equal(F.Draw.opacity, 0.2);
menu.buttons.at(-1).action();
menu.render(structure);
assert.ok(menu.buttons.every(button => button.y + button.h <= 900));
menu.buttons.find(button => button.label === "Rot").action();
assert.equal(F.Settings.lasers.right,"#ee5151");
menu.buttons.find(button => button.label === "6 mm").action();
assert.equal(F.Settings.laserDiameter,0.006);
menu.buttons[0].action();
menu.render(structure);
menu.buttons.find(button => button.label === "tool-mode").action();
assert.equal(F.Draw.mode, "laser");
menu.render(null);
menu.buttons.at(-1).action();
menu.render(null);
assert.equal(menu.buttons.length, 4, "GLB bietet Menügröße, aber keine CIF-Bindungsfarben");
menu.page = "model";
menu.el.components["fkc-tutorial"] = {phase:"mirror", mirror:{drawingMenu:false}};
for (const method of ["save","restore","translate","ellipse"]) ctx[method]=()=>{};
drawnTexts.length=0;menu.render(null,"mirror:menu",4);
assert.ok(drawnTexts.some(entry=>entry.text==="Messen"));
assert.ok(drawnTexts.some(entry=>entry.text==="Weitere Werkzeuge"));
assert.deepEqual(Array.from(menu.buttons,b=>b.label),["tool-mode"],"Nur der Pinsel ist im Tutorial-Modellmenü anwählbar");
menu.el.components["fkc-tutorial"] = {phase:"bragg",selectedAnimation:model,
  animation:{state:{angle:30,speed:1,source:"mo",running:false}}};
F.Bragg = {angleFor:()=>0};
menu.render(null);
assert.equal(inkOf("Animationsmenü"),"#782a2a");
assert.equal(inkOf("Abspieltempo"),"#782a2a");
assert.equal(inkOf("Start"),"#191919");
console.log("Handmenü-Logiktest bestanden: Handwahl, Einblendverzögerung, Hysterese und Rücksetzung.");
console.log("Modellmenütest bestanden: Kacheln, Messmodi, Nachbarmoleküle und gezielte Kontakterweiterung.");
console.log("Viewerpose-Test bestanden: Augenmittelpunkt, Rig-Transformation, Trackingverlust und Kamera-Rückfall.");