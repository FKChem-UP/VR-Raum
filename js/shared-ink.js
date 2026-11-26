"use strict";

(function () {
  // Small presence snapshots, not a persistent sketchbook. New peers need no replay.
  const limit = 24, maxPoints = 128, budget = 8192;
  const finite = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
  function valid(s, room) {
    if (!s || !Number.isSafeInteger(s.id) || s.id < 1 || typeof s.color !== "string" ||
        !/^#[0-9a-f]{6}$/i.test(s.color) || !finite(s.opacity,0,1)) return false;
    if (s.model !== undefined && (typeof s.model !== "string" || !s.model.startsWith(room + "-model-") ||
        !/^(?:[1-9]|1[0-6])$/.test(s.model.slice(room.length+7)) || typeof s.variant !== "string" ||
        s.variant.length > 96 || !s.variant.length)) return false;
    if (s.kind === "atom" || s.kind === "bond") return !!s.model && typeof s.key === "string" && s.key.length > 0 && s.key.length <= 128;
    return s.kind === "line" && finite(s.radius,0.00001,0.5) && Array.isArray(s.points) &&
      s.points.length >= 3 && s.points.length <= maxPoints*3 && s.points.length%3 === 0 && s.points.every(n=>finite(n,-200,200));
  }
  function normalize(input, room) {
    if (!Array.isArray(input)) return [];
    const result = [], ids = new Set(); let bytes = 0;
    for (const s of input.slice(-limit).reverse()) {
      if (!valid(s,room) || ids.has(s.id)) continue;
      const item = {id:s.id, kind:s.kind, color:s.color, opacity:s.opacity};
      if (s.model) Object.assign(item,{model:s.model,variant:s.variant});
      if (s.kind === "line") Object.assign(item,{points:s.points.slice(),radius:s.radius}); else item.key=s.key;
      const len=JSON.stringify(item).length+1;
      if (bytes+len>budget) break;
      bytes+=len; ids.add(s.id); result.push(item);
    }
    return result.reverse();
  }
  if (typeof module === "object") { module.exports={normalize}; return; }
  const F=window.FKCVR, T=AFRAME.THREE, localCache=new WeakMap();
  const round=n=>Math.round(n*10000)/10000;
  function collect(room) {
    const root=document.getElementById("room-root");
    if (!root) return [];
    const items=[];
    for (const s of F.Draw.strokes.slice(-limit)) {
      if (!root.contains(s.owner) || s.removed) continue;
      if (s.variant && (s.owner.fkcVariantId || "base") !== s.variant) continue;
      if (s.overlays && !s.owner.object3D.getObjectById(s.overlays[0]?.id)) continue;
      const cached=localCache.get(s);
      if (cached && cached.count===s.count) { items.push(cached.item); continue; }
      const item={id:s.inkId,kind:s.paintKind || "line",color:s.color,opacity:s.opacity};
      if (s.variant) Object.assign(item,{model:s.owner.id,variant:s.variant});
      if (s.overlays) item.key=String(s.paintKey);
      else {
        // Models use manip-body coordinates. Static surfaces use room-root coordinates,
        // because A-Frame-generated surface ids are not stable across headsets.
        const matrix = !s.variant && new T.Matrix4().copy(root.object3D.matrixWorld).invert().multiply(s.parent.matrixWorld);
        item.radius=round(matrix ? s.worldRadius : s.radius);
        item.points=[];
        for(const p of s.centers){const v=matrix?p.clone().applyMatrix4(matrix):p;item.points.push(round(v.x),round(v.y),round(v.z));}
      }
      localCache.set(s,{count:s.count,item});items.push(item);
    }
    return normalize(items,room);
  }
  function sync(displays, peers, room) {
    const keep=new Set();
    for(const peer of peers) for(const s of peer.ink || []) {
      const key=peer.id+":"+s.id;
      const owner=document.getElementById(s.model || "room-root");
      if(!owner || (s.model && (!s.model.startsWith(room+"-model-") || !owner.modelReady || owner.fkcPendingVisual ||
        (owner.fkcVariantId || "base")!==s.variant))) continue;
      const body=s.model ? owner.querySelector(".manip-body") : owner;
      if(!body) continue;
      const old=displays.get(key), visual=s.model && owner.querySelector(".model-visual")?.getObject3D("mesh");
      // Each stroke id is immutable except for appending points.
      if(old && old.parent===body.object3D && old.visual===visual && old.count===(s.points?.length || 0)) {keep.add(key);continue;}
      if(old){F.Draw.remove(old.stroke);displays.delete(key);}
      let stroke;
      if(s.kind==="line") {
        const point=new T.Vector3().fromArray(s.points), up=new T.Vector3(0,1,0);
        stroke=F.Draw.createStroke({el:owner,normal:up},body.object3D,point,s.radius,s.color,s.radius,true,s.opacity);
        const previous=point.clone();
        for(let i=3;i<s.points.length;i+=3){point.fromArray(s.points,i);F.Draw.addRing(stroke,point,point.clone().sub(previous));previous.copy(point);}
      } else {
        const targets=[];
        visual?.traverse(mesh=>{
          const atom=mesh.userData.fkcAtom,bond=mesh.userData.fkcBond;
          const id=s.kind==="atom"?atom?.id:bond && (bond.bondId || bond.id || `${bond.a}:${bond.b}`);
          if(id!=null && String(id)===s.key) targets.push(mesh);
        });
        if(!targets.length) continue;
        stroke=F.Draw.objectOverlay(targets,s.color,s.opacity);
      }
      keep.add(key);displays.set(key,{stroke,parent:body.object3D,visual,count:s.points?.length || 0});
    }
    for(const [key,entry] of displays) if(!keep.has(key)){F.Draw.remove(entry.stroke);displays.delete(key);}
  }
  F.SharedInk={collect,sync,normalize};
})();