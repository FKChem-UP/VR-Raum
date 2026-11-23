"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
let blocks = 0;
let measurementStops = 0;
const F = {Menu: {blockDrawing() { blocks++; }},
  Measure: {enabled: true, setEnabled(value) { this.enabled = value; measurementStops++; }}};
class PaintMesh {
  constructor(geometry,material){Object.assign(this,{geometry,material,userData:{},children:[]});}
  add(child){child.parent=this;this.children.push(child);}
  removeFromParent(){this.parent.children.splice(this.parent.children.indexOf(this),1);}
}
class PaintMaterial { constructor(options){Object.assign(this,options);} dispose(){this.disposed=true;} }
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/drawing.js"), "utf8"), {
  window: {FKCVR: F}, AFRAME: {THREE: {Mesh:PaintMesh,MeshBasicMaterial:PaintMaterial}}, console: {info() {}}
});
assert.equal(F.Draw.mode, "laser");
assert.equal(F.Draw.opacity, 0.35);
assert.equal(F.Draw.sample(null, {}, "right"), null, "Laser zeichnet niemals");
F.Draw.setMode("paint");
assert.equal(measurementStops, 1);
assert.equal(F.Measure.enabled, false);
assert.equal(F.Draw.sample(null, {}, "right"), null, "Kein Malen ohne Oberflächennormale");
const poster = {type: "action", el: {dataset: {roomId: "team-b"}}, normal: {}};
assert.equal(F.Draw.surfaceHit(poster), null, "Raumwechselposter bleiben unbemalbar");
assert.equal(F.Draw.surfaceHit({...poster,type:"surface"}), null, "Auch als Flächentreffer bleibt das Poster geschützt");
assert.equal(F.Draw.surfaceHit({type: "action", el: {dataset: {fkcHandMenu: "true"}}, normal: {}}), null);
assert.equal(F.Draw.surfaceHit(null), null);
const surface = {type: "model", normal: {}};
assert.equal(F.Draw.surfaceHit(surface), surface);
assert.ok(F.Draw.surfaceHit({type:"surface",normal:{},el:{dataset:{}}}));
const group=new PaintMesh(), owner={};
const atom=new PaintMesh({},{}), halves=[new PaintMesh({},{}),new PaintMesh({},{}),new PaintMesh({},{})];
atom.userData.fkcAtom={id:"atom-1"};group.add(atom);
halves.forEach((mesh,i)=>{mesh.userData.fkcBond={id:`segment-${i}`,bondId:i===2?"other":"bond"};group.add(mesh);});
const paint=mesh=>({type:"model",mesh,el:owner,normal:{}});
const atomPaint=F.Draw.sample(null,paint(atom),"right");
assert.equal(atom.children.length,1);
const bondPaint=F.Draw.sample(atomPaint,paint(halves[0]),"right");
assert.deepEqual(halves.map(mesh=>mesh.children.length),[1,1,0]);
assert.equal(F.Draw.sample(bondPaint,paint(halves[1]),"right"),bondPaint,"Beide Hälften zählen als ein Malvorgang");
F.Draw.remove(bondPaint);assert.deepEqual(halves.map(mesh=>mesh.children.length),[0,0,0]);
F.Draw.clear(owner);assert.equal(atom.children.length,0);
F.Draw.setMode("invalid");
assert.equal(F.Draw.mode, "paint");
F.Draw.setMode("laser");
assert.equal(F.Draw.surfaceHit(poster), null);
assert.equal(blocks, 2);
console.log("Zeichenmodustest bestanden: Laserstandard, exklusiver Malmodus, Triggerblock und Normalschutz.");