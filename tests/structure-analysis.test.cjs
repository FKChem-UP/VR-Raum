"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const F={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../js/structure-analysis.js"),"utf8"),{
  window:{FKCVR:F},AFRAME:{THREE:{}}
});
const {ring,compare}=F.StructureAnalysis;
const vertices=Array.from({length:6},(_,i)=>[Math.cos(i*Math.PI/3),Math.sin(i*Math.PI/3),0]);
const a=ring(vertices),b=ring(vertices.map(([x,y])=>[x+1.2,y,3.4]).reverse());
const result=compare(a,b);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} ≠ ${b}`);
near(result.height,3.4);near(result.offset,1.2);near(result.distance,Math.hypot(1.2,3.4));near(result.angle,0);
near(compare(a,ring(vertices.map(([x,y])=>[x,0,y]))).angle,90);
assert.throws(()=>ring([[0,0,0],[1,0,0],[2,0,0]]),/Umlaufrichtung/);
assert.throws(()=>ring(vertices.map(([x,y],i)=>[x,y,i===0?1:0])),/planaren/);
console.log("Ringanalyse: Schwerpunkt, Ebenenwinkel, Projektion und Versatz geprüft.");