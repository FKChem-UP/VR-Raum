"use strict";

(function (F) {
  const T = AFRAME.THREE;
  function normal(a, b, c) {
    const u = b.map((n,i)=>n-a[i]), v = c.map((n,i)=>n-a[i]);
    const n = [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const length = Math.hypot(...n);
    return length > 1e-6*Math.hypot(...u)*Math.hypot(...v) ? n.map(x=>x/length) : null;
  }
  const visualOf = root => root?.querySelector(".model-visual");
  const records = new WeakMap();
  const midpoints = new WeakMap();
  function disposeMesh(mesh) {
    mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose();
  }
  function remove(record) {
    for (const mesh of [...record.marks, record.mesh].filter(Boolean)) disposeMesh(mesh);
    record.marks=[]; record.mesh=null;
  }
  F.AtomPlane = {
    normal, active:null,
    get(root) { return records.get(visualOf(root)); },
    midpointCount(root) { return midpoints.get(visualOf(root))?.length || 0; },
    clearMidpoints(root) {
      const visual=visualOf(root);
      for(const record of midpoints.get(visual) || []) remove(record);
      midpoints.delete(visual);
    },
    cancel() {
      const record=this.active; if(!record)return;
      remove(record);
      if(!record.midpoint) records.delete(record.visual);
      this.active=null;
    },
    begin(root, {accept=()=>true, complete=null, midpoint=false}={}) {
      const visual=visualOf(root);
      if(!visual || root.fkcPendingVisual)return;
      if(this.active?.visual===visual && this.active.midpoint===midpoint){this.cancel();return;}
      this.cancel();
      if(!midpoint) this.clear(root);
      F.Measure?.setEnabled(false);
      F.Draw.setMode("laser");
      visual.setAttribute("fkc-atom-plane", "");
      const record={visual,root,accept,complete,midpoint,points:[],marks:[],mesh:null,color:F.Draw.color,
        thickness:2*F.Settings.strokeRadius,opacity:F.Draw.opacity,visible:true};
      if(!midpoint) records.set(visual,record);
      this.active=record;
      F.setStatus(midpoint ? "Mittelpunkt: Zwei verschiedene Punkte auswählen (0/2)." : "Ebene: Drei verschiedene Punkte auswählen (0/3).");
    },
    clear(root) {
      const record=this.get(root);if(!record)return;
      if(this.active===record)this.active=null;
      remove(record);records.delete(record.visual);
    },
    click(hit) {
      const r=this.active;
      if(!r || F.Draw.mode!=="laser")return false;
      if(!r.visual.isConnected || visualOf(r.root)!==r.visual){this.cancel();return false;}
      const atom=hit.mesh?.userData.fkcAtom;
      if(hit.el!==r.root){this.cancel();return false;}
      if(!atom || !r.accept(atom))return true;
      if(hit.mesh.userData.fkcEnvironmentId && !F.CIF.environmentState(r.root)?.selected.has(hit.mesh.userData.fkcEnvironmentId))return true;
      if(r.points.some(p=>p.mesh===hit.mesh))return true;
      const center=r.visual.object3D.worldToLocal(hit.mesh.getWorldPosition(new T.Vector3()));
      if(r.points.some(p=>p.center.distanceTo(center)<1e-8))return true;
      const pts=[...r.points.map(p=>p.center.toArray()),center.toArray()];
      const n=pts.length===3 ? normal(...pts) : null;
      if(pts.length===3 && !n){F.setStatus("Die drei Punkte liegen auf einer Geraden. Wähle einen anderen dritten Punkt.");return true;}
      r.points.push({mesh:hit.mesh,center});
      const add=(geometry,material)=>{
        const mesh=new T.Mesh(geometry,material);mesh.raycast=()=>{};mesh.userData.fkcDrawing=true;
        r.visual.object3D.add(mesh);return mesh;
      };
      const scale=r.visual.object3D.getWorldScale(new T.Vector3()).x;
      const atomRadius=hit.mesh.getWorldScale(new T.Vector3()).x*(hit.mesh.geometry?.parameters?.radius ?? 1);
      const mark=add(new T.SphereGeometry(Math.min(0.012,Math.max(0.002,atomRadius*0.32))/scale,12,8),
        new T.MeshBasicMaterial({color:0xffbb22,wireframe:true,depthTest:false,depthWrite:false,transparent:true}));
      mark.position.copy(center);mark.renderOrder=1080;r.marks.push(mark);
      if(r.midpoint){
        if(pts.length===1){F.setStatus("Mittelpunkt: 1/2 Punkte ausgewählt.");return true;}
        r.mesh=add(new T.SphereGeometry(0.008/scale,16,12),new T.MeshBasicMaterial({color:0x18d8de,depthTest:false,depthWrite:false}));
        r.mesh.position.copy(r.points[0].center).add(center).multiplyScalar(0.5);
        r.mesh.renderOrder=1080;
        r.marks.forEach(disposeMesh);r.marks=[];
        const list=midpoints.get(r.visual) || [];
        list.push(r);midpoints.set(r.visual,list);
        this.active=null;F.setStatus("Mittelpunkt erzeugt.");return true;
      }
      if(!n){F.setStatus(`Ebene: ${pts.length}/3 Punkte ausgewählt.`);return true;}
      const points=r.points.map(p=>p.center);
      const size=Math.max(points[0].distanceTo(points[1]),points[1].distanceTo(points[2]),points[2].distanceTo(points[0]))*1.5;
      r.mesh=add(new T.BoxGeometry(size,size,1),new T.MeshBasicMaterial({transparent:true,depthWrite:false}));
      r.mesh.position.copy(points[0]).add(points[1]).add(points[2]).multiplyScalar(1/3);
      r.mesh.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(...n));
      r.baseScale=scale;
      r.marks.forEach(disposeMesh);r.marks=[];
      this.active=null;this.style(r,{});F.setStatus("Ebene aus drei Punkten erzeugt.");r.complete?.(r);
      return true;
    },
    style(r, change) {
      if(!r?.mesh)return;
      Object.assign(r,change);r.mesh.material.color.set(r.color);r.mesh.material.opacity=r.opacity;
      r.mesh.scale.z=r.thickness/r.baseScale;r.mesh.visible=r.visible;
    }
  };
  AFRAME.registerComponent("fkc-atom-plane", {
    tick() {
      const tool=F.AtomPlane, r=records.get(this.el);
      const missing=record=>record.points.some(p=>!this.el.object3D.getObjectById(p.mesh.id));
      if(tool.active?.visual===this.el && missing(tool.active)) tool.cancel();
      if(r && records.has(this.el) && missing(r)){remove(r);records.delete(this.el);}
      const saved=midpoints.get(this.el);
      if(saved){
        const remaining=saved.filter(record=>{if(!missing(record))return true;remove(record);return false;});
        if(remaining.length!==saved.length)midpoints.set(this.el,remaining);
      }
    },
    remove() {
      if(F.AtomPlane.active?.visual===this.el)F.AtomPlane.cancel();
      for(const record of midpoints.get(this.el) || [])remove(record);
      midpoints.delete(this.el);
      const r=records.get(this.el);if(!r)return;
      remove(r);records.delete(this.el);
    }
  });
})(window.FKCVR);