"use strict";

(function (F) {
  const T = AFRAME.THREE;
  const voltage = 35; // kV; illustrative, not a setting of the adjacent demo.
  const kEdge = 20.0; // keV, rounded
  const lines = {
    alpha1: {label: "Kα₁", shell: "L₃ (2p₃/₂)", energy: 17.48, color: "#65edcf"},
    alpha2: {label: "Kα₂", shell: "L₂ (2p₁/₂)", energy: 17.37, color: "#ffb6eb"}
  };
  const continuum = "#ffc779", modes = ["alpha1", "alpha2", "brake"], duration = 6000;
  const info = {
    impact: ["1 · Elektronenstoß", "Ein elektrisches Feld beschleunigt Elektronen zur Mo-Anode. Bei 35 kV können sie bis zu 35 keV erreichen. Ein Stoß kann ein 1s-Elektron auslösen, wenn genug Energie übertragen wird (Mo-K-Kante: ca. 20,0 keV). Zurück bleibt eine K-Lücke."],
    alpha1: ["2 · Kα₁: L₃ → K", "Ein Elektron aus L₃ (2p₃/₂) füllt die K-Lücke (1s). Die Energiedifferenz wird als Röntgenphoton frei: ca. 17,48 keV bzw. 0,709 Å. Kα₁ und Kα₂ sind alternative Wege, nicht zwei Photonen aus derselben K-Lücke."],
    alpha2: ["2 · Kα₂: L₂ → K", "Stattdessen kann ein Elektron aus L₂ (2p₁/₂) die K-Lücke füllen: ca. 17,37 keV bzw. 0,714 Å. Spin-Bahn-Kopplung spaltet das 2p-Niveau. Deshalb liegen die beiden Linien nur etwa 0,11 keV auseinander."],
    brake: ["3 · Bremsstrahlung", "Im elektrischen Feld eines Mo-Kerns ändert das schnelle Elektron Richtung und Geschwindigkeit. Es verliert Energie, die als Röntgenphoton abgegeben werden kann. Unterschiedliche Energieverluste vieler Elektronen ergeben ein Kontinuum; keine K-Lücke ist nötig."],
    spectrum: ["4 · Spektrum der Mo-Anode", "Das Kontinuum endet bei Eₘₐₓ = eU (hier 35 keV). Darauf liegen die charakteristischen Linien; rechts im Diagramm ist das Kα-Dublett vergrößert. Intensitäten und Linienbreiten sind schematisch. Weitere Linien (z. B. Kβ) und Filterung sind nicht dargestellt."]
  };
  const clamp = t => Math.max(0, Math.min(1, t));
  const mix = (a, b, t) => a + (b - a) * t;
  const k = [-0.23, 0.04, 0.08];
  const outer = {alpha1: [0.37, 0.37, 0.04], alpha2: [0.39, -0.22, 0.16]};

  function frame(mode, elapsed) {
    const t = (elapsed % duration) / 1000, brake = mode === "brake";
    const approach = clamp(t / 2) ** 1.65;
    const exit = clamp((t - 2) / (brake ? 2.1 : 1.4));
    const fill = clamp((t - 3.05) / 0.95), emission = brake ? 2.12 : 4;
    const x = mix(-1.13, brake ? -0.05 : k[0], approach);
    const incoming = t < 2 ? [x, brake ? 0.22 : k[1], k[2]] : brake
      ? [-0.05 + 0.88 * exit, 0.22 - 0.74 * exit ** 2, 0.08 + 0.22 * exit ** 2]
      : [k[0] + 0.92 * exit, k[1] - 0.48 * exit, k[2] + 0.13 * exit];
    return {incoming, incomingVisible: t < (brake ? 4.1 : 3.4),
      vacancy: !brake && t >= 2 && t < 4, eject: !brake && t >= 2 && t < 3.45,
      ejectT: clamp((t - 2) / 1.45), fill, transfer: !brake && t >= 3.05 && t < 4,
      photon: clamp((t - emission) / 1.55),
      stage: t < 2 ? 0 : brake ? 4 : t < 3.05 ? 1 : t < 4 ? 2 : 3};
  }

  function intensity(e) {
    // A schematic envelope (not a prediction of a filtered/counting spectrum).
    return e > 0 && e < voltage ? 0.6 * (1 - Math.exp(-e / 3)) * (1 - e / voltage) : 0;
  }

  function spectrum(ctx, w, h, mode) {
    ctx.fillStyle = "#102738"; ctx.fillRect(0, 0, w, h);
    const text = (value, x, y, size, color = "#f0f7fb") => {
      ctx.fillStyle = color; ctx.font = `${size}px Arial`; ctx.fillText(value, x, y);
    };
    text("Mo-Röntgenspektrum · Beispiel: 35 kV", 28, 44, 34);
    text("Relative Intensität", 55, 90, 24);
    const left = 64, right = 610, base = 454, top = 110;
    const x = e => mix(left, right, e / voltage);
    ctx.strokeStyle = "#ccdbe6"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, base); ctx.lineTo(right, base); ctx.stroke();
    for (const e of [0, 10, 20, 30, 35]) {
      ctx.fillRect(x(e), base, 2, 7); text(String(e), x(e) - 9, base + 30, 20);
    }
    text("Photonenenergie / keV", 215, 523, 24);
    ctx.strokeStyle = continuum; ctx.lineWidth = mode === "brake" ? 7 : 4;
    ctx.beginPath();
    for (let i = 0; i <= 140; i++) {
      const e = voltage * i / 140, y = base - 330 * intensity(e);
      if (i === 0) ctx.moveTo(x(e), y); else ctx.lineTo(x(e), y);
    }
    ctx.stroke(); text("Bremsstrahlung", 92, 346, 23, continuum);
    ctx.strokeStyle = "#e0f4f7"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x(17.43), base - 330 * intensity(17.43));
    ctx.lineTo(x(17.43), 166); ctx.stroke(); text("Kα", x(17.43) - 14, 150, 27);
    ctx.strokeStyle = "#6e98ad"; ctx.strokeRect(643, 115, 352, 340);
    text("Kα-Dublett · vergrößert", 659, 150, 25);
    ctx.fillStyle = continuum; ctx.fillRect(664, 383, 307, 3);
    for (const [key, px, py, energy] of [["alpha2", 739, 274, "17,37"], ["alpha1", 887, 211, "17,48"]]) {
      const line = lines[key];
      ctx.fillStyle = line.color; ctx.fillRect(px - (mode === key ? 5 : 2), py, mode === key ? 10 : 4, 383 - py);
      text(line.label, px - 17, py - 12, 29, line.color); text(energy, px - 30, 419, 23);
    }
    text("keV", 942, 441, 19);
    text("Schematisch · Kβ und Filterung nicht gezeigt", 28, 573, 23);
  }

  AFRAME.registerComponent("fkc-mo-xray", {
    init() {
      this.resources = new Set();
      this.group = new T.Group();
      this.el.setObject3D("mo-xray", this.group);
      this.clock = 0; this.mode = modes[0]; this.auto = true; this.paused = false;
      this.infoKey = null; this.showInfo = true;
      this.model = new T.Group(); this.model.position.set(-0.88, 0.1, 0);
      this.group.add(this.model);
      const keep = resource => (this.resources.add(resource), resource);
      const sphere = keep(new T.SphereGeometry(1, 20, 14));
      const dot = (color, size, position) => {
        const mesh = new T.Mesh(sphere, keep(new T.MeshBasicMaterial({color, toneMapped: false})));
        mesh.scale.setScalar(size); mesh.position.set(...position); this.model.add(mesh); return mesh;
      };
      const nucleus = new T.Mesh(sphere, keep(new T.MeshStandardMaterial({color: "#8068a9", roughness: 0.44, emissive: "#281938"})));
      nucleus.scale.setScalar(0.14); this.model.add(nucleus);
      for (const [radius, width, tilt, color] of [[0.25, 0.009, 0.20, "#87b6e0"], [0.53, 0.008, -0.16, "#669faa"], [0.53, 0.008, 0.77, "#567789"]]) {
        const ring = new T.Mesh(keep(new T.TorusGeometry(radius, width, 7, 64)),
          keep(new T.MeshBasicMaterial({color, transparent: true, opacity: 0.65, depthWrite: false})));
        ring.rotation.y = tilt; this.model.add(ring);
      }
      this.kElectron = dot("#87b6e0", 0.045, k);
      dot("#87b6e0", 0.041, [0.23, -0.08, -0.06]);
      this.hole = new T.Mesh(keep(new T.TorusGeometry(0.047, 0.009, 8, 24)),
        keep(new T.MeshBasicMaterial({color: "#ff826f", side: T.DoubleSide})));
      this.hole.position.set(...k); this.model.add(this.hole);
      this.donors = Object.fromEntries(Object.keys(lines).map(key => [key, dot(lines[key].color, 0.049, outer[key])]));
      this.projectile = dot("#ffe26b", 0.06, [-1.13, 0.04, 0.08]);
      this.ejected = dot("#87b6e0", 0.045, k);
      this.waveGeometry = keep(new T.BufferGeometry());
      this.wavePositions = new Float32Array(51 * 3);
      this.waveGeometry.setAttribute("position", new T.BufferAttribute(this.wavePositions, 3).setUsage(T.DynamicDrawUsage));
      this.wave = new T.Line(this.waveGeometry, keep(new T.LineBasicMaterial({color: lines.alpha1.color})));
      this.wave.frustumCulled = false; this.model.add(this.wave);

      this.board = this.panel(1024, 604, 1.82, 1.074, [1.23, 0.28, -0.08]);
      this.heading = this.panel(1280, 150, 3.88, 0.455, [0.15, 1.15, -0.10]);
      this.status = this.panel(950, 104, 2.28, 0.25, [-0.85, -0.33, 0.2]);
      this.controls = this.panel(960, 250, 2.30, 0.60, [-0.85, -0.79, 0.20], true);
      this.explanation = this.panel(840, 370, 1.82, 0.80, [1.23, -0.70, -0.08]);
      this.paint(this.heading, "Wie entsteht Mo-Röntgenstrahlung?", ["Vergrößerter Blick in die Mo-Anode · Positionen, Zeiten und Wellen schematisch"], "#102738");
      for (const [label, x, y, color] of [["K (1s)", -1.24, 0.29, "#87b6e0"], ["L₃", -0.46, 0.62, lines.alpha1.color],
        ["L₂", -0.35, -0.14, lines.alpha2.color], ["Mo-Kern", -0.89, -0.12, "#dec7ff"]]) {
        const tag = this.panel(256, 86, 0.27, 0.09, [x, y, 0.22]);
        tag.ctx.fillStyle = "#102738"; tag.ctx.fillRect(0, 0, tag.w, tag.h);
        tag.ctx.fillStyle = color; tag.ctx.font = "bold 52px Arial"; tag.ctx.textAlign = "center";
        tag.ctx.fillText(label, tag.w / 2, 63, tag.w - 16); tag.texture.needsUpdate = true;
      }
      this.refresh(); this.renderFrame();
      F.invalidateHits?.();
    },

    panel(w, h, width, height, position, interactive = false) {
      const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
      const texture = new T.CanvasTexture(canvas);
      texture.encoding = T.sRGBEncoding; texture.minFilter = T.LinearFilter; texture.generateMipmaps = false;
      const geometry = new T.PlaneGeometry(width, height);
      const material = new T.MeshBasicMaterial({map: texture, toneMapped: false});
      [texture, geometry, material].forEach(resource => this.resources.add(resource));
      const mesh = new T.Mesh(geometry, material); mesh.position.set(...position);
      if (!interactive) mesh.raycast = () => {};
      this.group.add(mesh);
      return {ctx: canvas.getContext("2d"), texture, mesh, w, h};
    },

    paint(panel, title, paragraphs, background) {
      const {ctx, w, h, texture} = panel;
      ctx.fillStyle = background; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#f0f7fb"; ctx.font = "bold 47px Arial";
      ctx.fillText(title, 24, h < 110 ? 68 : 60, w - 48);
      ctx.font = "32px Arial";
      let y = 115;
      for (const para of paragraphs) {
        let row = "";
        for (const word of para.split(" ")) {
          const next = row ? `${row} ${word}` : word;
          if (row && ctx.measureText(next).width > w - 48) { ctx.fillText(row, 24, y); y += 42; row = word; }
          else row = next;
        }
        if (row) { ctx.fillText(row, 24, y); y += 42; }
      }
      texture.needsUpdate = true;
    },

    refresh() {
      spectrum(this.board.ctx, this.board.w, this.board.h, this.mode);
      this.board.texture.needsUpdate = true;
      const {ctx, w, h, texture} = this.controls;
      ctx.fillStyle = "#102738"; ctx.fillRect(0, 0, w, h);
      const buttons = [
        ["auto", "Auto", this.auto], ["alpha1", "Kα₁", !this.auto && this.mode === "alpha1"],
        ["alpha2", "Kα₂", !this.auto && this.mode === "alpha2"], ["brake", "Bremse", !this.auto && this.mode === "brake"],
        ["pause", this.paused ? "Weiter" : "Pause", this.paused], ["info", this.showInfo ? "Info aus" : "Info an", this.showInfo]
      ];
      if (this.showInfo) buttons.push(["impact", "i Stoß"], ["info-alpha1", "i Kα₁"], ["info-alpha2", "i Kα₂"], ["info-brake", "i Bremse"], ["spectrum", "i Spektrum"], ["close", "Schließen"]);
      this.buttons = buttons.map(([id, label, on], i) => {
        const x = 8 + 157 * (i % 6), y = i < 6 ? 16 : 132;
        ctx.fillStyle = on || id === this.infoKey || id === `info-${this.infoKey}` ? "#34697c" : "#224254";
        ctx.fillRect(x, y, 150, 100);
        ctx.fillStyle = "#f0f7fb"; ctx.font = "bold 27px Arial";
        ctx.fillText(label, x + 8, y + 61, 134);
        return {id, x, y};
      });
      texture.needsUpdate = true;
      this.explanation.mesh.visible = this.showInfo && Boolean(this.infoKey);
      if (this.explanation.mesh.visible) {
        const [title, body] = info[this.infoKey];
        this.paint(this.explanation, title, [body], "#183b4f");
      }
    },

    click(uv) {
      if (!uv) return;
      const x = uv.x * this.controls.w, y = (1 - uv.y) * this.controls.h;
      const button = this.buttons.find(b => x >= b.x && x <= b.x + 150 && y >= b.y && y <= b.y + 100);
      if (!button) return;
      const id = button.id;
      if (id === "pause") this.paused = !this.paused;
      else if (id === "auto" || modes.includes(id)) {
        this.auto = id === "auto"; this.mode = this.auto ? modes[0] : id;
        this.clock = 0; this.paused = false;
      } else if (id === "info") {
        this.showInfo = !this.showInfo;
        if (!this.showInfo) this.infoKey = null;
      } else if (id === "close") this.infoKey = null;
      else {
        const key = id.replace(/^info-/, "");
        this.infoKey = this.infoKey === key ? null : key;
      }
      this.refresh(); this.renderFrame();
    },

    renderFrame() {
      const s = frame(this.mode, this.clock), line = lines[this.mode];
      this.projectile.position.set(...s.incoming); this.projectile.visible = s.incomingVisible;
      this.kElectron.visible = !s.vacancy; this.hole.visible = s.vacancy;
      this.ejected.visible = s.eject;
      this.ejected.position.set(k[0] - 0.42 * s.ejectT, k[1] + 0.67 * s.ejectT, k[2] + 0.26 * s.ejectT);
      for (const [key, electron] of Object.entries(this.donors)) {
        const origin = outer[key], active = this.mode === key;
        electron.position.set(...origin);
        if (active && s.transfer) electron.position.set(...origin.map((v, i) => mix(v, k[i], s.fill)));
        electron.visible = !active || s.stage < 3;
      }
      this.wave.visible = s.photon > 0;
      if (this.wave.visible) {
        this.wave.material.color.set(line?.color || continuum);
        for (let i = 0; i <= 50; i++) {
          const u = i / 50, d = 1.10 * s.photon * u;
          this.wavePositions[3 * i] = (line ? k[0] : -0.05) + d;
          this.wavePositions[3 * i + 1] = (line ? k[1] : 0.22) + 0.46 * d + 0.035 * Math.sin(38 * d - 9 * s.photon) * Math.sin(Math.PI * u);
          this.wavePositions[3 * i + 2] = k[2] + 0.28 * d;
        }
        this.waveGeometry.attributes.position.needsUpdate = true;
      }
      const step = ["Anflug · gelb: schnelles Elektron", "Stoß · K-Elektron wird herausgelöst", `${line?.shell || ""} → K · Elektron füllt die Lücke`, `${line?.label || ""} · Röntgenphoton entsteht`, "Ablenkung am Kern · Bremsphoton entsteht"][s.stage];
      if (step !== this.lastStep) {
        this.paint(this.status, step, [], "#16394d"); this.lastStep = step;
      }
    },

    tick(time, delta) {
      if (this.paused) return;
      this.clock += Math.min(delta || 0, 100);
      if (this.clock >= duration) {
        this.clock %= duration;
        if (this.auto) { this.mode = modes[(modes.indexOf(this.mode) + 1) % modes.length]; this.refresh(); }
      }
      this.renderFrame();
    },

    remove() {
      this.el.removeObject3D("mo-xray");
      this.resources.forEach(resource => resource.dispose());
      F.invalidateHits?.();
    }
  });

  F.MoXray = {frame, lines, voltage, kEdge, intensity, activate(hit) {
    const demo = hit.el?.components?.["fkc-mo-xray"];
    if (!demo) return false;
    if (hit.mesh === demo.controls.mesh && !F.Menu?.opened && !F.HandMenu?.opened) demo.click(hit.uv);
    return true;
  }};

  const buildRoom = F.RoomBuilder.build;
  F.RoomBuilder.build = function (parent, config, rooms) {
    const result = buildRoom.call(this, parent, config, rooms);
    if (config.id === "vorlesung-5") {
      const station = F.create("a-entity", {id: "fkc-mo-xray-station", class: "vr-action", position: "4.15 1.5 -2.8", rotation: "0 -15 0"}, parent);
      station.setAttribute("fkc-mo-xray", "");
    }
    return result;
  };
})(window.FKCVR);