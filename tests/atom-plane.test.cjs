"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
class V {
  constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
  toArray(){return [this.x,this.y,this.z];} copy(v){Object.assign(this,v);return this;}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
  multiplyScalar(n){this.x*=n;this.y*=n;this.z*=n;return this;}
  distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z);}
}
class Resource {dispose(){this.disposed=true;}}
class Material extends Resource {constructor(){super();this.color={set:value=>{this.value=value;}};}}
class Mesh {constructor(geometry,material){Object.assign(this,{geometry,material,userData:{},position:new V(),scale:new V(1,1,1),
  quaternion:{setFromUnitVectors(){}},removeFromParent(){}});}}
const F={Draw:{mode:"laser",color:"#507dff",opacity:0.35,setMode(mode){this.mode=mode;}},Settings:{strokeRadius:0.004},
  setStatus(){},Measure:{setEnabled(){}}};
const components={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../js/atom-plane.js"),"utf8"),{window:{FKCVR:F},AFRAME:{
  THREE:{Vector3:V,Mesh,MeshBasicMaterial:Material,BoxGeometry:Resource,SphereGeometry:Resource},registerComponent(n,c){components[n]=c;}}});
const tool=F.AtomPlane;
assert.equal(tool.normal([0,0,0],[1,0,0],[2,0,0]),null);
assert.equal(tool.normal([0,0,0],[1,0,0],[0,0,1])[1],-1);
let visual={isConnected:true,setAttribute(){},object3D:{worldToLocal:v=>v,getWorldScale:v=>v.copy(new V(2,2,2)),add(){}}};
const root={querySelector:()=>visual};
const originalVisual=visual;
function site(x,y,z,element="F"){return {el:root,mesh:{userData:{fkcAtom:{element}},
  getWorldPosition:v=>v.copy(new V(x,y,z)),getWorldScale:v=>v.copy(new V(0.1,0.1,0.1))}};}
let finished=0;
tool.begin(root,{accept:a=>a.element==="F",complete(){finished++;}});
const a=site(0,0,0), b=site(1,0,0);
tool.click(site(1,1,0,"B"));tool.click(a);tool.click(a);tool.click(b);tool.click(site(2,0,0));
assert.equal(tool.get(root).points.length,2);
tool.click(site(0,1,0)); const plane=tool.get(root);
assert.equal(finished,1);assert.equal(tool.active,null);assert.equal(plane.mesh.scale.z,0.004);
tool.style(plane,{thickness:0.016,opacity:0.6,color:"#ffffff",visible:false});
assert.equal(plane.mesh.scale.z,0.008);assert.equal(plane.mesh.material.opacity,0.6);assert.equal(plane.mesh.visible,false);
assert.equal(plane.mesh.material.value,"#ffffff");
const geometry=plane.mesh.geometry;visual={};components["fkc-atom-plane"].remove.call({el:originalVisual});
assert.equal(geometry.disposed,true);assert.equal(tool.get(root),undefined);
console.log("Atomebene: Dubletten, Kollinearität, Auswahlfilter, Stil und Aufräumen geprüft.");