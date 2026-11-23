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
  const planes = new WeakMap();
  const midpoints = new WeakMap();
  const numbers = new WeakMap();
  const selections = new WeakMap();
  function save(list, record) {
    const entries = list.get(record.visual) || [];
    entries.push(record); list.set(record.visual, entries);
  }
  function label(record, prefix) {
    const count = numbers.get(record.root) || {E:0, X:0};
    record.name = prefix + ++count[prefix]; numbers.set(record.root, count);
    const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.font = "bold 46px Arial"; ctx.textAlign = "center"; ctx.lineWidth = 6;
    ctx.strokeStyle = "#173527"; ctx.fillStyle = "#ffffff";
    ctx.strokeText(record.name,64,48,116); ctx.fillText(record.name,64,48,116);
    const texture = new T.CanvasTexture(canvas);
    const sprite = new T.Sprite(new T.SpriteMaterial({map:texture,depthTest:false,depthWrite:false}));
    const size = (record.midpoint ? 0.075 : 0.055) / record.baseScale;
    sprite.scale.set(2*size,size,1); sprite.position.copy(record.mesh.position); sprite.position.y += size;
    sprite.renderOrder = 1100; sprite.userData.fkcConstruction = record;
    sprite.raycast = function(raycaster,hits){
      if(!raycaster.camera || F.Draw.mode === "paint" || !record.mesh?.visible ||
          (!record.midpoint && (F.AtomPlane.active || (F.Measure?.enabled && !F.Measure.wantsPlane?.(record.root)))))return;
      T.Sprite.prototype.raycast.call(this,raycaster,hits);
    };
    record.visual.object3D.add(sprite); record.label = sprite;
  }
  function disposeMesh(mesh) {
    mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose();
  }
  function remove(record) {
    for (const mesh of [...record.marks, record.mesh].filter(Boolean)) disposeMesh(mesh);
    if(record.label){record.label.removeFromParent();record.label.material.map.dispose();record.label.material.dispose();}
    record.marks=[]; record.mesh=null;
    if(selections.get(record.root)===record)selections.delete(record.root);
    F.invalidateHits?.();
  }
  F.AtomPlane = {
    normal, active:null,
    fitPlane(record, foot) {
      const required = 2.2 * foot.distanceTo(record.mesh.position) / record.size;
      if(required > (record.fitSize || 1)) this.style(record,{fitSize:required});
    },
    get(root) { return this.active?.root===root && !this.active.midpoint ? this.active : records.get(visualOf(root)); },
    midpointCount(root) { return midpoints.get(visualOf(root))?.length || 0; },
    nextPlane(root) {
      const entries=planes.get(visualOf(root));
      if(!entries?.length)return;
      this.select(entries[(entries.indexOf(this.get(root))+1)%entries.length]);
    },
    select(record) {
      const previous=selections.get(record.root);
      previous?.label.material.color?.set(0xffffff);
      selections.set(record.root,record);
      record.label.material.color?.set(0xffdf73);
      if(!record.midpoint)records.set(record.visual,record);
      F.setStatus(`${record.name} · ${record.midpoint ? "Mittelpunkt" : "Ebene"}`);
    },
    clearMidpoints(root) {
      const visual=visualOf(root);
      for(const record of midpoints.get(visual) || []) remove(record);
      midpoints.delete(visual);
    },
    cancel() {
      const record=this.active; if(!record)return;
      remove(record);
      this.active=null;
    },
    begin(root, {accept=()=>true, complete=null, midpoint=false}={}) {
      const visual=visualOf(root);
      if(!visual || root.fkcPendingVisual)return;
      if(this.active?.visual===visual && this.active.midpoint===midpoint){this.cancel();return;}
      this.cancel();
      F.Measure?.setEnabled(false);
      F.Draw.setMode("laser");
      visual.setAttribute("fkc-atom-plane", "");
      const record={visual,root,accept,complete,midpoint,points:[],marks:[],mesh:null,color:F.Draw.color,
        thickness:2*F.Settings.strokeRadius,opacity:F.Draw.opacity,visible:true};
      this.active=record;
      F.setStatus(midpoint ? "Mittelpunkt: Zwei verschiedene Punkte auswählen (0/2)." : "Ebene: Drei verschiedene Punkte auswählen (0/3).");
    },
    clear(root) {
      const record=this.get(root);if(!record)return;
      if(this.active===record){this.cancel();return;}
      const remaining=(planes.get(record.visual)||[]).filter(other=>other!==record);
      remove(record); planes.set(record.visual,remaining);records.set(record.visual,remaining.at(-1));
    },
    click(hit) {
      const r=this.active;
      if(F.Draw.mode!=="laser")return false;
      const geometry=hit.mesh?.userData.fkcConstruction;
      if(!r){
        if(!geometry || F.Measure?.enabled)return false;
        F.selectModel?.(hit.el);
        this.select(geometry);
        return true;
      }
      if(!r.visual.isConnected || visualOf(r.root)!==r.visual){this.cancel();return false;}
      const atom=hit.mesh?.userData.fkcAtom || (geometry?.midpoint ? geometry : null);
      if(hit.el!==r.root){this.cancel();return false;}
      if(!atom || !r.accept(atom))return true;
      if(hit.mesh.userData.fkcEnvironmentId && !F.CIF.environmentState(r.root)?.selected.has(hit.mesh.userData.fkcEnvironmentId))return true;
      const source=geometry?.mesh || hit.mesh;
      if(r.points.some(p=>p.mesh===source))return true;
      const center=r.visual.object3D.worldToLocal(source.getWorldPosition(new T.Vector3()));
      if(r.points.some(p=>p.center.distanceTo(center)<1e-8))return true;
      const pts=[...r.points.map(p=>p.center.toArray()),center.toArray()];
      const n=pts.length===3 ? normal(...pts) : null;
      if(pts.length===3 && !n){F.setStatus("Die drei Punkte liegen auf einer Geraden. Wähle einen anderen dritten Punkt.");return true;}
      r.points.push({mesh:source,center,positionAngstrom:atom.positionAngstrom});
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
        r.mesh=add(new T.SphereGeometry(1,16,12),new T.MeshBasicMaterial({color:0x18d8de,depthTest:false,depthWrite:false}));
        r.mesh.scale.multiplyScalar(0.008/scale);
        r.mesh.position.copy(r.points[0].center).add(center).multiplyScalar(0.5);
        r.mesh.renderOrder=1080;
        r.marks.forEach(disposeMesh);r.marks=[];
        r.baseScale=scale;
        const [a,b]=r.points.map(p=>p.positionAngstrom);
        if(a && b)r.positionAngstrom=a.map((n,i)=>(n+b[i])/2);
        label(r,"X");this.makeSelectable(r);save(midpoints,r);
        this.active=null;F.setStatus(`${r.name} · Mittelpunkt erzeugt.`);return true;
      }
      if(!n){F.setStatus(`Ebene: ${pts.length}/3 Punkte ausgewählt.`);return true;}
      const points=r.points.map(p=>p.center);
      const size=Math.max(points[0].distanceTo(points[1]),points[1].distanceTo(points[2]),points[2].distanceTo(points[0]))*1.5;
      r.size=size;
      r.mesh=add(new T.BoxGeometry(size,size,1),new T.MeshBasicMaterial({transparent:true,depthWrite:false}));
      r.mesh.position.copy(points[0]).add(points[1]).add(points[2]).multiplyScalar(1/3);
      r.mesh.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(...n));
      r.normalLocal=n;
      r.baseScale=scale;
      r.marks.forEach(disposeMesh);r.marks=[];
      const coordinates=r.points.map(point=>point.positionAngstrom);
      if(coordinates.every(Boolean)){
        r.positionAngstrom=coordinates[0];r.normalAngstrom=normal(...coordinates);
      }
      label(r,"E");this.makeSelectable(r);save(planes,r);records.set(r.visual,r);
      this.active=null;this.style(r,{});F.setStatus(`${r.name} · Ebene erzeugt.`);r.complete?.(r);
      return true;
    },
    makeSelectable(record) {
      const mesh=record.mesh;
      delete mesh.userData.fkcDrawing;
      mesh.userData.fkcConstruction=record;
      if(record.midpoint)mesh.raycast=function(raycaster,hits){
        if(F.Draw.mode!=="paint")T.Mesh.prototype.raycast.call(this,raycaster,hits);
      };
      F.invalidateHits?.();
    },
    style(r, change) {
      if(!r?.mesh)return;
      Object.assign(r,change);r.mesh.material.color.set(r.color);r.mesh.material.opacity=r.opacity;
      r.mesh.scale.x=r.mesh.scale.y=Math.max(r.displaySize || 1,r.fitSize || 1);
      r.mesh.scale.z=r.thickness/r.baseScale;r.mesh.visible=r.visible;
      if(r.label)r.label.visible=r.visible;
    }
  };
  AFRAME.registerComponent("fkc-atom-plane", {
    tick() {
      const tool=F.AtomPlane;
      const missing=record=>record.points.some(p=>!this.el.object3D.getObjectById(p.mesh.id));
      if(tool.active?.visual===this.el && missing(tool.active)) tool.cancel();
      for(const list of [planes,midpoints]){
        const saved=list.get(this.el);if(!saved)continue;
        const remaining=saved.filter(record=>{if(!missing(record))return true;remove(record);return false;});
        if(remaining.length!==saved.length)list.set(this.el,remaining);
      }
      if(!records.get(this.el)?.mesh)records.set(this.el,planes.get(this.el)?.at(-1));
    },
    remove() {
      if(F.AtomPlane.active?.visual===this.el)F.AtomPlane.cancel();
      for(const record of midpoints.get(this.el) || [])remove(record);
      midpoints.delete(this.el);
      for(const record of planes.get(this.el) || [])remove(record);
      planes.delete(this.el);records.delete(this.el);
    }
  });
})(window.FKCVR);