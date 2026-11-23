"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
class V {
  constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
  set(x,y,z){return Object.assign(this,{x,y,z});}
  toArray(){return [this.x,this.y,this.z];} copy(v){Object.assign(this,v);return this;}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
  multiplyScalar(n){this.x*=n;this.y*=n;this.z*=n;return this;}
  distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z);}
}
class Resource {constructor(...args){this.args=args;} dispose(){this.disposed=true;}}
class Material extends Resource {constructor(){super();this.color={set:value=>{this.value=value;}};}}
class Mesh {constructor(geometry,material){Object.assign(this,{geometry,material,userData:{},position:new V(),scale:new V(1,1,1),
  quaternion:{setFromUnitVectors(){}},removeFromParent(){}});}}
const F={Draw:{mode:"laser",color:"#507dff",opacity:0.35,setMode(mode){this.mode=mode;}},Settings:{strokeRadius:0.004},
  setStatus(){},Measure:{setEnabled(){}}};
const components={};
const document={createElement:()=>({getContext:()=>({strokeText(){},fillText(){}})})};
class Sprite extends Mesh {constructor(material){super(null,material);} raycast(ray,hits){hits.push(this);}}
class SpriteMaterial extends Resource {constructor(options){super();Object.assign(this,options);}}
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../js/atom-plane.js"),"utf8"),{window:{FKCVR:F},document,AFRAME:{
  THREE:{Vector3:V,Mesh,MeshBasicMaterial:Material,BoxGeometry:Resource,SphereGeometry:Resource,
    CanvasTexture:Resource,Sprite,SpriteMaterial},registerComponent(n,c){components[n]=c;}}});
const tool=F.AtomPlane;
assert.equal(tool.normal([0,0,0],[1,0,0],[2,0,0]),null);
assert.equal(tool.normal([0,0,0],[1,0,0],[0,0,1])[1],-1);
let visual={isConnected:true,setAttribute(){},object3D:{worldToLocal:v=>v,getWorldScale:v=>v.copy(new V(2,2,2)),add(){}}};
const root={querySelector:()=>visual};
const originalVisual=visual;
function site(x,y,z,element="F"){return {el:root,mesh:{userData:{fkcAtom:{element,positionAngstrom:[x*2,y*2,z*2]}},
  getWorldPosition:v=>v.copy(new V(x,y,z)),getWorldScale:v=>v.copy(new V(0.1,0.1,0.1))}};}
let finished=0;
tool.begin(root,{accept:a=>a.element==="F",complete(){finished++;}});
const a=site(0,0,0), b=site(1,0,0);
tool.click(site(1,1,0,"B"));tool.click(a);tool.click(a);tool.click(b);tool.click(site(2,0,0));
assert.equal(tool.get(root).points.length,2);
assert.equal(tool.get(root).marks[0].geometry.args[0],0.006);
tool.click(site(0,1,0)); const plane=tool.get(root);
assert.equal(finished,1);assert.equal(tool.active,null);assert.equal(plane.mesh.scale.z,0.004);
tool.style(plane,{thickness:0.016,opacity:0.6,color:"#ffffff",visible:false});
assert.equal(plane.mesh.scale.z,0.008);assert.equal(plane.mesh.material.opacity,0.6);assert.equal(plane.mesh.visible,false);
assert.equal(plane.mesh.material.value,"#ffffff");
assert.equal(plane.name,"E1");assert.equal(plane.label.visible,false);
assert.equal(plane.normalAngstrom[2],1);
tool.style(plane,{visible:true});
const hits=[];
plane.mesh.raycast({camera:{}},hits);
assert.equal(hits.length,0,"Platte blockiert den Laser nicht");
plane.label.raycast({camera:{}},hits);
assert.equal(hits[0].userData.fkcConstruction,plane,"Label ist das Trefferziel");
F.Measure.enabled=true; F.Measure.wantsPlane=()=>false;
plane.label.raycast({camera:{}},hits);assert.equal(hits.length,1);
F.Measure.wantsPlane=()=>true;
plane.label.raycast({camera:{}},hits);assert.equal(hits.length,2);
F.Measure.enabled=false;
tool.begin(root,{midpoint:true});tool.click(a);tool.click(a);
assert.equal(tool.active.points.length,1);
const midpoint=tool.active;tool.click(b);
assert.deepEqual(midpoint.mesh.position.toArray(),[0.5,0,0]);
assert.equal(midpoint.name,"X1");assert.equal(Array.from(midpoint.positionAngstrom).join(),"1,0,0");
assert.equal(midpoint.mesh.userData.fkcConstruction,midpoint);
assert.equal(tool.get(root),plane,"Mittelpunkt verändert die Ebene nicht");
tool.begin(root,{midpoint:true});tool.click(a);tool.click(site(0,2,0));
assert.equal(tool.midpointCount(root),2);
tool.begin(root);tool.click(a);tool.click(b);tool.click(site(0,0,1));
assert.equal(tool.get(root).name,"E2");
assert.equal(tool.click({el:root,mesh:plane.mesh}),true);assert.equal(tool.get(root),plane);
tool.begin(root,{midpoint:true});tool.click(b);tool.begin(root,{midpoint:true});
assert.equal(tool.active,null);assert.equal(tool.midpointCount(root),2);
const midpointGeometry=midpoint.mesh.geometry;
tool.clearMidpoints(root);assert.equal(midpointGeometry.disposed,true);assert.equal(tool.midpointCount(root),0);
tool.begin(root,{midpoint:true});tool.click(a);const saved=tool.active;tool.click(b);
const savedGeometry=saved.mesh.geometry;
const geometry=plane.mesh.geometry;visual={};components["fkc-atom-plane"].remove.call({el:originalVisual});
assert.equal(savedGeometry.disposed,true);
assert.equal(geometry.disposed,true);assert.equal(tool.get(root),undefined);
visual=originalVisual;
tool.begin(root);
const fluorine=site(0,0,0);
fluorine.mesh.geometry={parameters:{radius:0.16}};
tool.click(fluorine);
assert.ok(Math.abs(tool.get(root).marks[0].geometry.args[0]-0.00256)<1e-10,
  "BF₃: Auswahlmarker verwendet den Radius der Kugel, nicht nur ihren Mesh-Maßstab");
tool.cancel();
console.log("Ebene und Mittelpunkt: Auswahl, Markergröße, Geometrie und Aufräumen geprüft.");