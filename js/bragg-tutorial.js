"use strict";

// Zwei kohärente Beiträge in symmetrischer Streugeometrie, keine Intensitätssimulation.
(function (F) {
  const tau = 2 * Math.PI, d = 2;
  const sources = Object.freeze({mo: 0.7107, cu: 1.5406}); // Kα-Lehrwerte in Å
  const defaultSource = "mo", minAngle = 10, maxAngle = 80;
  const angleFor = (periods, source = defaultSource) => 2 * Math.asin(periods * sources[source] / (2 * d)) * 180 / Math.PI;
  const bragg = angleFor(1);
  function geometry(twoTheta, source = defaultSource) {
    const wavelength = sources[source];
    const theta = twoTheta * Math.PI / 360, sin = Math.sin(theta), cos = Math.cos(theta);
    const extra = 2 * d * sin, periods = extra / wavelength;
    return {theta, sin, cos, extra, periods, wavelength,
      matched: Math.round(periods) > 0 && Math.abs(periods - Math.round(periods)) < 1e-7};
  }
  function initial() { return {angle: bragg, source: defaultSource, speed: 1, running: false, time: 0}; }
  function command(s, id) {
    switch (id) {
      case "reset": Object.assign(s, initial()); break;
      case "play": s.running = !s.running; break;
      case "slow": s.speed = 0.5; break;
      case "normal": s.speed = 1; break;
      case "fast": s.speed = 2; break;
      case "mo": case "cu": s.source = id; break; // Wirkung von λ bei gleichem Winkel zeigen.
      case "bragg": s.angle = angleFor(1, s.source); break;
      case "compare": s.angle = angleFor(1.5, s.source); break;
      case "minus": s.angle = Math.max(minAngle, s.angle - 1); break;
      case "plus": s.angle = Math.min(maxAngle, s.angle + 1); break;
    }
  }
  const tasks = ["Zur Bragg-Station gehen", "Animation mit dem Trigger auswählen", "Handmenü öffnen",
    "Animation starten", "Auf halbe Geschwindigkeit wechseln", "Vergleichswinkel einstellen", "Animation pausieren"];
  const hints = ["Strukturteil geschafft! Geh zur Bragg-Station vor dir.", "Ziele auf die Netzebenen oder den Infotext darunter und drücke den Trigger.",
    "Dreh die Handfläche ohne Laser zu dir.", "Drücke Start. Beobachte die Wellen bis zum Detektor.",
    "Wähle 0,5×. Die Wellenlänge bleibt gleich.", "Wähle Vergleich: Berg trifft jetzt Tal.", "Drücke Pause. Der Phasenvergleich bleibt stehen."];
  const cues = {3: "play", 4: "slow", 5: "compare", 6: "play"};
  function progress(step, near, selected, menu, s) {
    return [near, selected, menu, s.running && s.time >= 4, s.running && s.speed === 0.5,
      Math.abs(s.angle - angleFor(1.5, s.source)) < 1e-7, !s.running][step] ? step + 1 : step;
  }

  function station(parent) {
    const T = AFRAME.THREE, state = initial();
    const el = F.create("a-entity", {class: "vr-action", position: "-0.55 1.55 0.25"}, parent);
    el.dataset.fkcTutorial = "true";
    el.dataset.title = "Bragg-Reflexion";
    const rig = new T.Group(); el.object3D.add(rig);
    const resources = [];
    const keep = value => { resources.push(value); return value; };
    const basic = (color, opacity = 1) => keep(new T.MeshBasicMaterial({color, opacity, transparent: opacity < 1,
      depthWrite: opacity === 1, side: T.DoubleSide}));
    const box = (x, y, z, material, group) => {
      const mesh = new T.Mesh(keep(new T.BoxGeometry(x, y, z)), material);
      group.add(mesh); return mesh;
    };
    // Lokale Skala: 1 Å = 0,13 m im Lehrmodell. Einfall im Labor bleibt horizontal.
    const scale = 0.13, L = 6, depth = d * scale;
    const plane = basic(0x719caa, 0.28), point = basic(0x315360);
    const sphere = keep(new T.SphereGeometry(0.019, 10, 8));
    for (const y of [0, -depth]) {
      box(1.20, 0.008, 0.48, plane, rig).position.y = y;
      for (const x of [-0.45, 0, 0.45]) for (const z of [-0.18, 0, 0.18]) {
        const atom = new T.Mesh(sphere, point); atom.position.set(x, y, z); rig.add(atom);
      }
    }
    function line(count, color, group = rig) {
      const g = keep(new T.BufferGeometry());
      const attr = new T.Float32BufferAttribute(new Float32Array(count * 3), 3);
      g.setAttribute("position", attr);
      const obj = new T.Line(g, keep(new T.LineBasicMaterial({color}))); group.add(obj);
      obj.frustumCulled = false;
      return {obj, set(fn) { for (let i = 0; i < count; i++) attr.setXYZ(i, ...fn(i / (count - 1)));
        attr.needsUpdate = true; }};
    }
    const bracket = line(4, 0x243945);
    bracket.set(t => [[-0.52, 0, 0.23], [-0.55, 0, 0.23], [-0.55, -depth, 0.23], [-0.52, -depth, 0.23]][Math.round(t * 3)]);
    const arc = line(33, 0x675996, el.object3D), thetaArc = line(25, 0x28647b);
    const baseline = line(2, 0x777777, el.object3D); baseline.set(t => [t * 0.45, 0, 0.012]);
    const track = line(55, 0x536976, el.object3D);
    track.set(t => { const a = (minAngle + t * (maxAngle - minAngle)) * Math.PI / 180; return [scale * L * Math.cos(a), scale * L * Math.sin(a), 0]; });
    const detector = box(0.02, 0.40, 0.35, basic(0x8aa7bc, 0.55), rig);
    const spot = new T.Mesh(keep(new T.SphereGeometry(0.031, 14, 10)), basic(0x138041));
    detector.add(spot); spot.position.x = -0.018;
    // WebGL-Linienbreite ist auf vielen Geräten auf einen Pixel beschränkt.
    // Echte Geometrie macht die Wellen auch in der Pico sichtbar.
    const segmentCount = 128;
    const cylinder = keep(new T.CylinderGeometry(1, 1, 1, 8));
    const pose = new T.Object3D(), up = new T.Vector3(0, 1, 0);
    const start = new T.Vector3(), end = new T.Vector3(), direction = new T.Vector3();
    function thickWave(color, radius) {
      const obj = keep(new T.InstancedMesh(cylinder, basic(color), segmentCount));
      obj.instanceMatrix.setUsage(T.DynamicDrawUsage);
      obj.frustumCulled = false;
      obj.raycast = function () {};
      rig.add(obj);
      return {obj, set(point) {
        start.fromArray(point(0));
        for (let i = 0; i < segmentCount; i++) {
          end.fromArray(point((i + 1) / segmentCount));
          direction.subVectors(end, start);
          const length = direction.length();
          pose.position.copy(start).lerp(end, 0.5);
          pose.quaternion.setFromUnitVectors(up, direction.normalize());
          pose.scale.set(radius, length + radius * 0.4, radius);
          pose.updateMatrix();
          obj.setMatrixAt(i, pose.matrix);
          start.copy(end);
        }
        obj.instanceMatrix.needsUpdate = true;
      }};
    }
    const waves = [];
    for (const lower of [false, true]) for (const outgoing of [false, true]) {
      // Mittlere Teilstücke der unteren Bahn sind genau die beiden Zusatzwege.
      for (const extra of lower ? [false, true] : [false]) {
        waves.push({lower, outgoing, extra, wave: thickWave(lower ? 0x743a99 : 0x126b9b, extra ? 0.011 : 0.006)});
      }
    }
    const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 368;
    const texture = keep(new T.CanvasTexture(canvas));
    const panel = new T.Mesh(keep(new T.PlaneGeometry(1.75, 0.63)), keep(new T.MeshBasicMaterial({map: texture, side: T.DoubleSide})));
    panel.position.set(0, -0.77, 0.10); el.object3D.add(panel);
    const live = document.createElement("canvas"); live.width = 1024; live.height = 190;
    const liveTexture = keep(new T.CanvasTexture(live));
    const livePanel = new T.Mesh(keep(new T.PlaneGeometry(1.75, 0.325)), keep(new T.MeshBasicMaterial({map: liveTexture})));
    livePanel.position.set(0, 1.14, 0); livePanel.raycast = function () {}; el.object3D.add(livePanel);
    const liveCtx = live.getContext("2d");
    const format = (value, digits) => value.toFixed(digits).replace(".", ",");
    let equationKey = "";
    const ctx = canvas.getContext("2d"); let previous = "", lastFrame = "";
    function update() {
      const settings = `${state.source}:${state.angle}`;
      const frame = `${settings}:${state.time}`;
      if (frame === lastFrame) return;
      lastFrame = frame;
      const g = geometry(state.angle, state.source), half = g.extra / 2;
      if (equationKey !== settings) {
        equationKey = settings;
        liveCtx.fillStyle = "#f6fafb"; liveCtx.fillRect(0, 0, 1024, 190);
        liveCtx.fillStyle = "#193947"; liveCtx.font = "30px Arial";
        liveCtx.fillText(`${state.source === "mo" ? "Mo" : "Cu"} Kα  ·  2θ = ${format(state.angle, 1)}°`, 24, 42);
        liveCtx.fillStyle = g.matched ? "#137341" : "#a32929";
        liveCtx.font = "bold 40px Arial";
        const value = g.matched ? String(Math.round(g.periods)) : format(g.periods, 3);
        liveCtx.fillText(`2 × ${format(d, 2)} Å × sin(${format(state.angle / 2, 2)}°) / ${format(g.wavelength, 4)} Å ≈ ${value}`, 24, 105, 976);
        liveCtx.font = "bold 32px Arial";
        liveCtx.fillText(g.matched ? `n = ${value} · Bragg-Bedingung erfüllt` : "Kein ganzzahliges n · Bragg-Bedingung nicht erfüllt", 24, 161, 976);
        liveTexture.needsUpdate = true;
      }
      rig.rotation.z = g.theta;
      arc.set(t => [0.33 * Math.cos(2 * g.theta * t), 0.33 * Math.sin(2 * g.theta * t), 0.015]);
      thetaArc.set(t => [-0.25 * Math.cos(g.theta * t), 0.25 * Math.sin(g.theta * t), 0.015]);
      detector.position.set(scale * L * g.cos + depth * g.sin * g.cos / 2,
        scale * L * g.sin - depth * g.cos ** 2 / 2, 0);
      detector.rotation.z = g.theta;
      const front = state.time * 4; // Schematische Ausbreitung in Å pro Animationssekunde.
      for (const {lower, outgoing, extra, wave} of waves) {
        const h = lower ? half : 0;
        const [a, b] = outgoing ? (extra ? [0, h] : [h, L + h]) : (extra ? [-h, 0] : [-L - h, -h]);
        const last = Math.min(b, front - L - h);
        wave.obj.visible = last > a;
        if (!wave.obj.visible) continue;
        if (extra) wave.obj.material.color.setHex(g.matched ? 0x0aaf36 : 0xd9312b);
        wave.set(t => {
          const s = a + (last - a) * t;
          // Wellen quer zum Strahl in der sichtbaren Seitenansicht zeichnen.
          const sign = outgoing ? 1 : -1;
          const oscillation = 0.026 * Math.sin(tau * (s + L + h - front) / g.wavelength);
          return [scale * s * g.cos - sign * g.sin * oscillation,
            (lower ? -depth : 0) + scale * s * sign * g.sin + g.cos * oscillation, 0.05];
        });
      }
      const arrived = front >= 2 * L + g.extra;
      spot.visible = arrived && g.matched;
      const key = `${settings}:${arrived}:${arrived ? Math.floor(state.time * 15) : 0}`;
      if (key === previous) return; previous = key;
      ctx.fillStyle = "#f6fafb"; ctx.fillRect(0, 0, 1024, 368);
      ctx.fillStyle = "#193947"; ctx.font = "bold 42px Arial"; ctx.fillText("Bragg-Station · mit Trigger auswählen", 20, 49);
      ctx.font = "29px Arial"; ctx.fillText("Bragg-Gleichung: nλ = 2d sin θ", 20, 97);
      ctx.fillText(`Zusatzweg unten: ${format(g.extra, 2)} Å = ${format(g.periods, 2)} λ`, 20, 141);
      ctx.fillStyle = arrived && !g.matched ? "#9e312d" : "#1e614c";
      ctx.fillText(!arrived ? "Detektor: Wellen noch nicht angekommen" : g.matched ? "Bragg-Reflex · in Phase" : "Keine Bragg-Stellung · phasenverschoben", 20, 187);
      ctx.fillStyle = "#193947"; ctx.fillText("Detektorvergleich (oben / unten):", 20, 233);
      if (arrived) for (const [row, offset] of [[0, 0], [1, g.periods]]) {
        ctx.strokeStyle = row ? "#743a99" : "#126b9b"; ctx.lineWidth = 4; ctx.beginPath();
        for (let i = 0; i <= 250; i++) {
          const x = 530 + i * 1.8, y = 215 + row * 36 + 13 * Math.sin(tau * ((i / 65 - front) / g.wavelength + offset));
          if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        } ctx.stroke();
      }
      ctx.fillText("λ Wellenlänge · d Ebenenabstand · θ Winkel zur Netzebene", 20, 308);
      ctx.fillText("n Beugungsordnung (1, 2, …) · keine Intensitätssimulation", 20, 348);
      texture.needsUpdate = true;
    }
    update();
    return {el, state, update, dispose() { el.remove(); resources.forEach(resource => resource.dispose()); }};
  }
  F.Bragg = {station, geometry, initial, command, tasks, hints, cues, progress, angleFor};
})(window.FKCVR);