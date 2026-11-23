"use strict";

// Idealisiertes, trigonal-planares BF₃; Modellkoordinaten in B–F-Abständen (nicht Å).
(function (F) {
  const atoms = [[0, 0, 0], ...[0, 1, 2].map(i => {
    const angle = Math.PI / 10 + i * 2 * Math.PI / 3;
    return [Math.cos(angle), 0, -Math.sin(angle)];
  })];
  const centers = [264, 760], cy = 278, unit = 116;
  const project = (view, p) => [p[0], view === 0 ? -p[2] : p[1]];
  const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
  function plane(view, start, end) {
    const x = end[0] - start[0], y = end[1] - start[1], length = Math.hypot(x, y);
    if (length < 0.30) return null;
    const nx = -y / length, ny = x / length;
    return {normal: view === 0 ? [nx, 0, -ny] : [nx, ny, 0], offset: nx * start[0] + ny * start[1]};
  }
  function reflect(p, mirror) {
    const distance = dot(p, mirror.normal) - mirror.offset;
    return p.map((value, i) => value - 2 * distance * mirror.normal[i]);
  }
  function solution(view, f = 1) {
    const u = view === 0 ? project(0, atoms[f]) : [1, 0];
    return [u.map(n => -1.25 * n), u.map(n => 1.25 * n)];
  }
  function check(view, line, free) {
    const mirror = line && plane(view, ...line);
    if (!mirror) return null;
    // Nicht nur die Zentren der F-Atome prüfen: B muss B, jedes F ein anderes
    // oder sich selbst treffen. Toleranz nur für die handgezeichnete Ebene.
    const hits = atoms.map((atom, i) => {
      const image = reflect(atom, mirror);
      return atoms.findIndex((target, j) => (i === 0) === (j === 0) &&
        Math.hypot(...target.map((n, k) => n - image[k])) < 0.32);
    });
    if (hits.includes(-1) || new Set(hits).size !== 4 || (view === 0 && !free && hits[1] !== 1)) return null;
    return solution(view, view === 0 ? hits.findIndex((j, i) => i > 0 && j === i) : 1);
  }
  const tasks = ["Zur BF₃-Zeichentafel gehen", "Erste Ebene mit dem Laser zeichnen", "Erste Spiegelebene testen", "BF₃ mit dem Laser auswählen", "Modell-Handmenü öffnen",
    "Pinsel im Modellmenü wählen", "Neue Farbe und zweite Spiegelebene",
    "Neue Farbe und dritte Spiegelebene", "Spiegelebenen ausblenden", "Zeichne einen Punkt auf das B des rechten Bildes", "Letzten Strich im Handmenü entfernen"];
  const hints = ["Geh zur zweigeteilten Tafel vor dir.", "Links: Trigger am markierten F halten, durch B ziehen und loslassen.", "Drücke auf der Zeichentafel ‚Erste Spiegelebene testen‘ und beobachte das Modell.", "Ziele auf das räumliche BF₃ neben der Tafel und drücke den Trigger.",
    "Dreh die Handfläche ohne Laser zum Kopf.", "Drücke oben rechts auf den gelb umrahmten Pinsel.",
    "Im Zeichenmenü neue Farbe wählen. Vom markierten F durch B ziehen.",
    "Im Zeichenmenü dritte Farbe wählen. Vom letzten F bis B ziehen.", "Wähle auf der Zeichentafel ‚Spiegelebenen ausblenden‘.", "Rechts: B kurz antippen. Vergleiche die rosa Bilder mit den grünen F.",
    "Handfläche drehen und Letzten Strich entfernen drücken."];
  function station(parent) {
    const T = AFRAME.THREE, resources = [], keep = r => (resources.push(r), r);
    const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 640;
    const ctx = canvas.getContext("2d"), texture = keep(new T.CanvasTexture(canvas));
    const board = F.create("a-entity", {class: "vr-action", position: "-1.4 1.45 -2.7"}, parent);
    board.dataset.fkcTutorial = "true";
    const face = new T.Mesh(keep(new T.PlaneGeometry(1.8, 1.125)), keep(new T.MeshBasicMaterial({map: texture})));
    board.setObject3D("mesh", face);
    const root = F.create("a-entity", {id: "tutorial-bf3-model", class: "interactable", position: "0.05 1.35 -2.5"}, parent);
    root.dataset.title = "BF₃ · Zeichenübung";
    const body = F.create("a-entity", {class: "manip-body"}, root);
    F.create("a-box", {class: "hitbox", width: 0.9, height: 0.28, depth: 0.9, visible: false}, body);
    root.setAttribute("fkc-manipulable", ""); root.modelReady = true;
    const visual = F.create("a-entity", {class: "model-visual"}, body);
    const group = new T.Group(); visual.setObject3D("mesh",group); group.scale.setScalar(0.40);
    const make = (geometry, options) => { const m = new T.Mesh(keep(geometry), keep(new T.MeshBasicMaterial(options)));
      group.add(m); return m; };
    const plates = [], ghosts = [];
    atoms.forEach((p, i) => {
      make(new T.SphereGeometry(i ? 0.16 : 0.20, 20, 12), {color: i ? 0x258365 : 0x975841}).position.fromArray(p);
      const ghost = make(new T.SphereGeometry(i ? 0.17 : 0.215, 12, 8), {color: 0xc93482, wireframe: true});
      ghost.position.fromArray(p).multiplyScalar(-1); ghost.visible = false; ghosts.push(ghost);
      if (!i) return;
      const bond = make(new T.CylinderGeometry(0.045, 0.045, 1, 12), {color: 0x81908d});
      bond.position.fromArray(p).multiplyScalar(0.5); bond.quaternion.setFromUnitVectors(new T.Vector3(0,1,0), new T.Vector3(...p));
      const ghostBond = make(new T.CylinderGeometry(0.048, 0.048, 1, 8), {color: 0xc93482, wireframe: true});
      ghostBond.position.fromArray(p).multiplyScalar(-0.5); ghostBond.quaternion.copy(bond.quaternion);
      ghostBond.visible = false; ghosts.push(ghostBond);
      const plate = make(new T.BoxGeometry(2.65, 2.2, 1), {transparent: true, depthWrite: false});
      plate.quaternion.setFromUnitVectors(new T.Vector3(0,0,1), new T.Vector3(...plane(0,...solution(0,i)).normal));
      plate.visible = false; plates.push(plate);
    });
    let step = 0, strokes = [], dotStroke, active, drawingMenu = false, message = "", waitRelease = false;
    const images = atoms.map((p,i) => {
      const image = make(new T.SphereGeometry(i ? 0.185 : 0.225, 16, 10), {wireframe:true});
      image.visible=false; image.raycast=function(){}; return image;
    });
    let preview=null, hidden=false, buttons=[];
    function stopTest(){ preview=null; images.forEach(image=>image.visible=false); }
    function testMirror(index){
      stopTest(); hidden=false;
      plates.forEach((plate,i)=>{plate.visible=i===index;});
      const mirror=plane(0,...solution(0,index+1));
      preview={index,time:0,end:atoms.map(p=>reflect(p,mirror)),finished:false};
      images.forEach((image,i)=>{image.position.fromArray(atoms[i]);image.material.color.set(strokes[index].color);image.visible=true;});
      message="Die farbigen Umrisse zeigen die Abbildung – keine Bewegung der Atomkerne.";draw();
    }
    function animate(seconds){
      if(!preview || !seconds)return;
      preview.time+=seconds;
      const t=Math.min(1,preview.time/1.8), f=t*t*(3-2*t);
      images.forEach((image,i)=>image.position.fromArray(atoms[i].map((n,k)=>n+f*(preview.end[i][k]-n))));
      if(t===1 && !preview.finished){
        preview.finished=true;
        if(step===2 && preview.index===0)move(drawingMenu?6:3);
        message="Deckungsgleich: B und ein F bleiben fest, die anderen beiden F tauschen ihre Plätze.";draw();
      }
      if(preview.time>=3.3){stopTest();plates.forEach((p,i)=>{p.visible=!hidden && i<strokes.length;});}
    }
    const pixel = (v,p) => [centers[v] + p[0] * unit, cy - p[1] * unit];
    // Schräg statt exakt entlang B–F1: alle Zentren bleiben getrennt.
    const side = p => [-p[0]*atoms[1][2] + p[2]*atoms[1][0], 0.42 * dot(p,atoms[1])];
    function draw() {
      // Echte Striche liegen als Mesh vor dem Canvas: beim Wechsel ebenfalls abblenden.
      for (const stroke of strokes) for (const part of stroke.parts) {
        part.material.transparent = step >= 9 || part.opacity < 1;
        part.material.opacity = part.opacity * (step >= 9 ? 0.38 : 1);
      }
      ctx.fillStyle = "#f6faf8"; ctx.fillRect(0,0,1024,640);
      ctx.font = "bold 36px Arial"; ctx.fillStyle = "#203f30"; ctx.fillText("BF₃ · Symmetrie mit dem Stift untersuchen",24,58);
      const target = [1,6,7].includes(step) ? strokes.length + 1 : -1;
      for (const v of [0,1]) {
        const x = v ? 520 : 16; ctx.fillStyle = "white"; ctx.fillRect(x,90,486,364);
        ctx.fillStyle = "#193947"; ctx.font = "bold 24px Arial";
        ctx.fillText(v ? "Liegt auf B ein Inversionszentrum?" : "Zeichne die drei senkrechten Spiegelebenen ein",x+12,132,460);
        const points = atoms.map(p => pixel(v, v ? side(p) : project(0,p)));
        points.slice(1).forEach(p => { ctx.strokeStyle = "#81908d"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(...points[0]); ctx.lineTo(...p); ctx.stroke(); });
        for (const i of [1,2,3,0]) { const [a,b] = points[i]; ctx.fillStyle = i ? "#258365" : "#975841";
          ctx.beginPath(); ctx.arc(a,b,16,0,2*Math.PI); ctx.fill(); ctx.fillStyle = "white"; ctx.font="bold 20px Arial";ctx.fillText(i?"F":"B",a-7,b+7);
          if ((!v && i === target) || (v && !i && step === 9)) {ctx.strokeStyle="#d69500";ctx.beginPath();ctx.arc(a,b,22,0,2*Math.PI);ctx.stroke();}
        }
        if (v === 1 && step < 9 || v === 0 && step >= 9) {
          ctx.fillStyle="rgba(245,248,246,0.64)";ctx.fillRect(x,90,486,364);
        }
      }
      const notes = step >= 10 ? ["Punktspiegelung an B: Das zentrale Boratom bleibt an seinem Platz.",
        "Gegenüber jedem F liegt eine Lücke. Das rosa Drahtmodell deckt sich nicht mit BF₃.",
        "BF₃ hat deshalb kein Inversionszentrum – trotz seiner Spiegelebenen."] : step === 9 ? [
        "Markiere B als mögliches Inversionszentrum in der rechten Schrägansicht.",
        "Zu jedem F müsste es auf der Gegenseite im gleichen Abstand ein F geben.",
        "Vergleiche das invertierte Drahtmodell mit den ursprünglichen Atomplätzen."] : [
        "BF₃ ist trigonal-planar: Die drei F–B–F-Winkel betragen jeweils 120°.",
        strokes.length ? `${strokes.length} von 3 senkrechten Ebenen: B und ein F bleiben fest, die anderen F tauschen Plätze.` :
          "In der Draufsicht erscheint jede senkrechte Spiegelebene als Gerade durch F und B.",
        "Die Molekülebene selbst ist eine weitere Spiegelebene; sie ist hier nicht gesucht."];
      ctx.font="27px Arial";ctx.fillStyle="#193947";
      notes.forEach((note,i)=>ctx.fillText(i===0 && message ? message : note,22,483+i*31,980));
      buttons=strokes.map((_,i)=>({label:["Erste Spiegelebene testen","Zweite Ebene testen","Dritte Ebene testen"][i],cue:step===2 && i===0,action:()=>testMirror(i)}));
      if(strokes.length===3)buttons.push({label:hidden?"Spiegelebenen einblenden":"Spiegelebenen ausblenden",cue:step===8,action:()=>{
        stopTest();hidden=!hidden;plates.forEach(p=>{p.visible=!hidden;}); if(hidden && step===8)move(9);else draw();
      }});
      buttons.forEach((b,i)=>{const w=992/buttons.length;b.x=16+i*w;b.w=w-8;
        ctx.fillStyle=b.cue?"#ffdf73":"#c7e2d5";ctx.fillRect(b.x,560,b.w,68);
        ctx.font="bold 26px Arial";ctx.fillStyle="#193947";ctx.fillText(b.label,b.x+9,602,b.w-18);
      });
      texture.needsUpdate=true;
    }
    const move = n => { step=n; message=""; draw(); };
    function sample(hit) {
      if (hit?.el !== board || !hit.uv || ![1,6,7,9].includes(step)) return;
      const v = step === 9 ? 1 : 0;
      const p = [(hit.uv.x*1024-centers[v])/unit, (cy-(1-hit.uv.y)*640)/unit];
      if (Math.abs(p[0])>1.75 || Math.abs(p[1])>1.27) return;
      const used = strokes.some(s=>s.color===F.Draw.color);
      if (!active && !v && used) { message="Jede Farbe kennzeichnet eine andere Spiegelebene."; draw(); return; }
      const start = v ? [0,0] : project(0, atoms[strokes.length+1]);
      if (!active && Math.hypot(p[0]-start[0],p[1]-start[1])>0.32) return;
      if (!active) {stopTest(); plates.forEach((plate,i)=>{plate.visible=!hidden && i<strokes.length;});active={start:p, parts:[]};}
      const last = active.parts.at(-1);
      const part = F.Draw.sampleSurface(last, {...hit,type:"surface"});
      if (part && part!==last) active.parts.push(part);
      if (!part) return;
      if (v) { dotStroke=part; active=null; waitRelease=true; ghosts.forEach(g=>g.visible=true); move(10); return; }
      const candidate = plane(0, active.start, p), plate = plates[strokes.length];
      if(active.accepted)return; // Weiterzeichnen, ohne die bestätigte Ebene erneut zu kippen.
      if(candidate){const n=new T.Vector3(...candidate.normal);plate.position.copy(n).multiplyScalar(candidate.offset);
        plate.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),n);plate.visible=true;plate.material.color.set(part.color);
        plate.scale.z=2*part.worldRadius/0.40;plate.material.opacity=part.opacity;}
      if (Math.hypot(...p)>0.27) return;
      const m = plane(0,active.start,p), f = atoms[strokes.length+1];
      if (!m || Math.abs(dot(f,m.normal))>0.25) return;
      active.accepted=true;
      plate.position.set(0,0,0);plate.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(...plane(0,...solution(0,strokes.length+1)).normal));
      message="Die Gerade durch F und B ist die Spur der Spiegelebene in der Draufsicht.";draw();
    }
    draw();
    return {board, root, get step(){return step;}, get drawingMenu(){return drawingMenu;}, unused(c){return !strokes.some(s=>s.color===c);},
      click(uv){if(!uv || active)return;const x=uv.x*1024,y=(1-uv.y)*640;
        if(y>=560 && y<=628){const b=buttons.find(b=>x>=b.x && x<=b.x+b.w);if(b){waitRelease=true;b.action();}}},
      cue(){return step===5?"mirror:menu":[6,7].includes(step) && strokes.some(s=>s.color===F.Draw.color)?"mirror:color":step===10?"mirror:undo":null;},
      menu(){if(step!==5)return;drawingMenu=true;F.Draw.setMode("paint");move(6);},
      color(c){F.Draw.color=c;message="";draw();},
      undo(){
        stopTest(); hidden=false;plates.forEach((p,i)=>{p.visible=i<strokes.length;});
        if(dotStroke){F.Draw.remove(dotStroke);dotStroke=null;ghosts.forEach(g=>g.visible=false);move(11);return;}
        const last=strokes.pop();if(!last)return;
        last.parts.forEach(s=>F.Draw.remove(s));plates[strokes.length].visible=false;
        move(strokes.length ? 5+strokes.length : 1);
      },
      clear(){
        stopTest();hidden=false;F.Draw.clear(board); active=null; dotStroke=null; strokes=[]; waitRelease=true;
        plates.forEach(p=>p.visible=false); ghosts.forEach(g=>g.visible=false); move(1);
      },
      tick(hit,held,near,opened,selected,seconds=0){animate(seconds);if(step===0 && near)move(1); if(step===3 && selected)move(4); if(step===4 && opened && selected)move(5);
        if(!held)waitRelease=false;
        if(held && !waitRelease) sample(hit);
        if(active && (!held || hit?.el!==board)){
          if(active.accepted){strokes.push({parts:active.parts,color:active.parts[0].color});active=null;waitRelease=held;
            move(strokes.length===1 ? 2 : 5+strokes.length);}
          else {active.parts.forEach(s=>F.Draw.remove(s));plates[strokes.length].visible=false;active=null;message="Noch einmal: vom markierten F durch B ziehen.";draw();}}},
      dispose(){ F.releaseModel(root); F.Draw.clear(board);board.remove();root.remove();resources.forEach(r=>r.dispose()); }
    };
  }
  F.MirrorTutorial = {station, atoms, project, plane, reflect, solution, check, tasks, hints};
})(window.FKCVR);