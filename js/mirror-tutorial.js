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
  const tasks = ["Zur BF₃-Zeichentafel gehen", "BF₃ mit dem Laser auswählen", "Modell-Handmenü öffnen",
    "Pinsel im Modellmenü wählen", "Erste Spiegelebene zeichnen", "Neue Farbe und zweite Spiegelebene",
    "Neue Farbe und dritte Spiegelebene", "Rechts einen Punkt auf B setzen", "Letzten Strich im Handmenü entfernen"];
  const hints = ["Geh zur zweigeteilten Tafel vor dir.", "Ziele auf das räumliche BF₃ neben der Tafel und drücke den Trigger.",
    "Dreh die Handfläche ohne Laser zum Kopf.", "Drücke oben rechts auf den gelb umrahmten Pinsel.",
    "Links: vom goldenen F bis zum B zeichnen.", "Im Zeichenmenü neue Farbe wählen. Vom markierten F bis B ziehen.",
    "Im Zeichenmenü dritte Farbe wählen. Vom letzten F bis B ziehen.", "Rechts: B kurz antippen. Vergleiche die rosa Bilder mit den grünen F.",
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
      if (!i) return;
      const bond = make(new T.CylinderGeometry(0.045, 0.045, 1, 12), {color: 0x81908d});
      bond.position.fromArray(p).multiplyScalar(0.5); bond.quaternion.setFromUnitVectors(new T.Vector3(0,1,0), new T.Vector3(...p));
      const ghost = make(new T.SphereGeometry(0.17, 12, 8), {color: 0xc93482, wireframe: true});
      ghost.position.fromArray(p).multiplyScalar(-1); ghost.visible = false; ghosts.push(ghost);
      const plate = make(new T.PlaneGeometry(2.65, 2.2), {transparent: true, opacity: 0.33, side: T.DoubleSide, depthWrite: false});
      plate.quaternion.setFromUnitVectors(new T.Vector3(0,0,1), new T.Vector3(...plane(0,...solution(0,i)).normal));
      plate.visible = false; plates.push(plate);
    });
    let step = 0, strokes = [], dotStroke, active, drawingMenu = false, message = "", waitRelease = false;
    const pixel = (v,p) => [centers[v] + p[0] * unit, cy - p[1] * unit];
    // Seitliche Projektion entlang B–F1: F1 liegt auf B, F2/F3 erscheinen paarweise.
    const side = p => [-p[0]*atoms[1][2] + p[2]*atoms[1][0], p[1]];
    function draw() {
      ctx.fillStyle = "#f6faf8"; ctx.fillRect(0,0,1024,640);
      ctx.font = "bold 36px Arial"; ctx.fillStyle = "#203f30"; ctx.fillText("BF₃ · Symmetrie mit dem Stift untersuchen",24,58);
      const target = [4,5,6].includes(step) ? strokes.length + 1 : -1;
      for (const v of [0,1]) {
        const x = v ? 520 : 16; ctx.fillStyle = "white"; ctx.fillRect(x,90,486,364);
        ctx.fillStyle = "#193947"; ctx.font = "bold 24px Arial";
        ctx.fillText(v ? "Prüfe ein mögliches Inversionszentrum" : "Zeichne die drei Spiegelebenen ein",x+12,132,460);
        const points = atoms.map(p => pixel(v, v ? side(p) : project(0,p)));
        points.slice(1).forEach(p => { ctx.strokeStyle = "#81908d"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(...points[0]); ctx.lineTo(...p); ctx.stroke(); });
        for (const i of [1,2,3,0]) { const [a,b] = points[i]; ctx.fillStyle = i ? "#258365" : "#975841";
          ctx.beginPath(); ctx.arc(a,b,16,0,2*Math.PI); ctx.fill(); ctx.fillStyle = "white"; ctx.font="bold 20px Arial";ctx.fillText(i?"F":"B",a-7,b+7);
          if ((!v && i === target) || (v && !i && step === 7)) {ctx.strokeStyle="#d69500";ctx.beginPath();ctx.arc(a,b,22,0,2*Math.PI);ctx.stroke();}
        }
      }
      ctx.font="27px Arial";ctx.fillStyle="#193947";ctx.fillText(message || hints[step] || "Geschafft! Die drei farbigen Ebenen bleiben am Modell.",22,507,980);
      ctx.fillText(dotStroke ? "Inversion an B: Die rosa F-Abbilder treffen auf kein Fluoratom." : "Links: von oben · Rechts: entlang einer B–F-Bindung · Modell mit Grip bewegen",22,565,980);
      texture.needsUpdate=true;
    }
    const move = n => { step=n; message=""; draw(); };
    function sample(hit) {
      if (hit?.el !== board || !hit.uv || ![4,5,6,7].includes(step)) return;
      const v = step === 7 ? 1 : 0;
      const p = [(hit.uv.x*1024-centers[v])/unit, (cy-(1-hit.uv.y)*640)/unit];
      if (Math.abs(p[0])>1.75 || Math.abs(p[1])>1.27) return;
      const used = strokes.some(s=>s.color===F.Draw.color);
      if (!active && !v && used) { message="Wähle im Zeichenmenü eine noch nicht verwendete Farbe."; draw(); return; }
      const start = v ? [0,0] : project(0, atoms[strokes.length+1]);
      if (!active && Math.hypot(p[0]-start[0],p[1]-start[1])>0.32) return;
      if (!active) active={start:p, parts:[]};
      const last = active.parts.at(-1);
      const part = F.Draw.sample(last, {...hit,type:"surface"}, F.HandMenu.laserHand());
      if (part && part!==last) active.parts.push(part);
      if (!part) return;
      if (v) { dotStroke=part; active=null; waitRelease=true; ghosts.forEach(g=>g.visible=true); move(8); return; }
      const candidate = plane(0, active.start, p), plate = plates[strokes.length];
      if(candidate){const n=new T.Vector3(...candidate.normal);plate.position.copy(n).multiplyScalar(candidate.offset);
        plate.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),n);plate.visible=true;plate.material.color.set(part.color);}
      if (Math.hypot(...p)>0.27) return;
      const m = plane(0,active.start,p), f = atoms[strokes.length+1];
      if (!m || Math.abs(dot(f,m.normal))>0.25) return;
      strokes.push({parts:active.parts,color:F.Draw.color});active=null;waitRelease=true;
      plate.position.set(0,0,0);plate.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(...plane(0,...solution(0,strokes.length)).normal));
      move(4+strokes.length);
    }
    draw();
    return {board, root, get step(){return step;}, get drawingMenu(){return drawingMenu;}, unused(c){return !strokes.some(s=>s.color===c);},
      cue(){return step===3?"mirror:menu":[5,6].includes(step) && strokes.some(s=>s.color===F.Draw.color)?"mirror:color":step===8?"mirror:undo":null;},
      menu(){if(step<3)return;drawingMenu=true;F.Draw.setMode("paint");if(step===3)move(4);},
      color(c){F.Draw.color=c;message="";draw();},
      undo(){
        if(dotStroke){F.Draw.remove(dotStroke);dotStroke=null;ghosts.forEach(g=>g.visible=false);move(9);return;}
        const last=strokes.pop();if(!last)return;
        last.parts.forEach(s=>F.Draw.remove(s));plates[strokes.length].visible=false;
        move(4+strokes.length);
      },
      tick(hit,held,near,opened,selected){if(step===0 && near)move(1); if(step===1 && selected)move(2); if(step===2 && opened && selected)move(3);
        if(!held)waitRelease=false;
        if(held && !opened && !waitRelease) sample(hit);
        if(active && (!held || opened || hit?.el!==board)){active.parts.forEach(s=>F.Draw.remove(s));plates[strokes.length].visible=false;active=null;message="Noch einmal: vom markierten F bis zum B ziehen.";draw();}},
      dispose(){ F.releaseModel(root); F.Draw.clear(board);board.remove();root.remove();resources.forEach(r=>r.dispose()); }
    };
  }
  F.MirrorTutorial = {station, atoms, project, plane, reflect, solution, check, tasks, hints};
})(window.FKCVR);