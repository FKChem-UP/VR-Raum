"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const F = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/mirror-tutorial.js"), "utf8"), {window: {FKCVR: F}});
const {atoms, project, plane, reflect, solution, check} = F.MirrorTutorial;
const near = (a, b) => Math.hypot(...a.map((p, k) => p - b[k])) < 1e-8;
assert.equal(new Set(atoms.map(p => project(1, p)[0])).size, 4, "Getrennte Atomzentren in der Seitenansicht");
for (const view of [0, 1]) {
  const line = solution(view), m = plane(view, ...line);
  assert.ok(check(view, line)); assert.ok(check(view, line.slice().reverse()));
  for (const [i, p] of atoms.entries()) {
    const q = reflect(p, m);
    assert.ok(near(reflect(q, m), p));
    assert.ok(near(q, atoms[view === 0 ? [0, 1, 3, 2][i] : i]));
  }
  assert.equal(check(view, [[0, 0], [0, 0]]), null);
  assert.equal(check(view, [[0, 1], [0.1, 1]]), null);
  assert.equal(check(view, [[-1, 0.5], [1, 0.5]]), null);
  assert.ok(check(view, line.map(p => [p[0] + 0.02, p[1] - 0.03])), "Toleranz für Handstrich");
}
for (const f of [2, 3]) {
  assert.equal(check(0, solution(0, f), false), null);
  assert.ok(check(0, solution(0, f), true), "Weitere Spiegelebenen im freien Modus");
}
// Geführte Eingaben ohne XR-Renderer: echte Stationslogik mit kleinen Zeichen-/Mesh-Doubles.
class Vec { set() {return this;} fromArray(){return this;} multiplyScalar(){return this;} copy(){return this;} }
class Obj { constructor(){this.position=new Vec();this.scale={setScalar(){}};this.quaternion={setFromUnitVectors(){}};this.visible=true;}
  add(){} dispose(){} }
class Mesh extends Obj {constructor(g,m){super();this.material=m;} }
class Material extends Obj {constructor(){super();this.color={set(){}};} }
const T={Group:Obj,Vector3:Vec,Mesh,MeshBasicMaterial:Material,SphereGeometry:Obj,PlaneGeometry:Obj,CylinderGeometry:Obj,CanvasTexture:Obj};
const ctx=new Proxy({}, {get:(o,k)=>o[k]||(()=>{})});
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../js/mirror-tutorial.js"),"utf8"),{window:{FKCVR:F},AFRAME:{THREE:T},document:{createElement:()=>({getContext:()=>ctx})}});
F.create=()=>({object3D:new Obj(),dataset:{},setObject3D(){},setAttribute(){},remove(){}});
const ink=[];
F.Draw={color:"gold",mode:"laser",setMode(mode){this.mode=mode;},sample(last){if(last)return last;const s={color:this.color};ink.push(s);return s;},remove(s){ink.splice(ink.indexOf(s),1);},clear(){}};
F.HandMenu={laserHand:()=>"right"};F.releaseModel=()=>{};
const station=F.MirrorTutorial.station({});
function paint(view,p,held=true){station.tick({el:station.board,uv:{x:((view?760:264)+116*p[0])/1024,y:1-(278-116*p[1])/640}},held,true,false);}
function line(i){paint(0,project(0,atoms[i]));paint(0,[0,0]);paint(0,[0,0],false);}
station.tick(null,false,true,false,false);line(1);assert.equal(station.step,1);assert.equal(ink.length,0);
station.tick(null,false,true,true,false);assert.equal(station.step,1);
station.tick(null,false,true,false,true);assert.equal(station.step,2);
station.tick(null,false,true,true,true);assert.equal(station.cue(),"mirror:menu");station.menu();assert.equal(station.step,4);
assert.equal(F.Draw.mode,"paint");line(1);assert.equal(station.step,5);
station.color("gold");line(2);assert.equal(station.step,5);station.color("blue");line(2);assert.equal(station.step,6);
line(3);assert.equal(station.step,6);station.color("red");line(3);assert.equal(station.step,7);
paint(1,[0,0]);assert.equal(station.step,8);assert.equal(ink.length,4);
station.undo();assert.equal(station.step,9);assert.equal(ink.length,3);assert.equal(station.drawingMenu,true);
station.dispose();
console.log("BF₃: Projektionen, Spiegelungen und neun Zeichenschritte mit Farbwechsel und Rückgängig geprüft.");