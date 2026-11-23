"use strict";

// Idealisiertes, trigonal-planares BF₃; Modellkoordinaten in B–F-Abständen (nicht Å).
(function (F) {
  const atoms = [[0, 0, 0], ...[0, 1, 2].map(i => {
    const angle = Math.PI / 10 + i * 2 * Math.PI / 3;
    return [Math.cos(angle), 0, -Math.sin(angle)];
  })];
  const colors = ["#176da0", "#b05d14"];
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
  function station(board, canvas, texture, exit) {
    const T = AFRAME.THREE, ctx = canvas.getContext("2d"), keep = [];
    const group = new T.Group(); board.object3D.add(group);
    group.position.set(1.40, 0, 0); group.scale.setScalar(0.44);
    const material = options => { const m = new T.MeshBasicMaterial(options); keep.push(m); return m; };
    const mesh = (geometry, mat) => { keep.push(geometry); const m = new T.Mesh(geometry, mat);
      m.raycast = function () {}; group.add(m); return m; };
    const atomColor = i => i ? 0x42a881 : 0xa46b58;
    const ghosts = [], plates = [];
    atoms.forEach((p, i) => {
      const radius = i ? 0.16 : 0.20;
      mesh(new T.SphereGeometry(radius, 24, 16), material({color: atomColor(i)})).position.fromArray(p);
      if (i) {
        const bond = mesh(new T.CylinderGeometry(0.047, 0.047, 1, 12), material({color: 0x728382}));
        bond.position.fromArray(p).multiplyScalar(0.5);
        bond.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(...p));
      }
      const ghost = mesh(new T.SphereGeometry(radius * 1.18, 12, 8), material({color: 0xbd2375, wireframe: true}));
      ghost.visible = false; ghosts.push(ghost);
    });
    for (const color of colors) {
      const plate = mesh(new T.PlaneGeometry(2.9, 2.9), material({color, transparent: true, opacity: 0.28,
        side: T.DoubleSide, depthWrite: false})); plate.visible = false; plates.push(plate);
    }
    const ring = mesh(new T.TorusGeometry(0.21, 0.019, 8, 28), material({color: 0xe9a725}));
    ring.position.fromArray(atoms[1]);
    let view = 0, lines = [null, null], passed = [false, false], history = [], hint = false, drag = null;
    let message = "Links: Zieh mit gehaltenem Trigger vom goldenen F durch B.", preview = null, elapsed = 0;
    const buttons = [{x: 20, w: 216, label: "Spiegelung testen", action: test},
      {x: 248, w: 202, label: "Lösung zeigen", action: () => { hint = true; redraw(); }},
      {x: 462, w: 168, label: "Rückgängig", action: undo},
      {x: 642, w: 174, label: "Weiter", action: next}, {x: 828, w: 176, label: "Beenden", action: exit}];
    const pixel = (v, p) => [centers[v] + p[0] * unit, cy - p[1] * unit];
    function stroke(v, line, color, dashed) {
      const [a, b] = line.map(p => pixel(v, p)); ctx.strokeStyle = color; ctx.lineWidth = 6;
      ctx.setLineDash(dashed ? [10, 8] : []); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); ctx.setLineDash([]);
    }
    function redraw() {
      ctx.fillStyle = "#f6faf8"; ctx.fillRect(0, 0, 1024, 640);
      ctx.fillStyle = "#203f30"; ctx.font = "bold 43px Arial"; ctx.fillText("Teil 3 · Zeichne den Spiegel", 24, 58);
      ctx.font = "27px Arial"; ctx.fillText("Idealisiertes BF₃ · B: Bor, F: Fluor · Der Laser ist auf der Zeichenfläche dein Stift.", 24, 99, 972);
      for (let v = 0; v < 2; v++) {
        ctx.fillStyle = "#fff"; ctx.fillRect(20 + v * 496, 124, 488, 314);
        ctx.strokeStyle = v === view ? colors[v] : "#c2cdca"; ctx.lineWidth = 4; ctx.strokeRect(20 + v * 496, 124, 488, 314);
        ctx.fillStyle = "#193947"; ctx.font = "bold 25px Arial"; ctx.fillText(v ? "2 · Von der Seite" : "1 · Von oben", 36 + v * 496, 158);
        const points = atoms.map(p => project(v, p));
        points.slice(1).forEach(p => stroke(v, [points[0], p], "#81908d", false));
        points.forEach((p, i) => {
          const [x, y] = pixel(v, p); ctx.fillStyle = i ? "#258365" : "#975841";
          ctx.beginPath(); ctx.arc(x, y, 15, 0, 2 * Math.PI); ctx.fill();
          ctx.fillStyle = "white"; ctx.font = "bold 19px Arial"; ctx.fillText(i ? "F" : "B", x - 6, y + 6);
          if (!v && i === 1) { ctx.strokeStyle = "#d89210"; ctx.beginPath(); ctx.arc(x, y, 21, 0, 2 * Math.PI); ctx.stroke(); }
        });
        if (view === v && !discovered && !passed[v]) {
          const guides = v === 0 ? [points[1], points[0]] : [points.reduce((a, b) => a[0] < b[0] ? a : b), points.reduce((a, b) => a[0] > b[0] ? a : b)];
          for (const p of guides) { const [x, y] = pixel(v, p); ctx.strokeStyle = "#d89210";
            ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 21, 0, 2 * Math.PI); ctx.stroke(); }
        }
        if (view === v && hint) stroke(v, solution(v), "#d3a12a", true);
        if (lines[v]) stroke(v, lines[v], colors[v], false);
      }
      ctx.fillStyle = "#193947"; ctx.font = "29px Arial"; ctx.fillText(message, 24, 495, 975);
      buttons.forEach(b => { ctx.fillStyle = "#c7e2d5"; ctx.fillRect(b.x, 544, b.w, 68);
        ctx.fillStyle = "#163c2c"; ctx.font = "bold 25px Arial"; ctx.fillText(b.label, b.x + 10, 588, b.w - 20); });
      texture.needsUpdate = true;
      plates.forEach((plate, v) => { const m = lines[v] && plane(v, ...lines[v]); plate.visible = !!m;
        if (m) { const n = new T.Vector3(...m.normal); plate.position.copy(n).multiplyScalar(m.offset);
          plate.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), n); } });
    }
    function stopPreview() { preview = null; ghosts.forEach(g => { g.visible = false; }); }
    function test() {
      const m = lines[view] && plane(view, ...lines[view]);
      if (!m) { message = "Zeichne zuerst einen längeren Strich. Lösung zeigen hilft dir."; redraw(); return; }
      const correct = check(view, lines[view], discovered);
      if (correct) { lines[view] = correct; passed[view] = true; hint = false; }
      preview = plane(view, ...lines[view]); elapsed = 0;
      message = !correct ? "Fast: Prüfe die rosa Spiegelbilder. Lösung zeigen hilft." : view ?
        "Richtig: Alle vier Atome bleiben auf ihrem Platz. Weiter zum freien Üben." :
        "Richtig: Zwei F tauschen die Plätze. Weiter zur Seitenansicht.";
      redraw();
    }
    let discovered = false;
    function next() {
      if (!passed[view]) { message = "Teste erst deinen Spiegel. Die gestrichelte Lösung kannst du nachziehen."; hint = true; }
      else { discovered ||= passed.every(Boolean); view = 1 - view; hint = false;
        message = discovered ? "Frei üben: Finde links weitere Spiegelebenen durch B und ein F." : "Rechts: Zieh eine Linie durch alle Atomzentren und teste sie."; }
      stopPreview(); redraw();
    }
    function undo() {
      const old = history.pop(); if (!old) return;
      ({lines, passed, view, discovered} = old); hint = !discovered; stopPreview();
      message = "Letzten Strich und seine Wirkung zurückgenommen."; redraw();
    }
    const coords = uv => [uv.x * 1024, (1 - uv.y) * 640];
    function point(uv) {
      if (!uv) return null;
      const [x, y] = coords(uv);
      return Math.abs(x - centers[view]) <= 240 && y >= 165 && y <= 431 ? [(x - centers[view]) / unit, (cy - y) / unit] : null;
    }
    function click(uv) {
      if (!uv) return;
      const [x, y] = coords(uv); drag = null;
      if (y >= 544 && y <= 612) { buttons.find(b => x >= b.x && x <= b.x + b.w)?.action(); return; }
      const p = point(uv); if (!p) return;
      history.push({lines: lines.slice(), passed: passed.slice(), view, discovered}); if (history.length > 32) history.shift();
      stopPreview(); drag = p; lines[view] = [p, p]; passed[view] = false;
      message = "Trigger halten und ziehen. Danach: Spiegelung testen."; redraw();
    }
    function tick(uv, held, dt) {
      if (!held || !uv) drag = null;
      const p = drag && point(uv);
      if (p && Math.hypot(p[0] - lines[view][1][0], p[1] - lines[view][1][1]) > 0.013) {
        lines[view] = [drag, p]; redraw();
      }
      if (preview) {
        elapsed = Math.min(1, elapsed + dt);
        ghosts.forEach((ghost, i) => { const end = reflect(atoms[i], preview);
          ghost.visible = true; ghost.position.fromArray(atoms[i].map((n, k) => n + elapsed * (end[k] - n))); });
      }
    }
    redraw();
    return {click, tick, dispose() { group.removeFromParent(); keep.forEach(r => r.dispose()); }};
  }
  F.MirrorTutorial = {station, atoms, project, plane, reflect, solution, check};
})(window.FKCVR);