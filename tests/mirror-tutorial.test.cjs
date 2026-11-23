"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const F = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/mirror-tutorial.js"), "utf8"), {window: {FKCVR: F}});
const {atoms, project, plane, reflect, invert, solution, check} = F.MirrorTutorial;
const near = (a, b) => Math.hypot(...a.map((p, k) => p - b[k])) < 1e-8;
assert.ok(near(invert(atoms[0]), atoms[0]));
for(const p of atoms.slice(1)){assert.ok(near(invert(invert(p)),p));assert.ok(!atoms.some(a=>near(invert(p),a)));}
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
class Vec { set(x=0,y=0,z=0){this.xyz=[x,y,z];return this;} fromArray(p){return this.set(...p);} multiplyScalar(){return this;} copy(){return this;}
  clone(){return new Vec().fromArray(this.xyz||[0,0,0]);} distanceTo(other){return Math.hypot(...(this.xyz||[0,0,0]).map((n,i)=>n-other.xyz[i]));} }
class Obj { constructor(){this.position=new Vec();this.scale={x:1,setScalar(n){this.x=n;}};this.quaternion={setFromUnitVectors(){},copy(){}};this.visible=true;}
  add(){} dispose(){} }
class Mesh extends Obj {constructor(g,m){super();this.material=m;this.userData={};} }
class Material extends Obj {constructor(){super();this.color={set(){}};} }
const T={Group:Obj,Vector3:Vec,Mesh,MeshBasicMaterial:Material,SphereGeometry:Obj,PlaneGeometry:Obj,BoxGeometry:Obj,CylinderGeometry:Obj,CanvasTexture:Obj};
const ctx=new Proxy({}, {get:(o,k)=>o[k]||(()=>{})});
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../js/mirror-tutorial.js"),"utf8"),{window:{FKCVR:F},AFRAME:{THREE:T},document:{createElement:()=>({getContext:()=>ctx})}});
let manipBody;
F.create=(tag,attrs)=>{const entity={object3D:new Obj(),dataset:{},setObject3D(){},setAttribute(){},remove(){}};
  if(attrs.class==="manip-body")manipBody=entity;return entity;};
const ink=[];
let samples=0;
F.Draw={color:"gold",mode:"laser",setMode(mode){this.mode=mode;},sampleSurface(last){samples++;if(last)return last;const s={color:this.color,worldRadius:0.004,opacity:0.6,material:{}};ink.push(s);return s;},remove(s){ink.splice(ink.indexOf(s),1);},clear(){ink.length=0;}};
F.HandMenu={laserHand:()=>"right"};F.releaseModel=()=>{};
const station=F.MirrorTutorial.station({});
function paint(view,p,held=true){station.tick({el:station.board,uv:{x:((view?760:264)+116*p[0])/1024,y:1-(278-116*p[1])/640}},held,true,station.drawingMenu);}
function line(i){paint(0,project(0,atoms[i]));paint(0,[0,0]);paint(0,[0,0],false);}
station.tick(null,false,true,false,false);assert.equal(station.step,1);
station.root.object3D.position.set(0.2,0,0);station.tick(null,false,true,false,false);assert.equal(station.step,1);
manipBody.object3D.scale.x=0.8;station.tick(null,false,true,false,false);assert.equal(station.step,2);
paint(0,project(0,atoms[1]));paint(0,[0,0]);assert.equal(station.step,2);
const atB=samples;paint(0,[-0.45,-0.12]);assert.equal(samples,atB+1);paint(0,[0,0],false);
assert.equal(station.step,3);assert.equal(ink.length,1);assert.equal(F.Draw.mode,"laser");
const clickTile=x=>station.click({x:x/1024,y:1-590/640});
clickTile(120);station.tick(null,false,true,false,false,0.5);assert.equal(station.step,3);
station.tick(null,false,true,false,false,1.4);assert.equal(station.step,4);
station.tick(null,false,true,true,false);assert.equal(station.step,4);
station.tick(null,false,true,false,true);assert.equal(station.step,5);
station.tick(null,false,true,true,true);assert.equal(station.cue(),"mirror:menu");station.menu();assert.equal(station.step,7);
assert.equal(F.Draw.mode,"paint");
station.color("gold");line(2);assert.equal(station.step,7);station.color("blue");line(2);assert.equal(station.step,8);
line(3);assert.equal(station.step,8);station.color("red");line(3);assert.equal(station.step,9);
paint(1,[0,0]);assert.equal(ink.length,3);clickTile(900);assert.equal(station.step,10);paint(1,[0,0],false);
paint(1,[0,0]);assert.equal(station.step,11);assert.equal(ink.length,4);
clickTile(900);station.tick(null,false,true,false,true,0.9);assert.equal(station.step,11);
station.tick(null,false,true,false,true,0.9);assert.equal(station.step,12);
station.undo();assert.equal(station.step,13);assert.equal(ink.length,3);assert.equal(station.drawingMenu,true);
station.modelMenu();assert.equal(station.step,14);assert.equal(F.Draw.mode,"laser");
let planeOptions;F.AtomPlane={begin(root,opts){assert.equal(root,station.root);planeOptions=opts;},get(){},clear(){}};
station.startPlane();assert.equal(station.step,15);assert.equal(planeOptions.accept({element:"B"}),false);
assert.equal(planeOptions.accept({element:"F"}),true);planeOptions.complete();assert.equal(station.step,16);
station.clear();assert.equal(station.step,2);assert.equal(ink.length,0);assert.equal(station.drawingMenu,false);
paint(0,[0,0],false);line(1);assert.equal(station.step,3,"Nach Zurücksetzen erneut zeichnen und testen");
station.dispose();
console.log("BF₃: Laserstrich über B hinaus, Modellmenü und anschließende Zeichenaufgaben geprüft.");