"use strict";

// Zwei kohärente Beiträge in symmetrischer Streugeometrie, keine Intensitätssimulation.
(function (F) {
  const tau = 2 * Math.PI, d = 2;
  const sources = Object.freeze({mo: 0.7107, cu: 1.5406}); // Kα-Lehrwerte in Å
  const defaultSource = "mo", minAngle = 10, maxAngle = 105;
  const angleFor = (periods, source = defaultSource) => 2 * Math.asin(periods * sources[source] / (2 * d)) * 180 / Math.PI;
  const bragg = angleFor(1);
  function geometry(twoTheta, source = defaultSource) {
    const wavelength = sources[source];
    const theta = twoTheta * Math.PI / 360, sin = Math.sin(theta), cos = Math.cos(theta);
    const extra = 2 * d * sin, periods = extra / wavelength;
    return {theta, sin, cos, extra, periods, wavelength,
      matched: Math.round(periods) > 0 && Math.abs(periods - Math.round(periods)) < 1e-7};
  }
  function lowerPath(g) {
    const h = g.extra / 2;
    return [[-h * g.cos, -d + h * g.sin], [0, -d], [h * g.cos, -d + h * g.sin]];
  }
  function waveComparison(cycles, phaseOffset) {
    const upper = Math.sin(tau * cycles), lower = Math.sin(tau * (cycles + phaseOffset));
    return [upper, lower, upper + lower];
  }
  function wavePoint(s, lower, outgoing, g, front, scale) {
    const sign = outgoing ? 1 : -1;
    // Nur die gezeichnete Amplitude am Streuzentrum verjüngen; der optische
    // Weg und die Phasenlage am Detektor bleiben unverändert.
    const envelope = Math.min(1, Math.abs(s) / (0.18 * g.wavelength));
    const amplitude = envelope * 0.026 * Math.sin(tau * (s + 6 + (lower ? g.extra / 2 : 0) - front) / g.wavelength);
    return [scale * s * g.cos - sign * g.sin * amplitude,
      (lower ? -d * scale : 0) + scale * s * sign * g.sin + g.cos * amplitude, 0];
  }
  const holdSeconds = 3;
  function initial() { return {angle: bragg, source: defaultSource, speed: 1, running: false, time: 0, sweep: 0, sweepHold: 0}; }
  function advance(s, seconds) {
    if (s.running) s.time += seconds * s.speed;
    if (!s.sweep) return;
    if (s.sweepHold > 0) {
      const held = Math.min(seconds, s.sweepHold);
      s.sweepHold -= held;
      seconds -= held;
      if (!seconds) return;
    }
    const angle = s.angle + s.sweep * seconds * 6;
    // Eine Stellung kann zwischen zwei Frames liegen: auf den exakten Winkel
    // setzen, statt darauf zu warten, dass ein Frame ihn zufällig trifft.
    const stops = [];
    for (let n = 1; n <= geometry(maxAngle, s.source).periods; n++) stops.push(angleFor(n, s.source));
    if (s.sweep < 0) stops.reverse();
    const stop = stops.find(value => value >= minAngle && (s.sweep > 0
      ? value > s.angle + 1e-7 && value <= angle : value < s.angle - 1e-7 && value >= angle));
    if (stop !== undefined) { s.angle = stop; s.sweepHold = holdSeconds; return; }
    if (angle >= maxAngle) { s.angle = 2 * maxAngle - angle; s.sweep = -1; }
    else if (angle <= minAngle) { s.angle = 2 * minAngle - angle; s.sweep = 1; }
    else s.angle = angle;
  }
  function command(s, id) {
    if (["bragg", "compare", "minus", "plus"].includes(id)) { s.sweep = 0; s.sweepHold = 0; }
    switch (id) {
      case "reset": Object.assign(s, initial()); break;
      case "play": s.running = !s.running; break;
      case "slow": s.speed = 0.5; break;
      case "normal": s.speed = 1; break;
      case "fast": s.speed = 2; break;
      case "sweep":
        s.sweep = s.sweep ? 0 : s.angle >= maxAngle ? -1 : 1;
        s.sweepHold = s.sweep && geometry(s.angle, s.source).matched ? holdSeconds : 0;
        break;
      case "mo": case "cu":
        s.source = id; // Wirkung von λ bei gleichem Winkel zeigen.
        s.sweepHold = s.sweep && geometry(s.angle, s.source).matched ? holdSeconds : 0;
        break;
      case "bragg": s.angle = angleFor(1, s.source); break;
      case "compare": s.angle = angleFor(1.5, s.source); break;
      case "minus": s.angle = Math.max(minAngle, s.angle - 1); break;
      case "plus": s.angle = Math.min(maxAngle, s.angle + 1); break;
    }
  }
  const tasks = ["Zur Bragg-Station gehen", "Animation mit dem Trigger auswählen", "Handmenü öffnen",
    "Animation starten", "Auf halbe Geschwindigkeit wechseln", "Info zum Ebenenabstand öffnen", "Vergleichswinkel einstellen", "Mo-Winkellauf: nächsten Reflex beobachten", "Animation pausieren"];
  const hints = ["Strukturteil geschafft! Geh zur Bragg-Station vor dir.", "Ziele auf die Netzebenen oder den Infotext darunter und drücke den Trigger.",
    "Dreh die Handfläche ohne Laser zu dir.", "Drücke Start. Beobachte die Wellen bis zum Detektor.",
    "Wähle Bragg-Stellung und 0,5×. Die Wellenlänge bleibt gleich.", "Bei Bragg und 0,5×: Öffne das i neben d = 2,00 Å.",
    "Wähle Vergleich: Berg trifft jetzt Tal.", "Mo Kα wählen, Winkellauf starten. Warte auf den Halt ab Ordnung 2.", "Drücke Pause. Der Phasenvergleich bleibt stehen."];
  const cues = {3: "play", 4: "slow", 6: "compare", 7: "sweep", 8: "play"};
  const slowBragg = s => s.running && s.speed === 0.5 && geometry(s.angle, s.source).matched;
  function progress(step, near, selected, menu, s, infoOpened = false) {
    return [near, selected, menu, s.running && s.time >= 4, slowBragg(s), slowBragg(s) && infoOpened,
      Math.abs(s.angle - angleFor(1.5, s.source)) < 1e-7,
      s.running && s.source === "mo" && s.sweep && s.sweepHold > 0 && geometry(s.angle,s.source).periods >= 1.999999 && geometry(s.angle,s.source).matched,
      !s.running][step] ? step + 1 : step;
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
    bracket.set(t => [[-0.59, 0, 0.24], [-0.64, 0, 0.24], [-0.64, -depth, 0.24], [-0.59, -depth, 0.24]][Math.round(t * 3)]);
    const distanceLabel = document.createElement("canvas"); distanceLabel.width = 384; distanceLabel.height = 96;
    const distanceCtx = distanceLabel.getContext("2d");
    distanceCtx.fillStyle = "#f6fafb"; distanceCtx.fillRect(0, 0, 384, 96);
    distanceCtx.fillStyle = "#193947"; distanceCtx.font = "bold 52px Arial";
    distanceCtx.textAlign = "center"; distanceCtx.fillText("d = 2,00 Å", 192, 65);
    const distanceMesh = new T.Mesh(keep(new T.PlaneGeometry(0.32, 0.08)),
      keep(new T.MeshBasicMaterial({map: keep(new T.CanvasTexture(distanceLabel)), side: T.DoubleSide})));
    distanceMesh.position.set(-0.82, -depth / 2, 0.24);
    distanceMesh.raycast = function () {}; rig.add(distanceMesh);
    const infoContent = {
      distance: ["Netzebenenabstand d", "d ist der senkrechte Abstand", "zwischen benachbarten Netzebenen.", "Hier: d = 2,00 Å."],
      path: ["Gangunterschied Δs", "Unten sind zwei Wege je d sin θ länger.", "Zusammen: Δs = 2d sin θ.", "Gilt Δs = nλ, sind die Wellen in Phase."],
      waves: ["Wellen am Detektor", "λ: Wellenlänge · θ: Winkel zur Ebene.", "n: positive ganze Beugungsordnung.", "Die Summe zeigt Amplitude, keine Intensität."],
      detector: ["Weißer Reflexpunkt", "Sind beide Beiträge in Phase, addieren", "sich ihre Amplituden konstruktiv.", "Der Punkt markiert dies, keine gemessene Intensität."]
    };
    function card(width, height, w, h) {
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      const texture = keep(new T.CanvasTexture(canvas));
      const mesh = new T.Mesh(keep(new T.PlaneGeometry(w, h)), keep(new T.MeshBasicMaterial({map: texture, side: T.DoubleSide})));
      return {canvas, ctx: canvas.getContext("2d"), texture, mesh};
    }
    const badge = card(128, 128, 0.13, 0.13);
    badge.ctx.fillStyle = "#276f8b"; badge.ctx.fillRect(0, 0, 128, 128);
    badge.ctx.fillStyle = "#ffffff"; badge.ctx.font = "bold 94px Arial"; badge.ctx.textAlign = "center";
    badge.ctx.fillText("i", 64, 98); badge.texture.needsUpdate = true;
    const badgeMaterials = {normal:badge.mesh.material};
    for (const [id, color, ink] of [["cue", "#ffe049", "#3c3011"], ["selected", "#ad4935", "#ffffff"]]) {
      const tile = card(128,128,0.13,0.13);
      tile.ctx.fillStyle=color; tile.ctx.fillRect(0,0,128,128);
      tile.ctx.fillStyle=ink;tile.ctx.font="bold 90px Arial";tile.ctx.textAlign="center";tile.ctx.fillText("i",64,98);
      if(id==="selected"){tile.ctx.strokeStyle=ink;tile.ctx.lineWidth=6;tile.ctx.strokeRect(6,6,116,116);}
      tile.texture.needsUpdate=true;badgeMaterials[id]=tile.mesh.material;
    }
    const badges=[];
    for (const [id, group, pos] of [["distance", rig, [-1.06, -depth / 2, 0.248]],
      ["path", rig, [0.13, -depth - 0.11, 0.21]], ["waves", el.object3D, [0.96, -0.77, 0.12]]]) {
      const marker = badge.mesh.clone(); marker.userData.braggInfo = id;
      marker.position.set(...pos); group.add(marker); badges.push(marker);
    }
    const info = card(800, 350, 1.25, 0.55);
    info.mesh.position.set(-1.48, 0.39, 0.23); info.mesh.visible = false;
    info.mesh.userData.braggInfo = "close"; el.object3D.add(info.mesh);
    let openInfo = null;
    function toggleInfo(id) {
      if (id === openInfo || id === "close") { openInfo = null; info.mesh.visible = false; return false; }
      if (!Object.hasOwn(infoContent, id)) return false;
      openInfo = id;
      const ctx = info.ctx;
      ctx.fillStyle = "#f6fafb"; ctx.fillRect(0, 0, 800, 350);
      ctx.fillStyle = "#276f8b"; ctx.fillRect(0, 0, 800, 82);
      ctx.fillStyle = "#ffffff"; ctx.font = "bold 44px Arial"; ctx.fillText(infoContent[id][0], 25, 57, 750);
      ctx.fillStyle = "#193947"; ctx.font = "35px Arial";
      infoContent[id].slice(1).forEach((line, index) => ctx.fillText(line, 25, 133 + index * 53, 750));
      ctx.font = "27px Arial"; ctx.fillText("Mit Trigger schließen", 25, 320);
      info.texture.needsUpdate = true; info.mesh.visible = true;
      return true;
    }
    const guideGeometry = keep(new T.BufferGeometry());
    const guidePositions = new T.Float32BufferAttribute(new Float32Array(2 * 6 * 2 * 3), 3);
    guideGeometry.setAttribute("position", guidePositions);
    const guides = new T.LineSegments(guideGeometry, keep(new T.LineBasicMaterial({color: 0xa32929})));
    guides.frustumCulled = false; rig.add(guides);
    const marks = [0, 2].map(() => {
      const marker = new T.Mesh(sphere, basic(0xa32929));
      marker.scale.setScalar(0.52); marker.raycast = function () {}; rig.add(marker);
      return marker;
    });
    const arc = line(33, 0x675996, el.object3D), thetaArc = line(25, 0x28647b);
    const baseline = line(2, 0x777777, el.object3D); baseline.set(t => [t * 0.45, 0, 0.012]);
    const track = line(55, 0x536976, el.object3D);
    track.set(t => { const a = (minAngle + t * (maxAngle - minAngle)) * Math.PI / 180; return [scale * L * Math.cos(a), scale * L * Math.sin(a), 0]; });
    const detector = box(0.02, 0.40, 0.35, basic(0x8aa7bc, 0.55), rig);
    const spot = new T.Mesh(keep(new T.SphereGeometry(0.031, 14, 10)), basic(0xffffff));
    detector.add(spot); spot.position.x = -0.018;
    const detectorBadge = badge.mesh.clone(); detectorBadge.userData.braggInfo = "detector";
    badges.push(detectorBadge);
    detectorBadge.position.set(0.02, 0.27, 0.14); detector.add(detectorBadge);
    spot.userData.braggInfo = "detector";
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
    function update(head, distanceTask) {
      if (head && info.mesh.visible) info.mesh.lookAt(head);
      for(const marker of badges){const id=marker.userData.braggInfo;
        marker.material=badgeMaterials[id===openInfo?"selected":distanceTask && id==="distance"?"cue":"normal"];
        marker.scale.setScalar(id===openInfo?1.2:distanceTask && id==="distance"?1.12:1);
      }
      const sweepPaused = state.sweepHold > 0;
      const settings = `${state.source}:${state.angle}:${sweepPaused}`;
      const frame = `${settings}:${state.time}`;
      if (frame === lastFrame) return;
      lastFrame = frame;
      const g = geometry(state.angle, state.source), half = g.extra / 2;
      if (equationKey !== settings) {
        equationKey = settings;
        const path = lowerPath(g);
        [path[0], path[2]].forEach(([x, y], i) => marks[i].position.set(x * scale, y * scale, 0));
        let index = 0;
        for (const [x, y] of [path[0], path[2]]) {
          for (let dash = 0; dash < 6; dash++) for (const end of [0, 0.63]) {
            const t = (dash + end) / 5.63;
            guidePositions.setXYZ(index++, x * scale * t, y * scale * t, 0);
          }
        }
        guidePositions.needsUpdate = true;
        liveCtx.fillStyle = "#f6fafb"; liveCtx.fillRect(0, 0, 1024, 190);
        liveCtx.fillStyle = "#193947"; liveCtx.font = "30px Arial";
        liveCtx.fillText(`${state.source === "mo" ? "Mo" : "Cu"} Kα  ·  2θ = ${format(state.angle, 1)}°${sweepPaused ? "  ·  Winkellauf hält" : ""}`, 24, 42);
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
          return wavePoint(s, lower, outgoing, g, front, scale);
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
      ctx.fillStyle = "#e3edf2"; ctx.fillRect(20, 201, 478, 103); ctx.fillRect(522, 201, 482, 103);
      ctx.fillStyle = "#193947"; ctx.font = "24px Arial";
      ctx.fillText("Einzelwellen · oben / unten", 34, 227);
      ctx.fillText("Summe · gleiche Amplitudenskala", 536, 227);
      if (arrived) for (const [row, left, baselineY, color] of [
        [0, 34, 248, "#126b9b"], [1, 34, 282, "#743a99"], [2, 536, 265, "#193947"]]) {
        ctx.strokeStyle = "#9eafb9"; ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(left, baselineY); ctx.lineTo(left + 450, baselineY); ctx.stroke();
        ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.lineJoin = "round"; ctx.beginPath();
        for (let i = 0; i <= 180; i++) {
          // Der Detektorvergleich läuft absichtlich langsamer als die Raumwellen.
          const value = waveComparison(2 * i / 180 - state.time * 0.48, g.periods)[row];
          const x = left + i * 2.5, y = baselineY - 13 * value;
          if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        } ctx.stroke();
      }
      ctx.fillText("Die i-Zeichen öffnen kurze Erklärungen.", 20, 348);
      texture.needsUpdate = true;
    }
    update();
    return {el, state, update, toggleInfo, dispose() { el.remove(); resources.forEach(resource => resource.dispose()); }};
  }
  F.Bragg = {station, geometry, lowerPath, waveComparison, wavePoint, initial, advance, command, tasks, hints, cues, progress, angleFor};
})(window.FKCVR);