"use strict";

(function (F) {
  const T = AFRAME.THREE;
  const distance = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));
  const sub = (a, b) => a.map((value, axis) => value - b[axis]);
  const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = a => {
    const length = Math.hypot(...a);
    if (length < 1e-10) throw new Error("Geometrie nicht definiert (gleiche/kollineare Punkte).");
    return a.map(value => value / length);
  };
  function angle(a, b, c) {
    return Math.acos(Math.max(-1, Math.min(1, dot(unit(sub(a, b)), unit(sub(c, b)))))) * 180 / Math.PI;
  }
  function torsion(a, b, c, d) {
    const axis = unit(sub(c, b));
    const first = sub(a, b);
    const last = sub(d, c);
    const v = unit(first.map((value, i) => value - dot(first, axis) * axis[i]));
    const w = unit(last.map((value, i) => value - dot(last, axis) * axis[i]));
    return Math.atan2(dot(cross(axis, v), w), dot(v, w)) * 180 / Math.PI;
  }
  const counts = {distance: 2, angle: 3, torsion: 4};
  const titles = {distance: "Distanz", angle: "Winkel", torsion: "Torsion"};
  const colors = {distance: "#ffcc33", angle: "#ff5555", torsion: "#5599ff"};
  const displayFields = ["geometry", "material", "line", "canvas", "texture", "labelMaterial",
    "label", "haloGeometry", "haloMaterial", "halos", "rodGeometry", "rodMaterial", "rods",
    "guideGeometry", "guideMaterial", "guide", "planeGeometry", "planeMaterial", "planes",
    "points", "meshes", "root", "visual", "labelWidth", "measurementMode", "resultText"];
  F.Measure = {
    distance, angle, torsion, counts, titles, colors,
    enabled: false,
    mode: "distance",
    toggleMode(mode) {
      if (!counts[mode]) return;
      if (this.enabled && this.mode === mode) this.setEnabled(false);
      else this.setMode(mode);
    },
    setMode(mode) {
      if (!counts[mode]) return;
      this.mode = mode;
      this.setEnabled(true);
    },
    setEnabled(value) {
      this.enabled = value;
      const component = F.getScene().components["fkc-measurements"];
      if (component) component.clearSelection();
      F.Menu.blockDrawing();
    },
    click(hit) {
      if (!this.enabled || !hit || hit.type !== "model") return false;
      const component = F.getScene().components["fkc-measurements"];
      if (component) component.select(hit);
      return true;
    }
  };
  AFRAME.registerComponent("fkc-measurements", {
    init: function () {
      this.saved = [];
      this.createDisplay();
    },
    createDisplay: function (mode = F.Measure.mode) {
      this.points = [];
      this.meshes = [];
      this.root = null;
      this.measurementMode = mode;
      const color = colors[this.measurementMode];
      this.geometry = new T.BufferGeometry();
      this.geometry.setAttribute("position", new T.Float32BufferAttribute(new Array(12).fill(0), 3));
      this.material = new T.LineBasicMaterial({color, depthTest: false});
      this.line = new T.Line(this.geometry, this.material);
      this.line.raycast = function () {};
      this.canvas = document.createElement("canvas");
      this.canvas.width = 512;
      this.canvas.height = 128;
      this.texture = new T.CanvasTexture(this.canvas);
      this.labelMaterial = new T.SpriteMaterial({map: this.texture, depthTest: false, depthWrite: false});
      this.label = new T.Sprite(this.labelMaterial);
      this.label.raycast = function () {};
      this.line.renderOrder = 1002;
      this.label.renderOrder = 1101;
      this.el.object3D.add(this.line, this.label);
      this.haloGeometry = new T.SphereGeometry(1, 16, 12);
      this.haloMaterial = new T.MeshBasicMaterial({color, transparent: true,
        opacity: 0.16, depthWrite: false});
      this.halos = [];
      for (let i = 0; i < 4; i++) {
        const halo = new T.Mesh(this.haloGeometry, this.haloMaterial);
        halo.raycast = function () {};
        this.el.object3D.add(halo);
        this.halos.push(halo);
      }
      this.rodGeometry = new T.CylinderGeometry(1, 1, 1, 12);
      this.rodMaterial = new T.MeshBasicMaterial({color, transparent: true,
        opacity: 0.35, depthTest: false, depthWrite: false});
      this.rods = [];
      for (let i = 0; i < 3; i++) {
        const rod = new T.Mesh(this.rodGeometry, this.rodMaterial);
        rod.raycast = function () {};
        rod.renderOrder = 1001;
        this.el.object3D.add(rod);
        this.rods.push(rod);
      }
      this.guideGeometry = new T.BufferGeometry();
      this.guideGeometry.setAttribute("position", new T.Float32BufferAttribute(new Array(99).fill(0), 3));
      this.guideMaterial = new T.LineBasicMaterial({color, depthTest: false});
      this.guide = new T.Line(this.guideGeometry, this.guideMaterial);
      this.guide.raycast = function () {};
      this.guide.renderOrder = 1003;
      this.el.object3D.add(this.guide);
      this.planeGeometry = new T.BufferGeometry();
      this.planeGeometry.setAttribute("position", new T.Float32BufferAttribute(new Array(18).fill(0), 3));
      this.planeMaterial = new T.MeshBasicMaterial({color, transparent: true, opacity: 0.12,
        side: T.DoubleSide, depthTest: false, depthWrite: false});
      this.planes = new T.Mesh(this.planeGeometry, this.planeMaterial);
      this.planes.raycast = function () {};
      this.planes.renderOrder = 1000;
      this.el.object3D.add(this.planes);
      this.hideDisplay();
    },
    hideDisplay: function () {
      this.line.visible = this.label.visible = this.guide.visible = this.planes.visible = false;
      this.halos.concat(this.rods).forEach(object => { object.visible = false; });
    },
    clearSelection: function () {
      this.points = [];
      this.root = null;
      this.meshes = [];
      if (this.guide) this.hideDisplay();
      else this.line.visible = this.label.visible = false;
      this.syncLabels();
    },
    syncLabels: function () {
      const labels = this.el.components["fkc-atom-labels"];
      if (!labels) return;
      if (!labels.measureLabels) labels.measureLabels = new Map();
      labels.measureLabels.clear();
      [...(this.saved || []), ...(this.sharedDisplays?.values() || []), this].forEach(record => {
        (record.meshes || []).forEach((mesh, i) => labels.measureLabels.set(mesh,
          {root: record.root, atom: record.points[i]}));
      });
    },
    reset: function (root) {
      const active = Object.fromEntries(displayFields.map(key => [key, this[key]]));
      const retained = [];
      for (const record of this.saved || []) {
        if (root && record.root !== root) { retained.push(record); continue; }
        Object.assign(this, record);
        this.disposeDisplay();
      }
      Object.assign(this, active);
      this.saved = retained;
      if (!root || this.root === root) this.clearSelection();
      else this.syncLabels();
    },
    archive: function () {
      if (this.points.length !== counts[this.measurementMode]) return;
      this.saved.push(Object.fromEntries(displayFields.map(key => [key, this[key]])));
      this.createDisplay();
      this.syncLabels();
    },
    select: function (hit) {
      const visual = hit.el.querySelector(".model-visual");
      const structure = visual && visual.fkcStructure;
      if (!structure || !["molecule", "coordination"].includes(structure.mode)) {
        F.setStatus("Messungen nur am CIF-Molekül oder der Koordinationsumgebung verfügbar.");
        return;
      }
      const required = counts[F.Measure.mode];
      const bond = hit.mesh.userData.fkcBond;
      const atom = hit.mesh.userData.fkcAtom;
      if (!atom && !(F.Measure.mode === "distance" && bond &&
          Number.isInteger(bond.a) && Number.isInteger(bond.b))) return;
      // Abgeschlossene Anzeigen erhalten; nur Auswahl für neue Messung leeren.
      if (this.root && this.root !== hit.el) this.clearSelection();
      if (this.points.length === counts[this.measurementMode]) this.archive();
      if (F.Measure.mode === "distance" && bond) this.clearSelection();
      this.measurementMode = F.Measure.mode;
      if (this.material) {
        [this.material, this.haloMaterial, this.rodMaterial, this.guideMaterial, this.planeMaterial]
          .forEach(material => material.color.set(colors[this.measurementMode]));
      }
      this.root = hit.el;
      this.visual = visual;
      const meshes = new Map();
      visual.object3D.traverse(mesh => {
        if (mesh.userData.fkcAtom) meshes.set(mesh.userData.fkcAtom.id, mesh);
      });
      if (F.Measure.mode === "distance" && bond && Number.isInteger(bond.a) && Number.isInteger(bond.b)) {
        this.points = [structure.atoms[bond.a], structure.atoms[bond.b]];
      } else if (hit.mesh.userData.fkcAtom) {
        const index = this.points.findIndex(point => point.id === atom.id);
        if (index !== -1) {
          this.points.splice(index, 1);
          F.setStatus("Atomauswahl zurückgenommen.");
        } else this.points.push(atom);
      } else return;
      this.meshes = this.points.map(atom => meshes.get(atom.id));
      this.syncLabels();
      this.line.visible = this.label.visible = false;
      if (this.points.length !== required) {
        if (this.points.length) this.drawLabel(`${titles[this.measurementMode]} ${this.points.length}/${required}`);
        F.setStatus(titles[F.Measure.mode] + ": " + this.points.length + "/" + required + " Atome gewählt.");
        return;
      }
      this.renderResult();
      F.setStatus(titles[F.Measure.mode] + ": " + this.resultText);
      // Sofort archivieren: Modus-Aus und nächste Messung erhalten dieses Ergebnis.
      if (this.saved && this.geometry) this.archive();
    },
    renderResult: function () {
      let text;
      try {
        const coordinates = this.points.map(point => point.positionAngstrom);
        const result = F.Measure[this.measurementMode](...coordinates);
        text = result.toFixed(this.measurementMode === "distance" ? 3 : 1) +
          (this.measurementMode === "distance" ? " Å" : "°");
      } catch (error) { text = "Nicht definiert"; }
      this.drawLabel(text);
      this.resultText = text;
    },
    drawLabel: function (text) {
      const ctx = this.canvas.getContext("2d");
      ctx.font = "bold 52px Arial";
      this.labelWidth = Math.min(512, Math.max(96, Math.ceil(ctx.measureText(text).width) + 40));
      this.texture.repeat.set(this.labelWidth / 512, 1);
      ctx.clearRect(0, 0, 512, 128);
      ctx.strokeStyle = "#173527";
      ctx.lineWidth = 7;
      ctx.lineJoin = "round";
      ctx.fillStyle = colors[this.measurementMode];
      ctx.font = "bold 52px Arial";
      ctx.textAlign = "center";
      ctx.strokeText(text, this.labelWidth / 2, 82, this.labelWidth - 24);
      ctx.fillText(text, this.labelWidth / 2, 82, this.labelWidth - 24);
      this.texture.needsUpdate = true;
    },
    updateShared: function (entries) {
      if (!this.sharedDisplays) this.sharedDisplays = new Map();
      const active = Object.fromEntries(displayFields.map(key => [key, this[key]]));
      const local = this.saved || [];
      for (const [key, record] of this.sharedDisplays) {
        const next = entries.get(key);
        if (next?.visual === record.visual && next.meshes.every((mesh, i) => mesh === record.meshes[i])) continue;
        Object.assign(this, record);
        this.disposeDisplay();
        this.sharedDisplays.delete(key);
      }
      for (const [key, entry] of entries) {
        if (this.sharedDisplays.has(key)) continue;
        this.createDisplay(entry.measurementMode);
        Object.assign(this, entry);
        this.renderResult();
        this.sharedDisplays.set(key, Object.fromEntries(displayFields.map(field => [field, this[field]])));
      }
      for (const record of this.sharedDisplays.values()) {
        Object.assign(this, record);
        if (record.meshes.some(mesh => !mesh.visible) || local.some(entry => entry.visual === record.visual && entry.measurementMode === record.measurementMode &&
            entry.meshes.every((mesh, i) => mesh === record.meshes[i]))) this.hideDisplay();
        else this.updateDisplay();
      }
      Object.assign(this, active);
      this.syncLabels();
    },
    tick: function () {
      const active = Object.fromEntries(displayFields.map(key => [key, this[key]]));
      const valid = [];
      for (const record of this.saved) {
        Object.assign(this, record);
        if (this.validDisplay()) { this.updateDisplay(); valid.push(record); }
        else this.disposeDisplay();
      }
      Object.assign(this, active);
      this.saved = valid;
      if (this.root && !this.validDisplay()) this.clearSelection();
      this.updateDisplay();
      this.syncLabels();
    },
    validDisplay: function () {
      return this.root && this.root.isConnected && this.root.querySelector(".model-visual") === this.visual;
    },
    updateDisplay: function () {
      if (!this.root) return;
      if (!this.el.camera || !this.meshes) return;
      const visible = !(F.Menu && F.Menu.opened);
      const pending = this.points.length > 0 && this.points.length < counts[this.measurementMode];
      this.haloMaterial.opacity = pending ? 0.55 : 0.16;
      this.haloMaterial.depthTest = !pending;
      const positions = this.meshes.map(mesh => {
        mesh.updateWorldMatrix(true, false);
        const position = mesh.getWorldPosition(new T.Vector3());
        return this.el.object3D.worldToLocal(position);
      });
      this.halos.forEach((halo, i) => {
        halo.visible = visible && i < positions.length;
        if (i >= positions.length) return;
        halo.position.copy(positions[i]);
        const scale = this.meshes[i].getWorldScale(new T.Vector3());
        halo.renderOrder = pending ? 1080 : 1000;
        halo.scale.setScalar(Math.max(scale.x, scale.y, scale.z) * (pending ? 1.55 : 1.2));
      });
      this.rods.forEach((rod, i) => {
        rod.visible = visible && i + 1 < positions.length;
        if (i + 1 >= positions.length) return;
        const a = positions[i];
        const b = positions[i + 1];
        const direction = b.clone().sub(a);
        const length = direction.length();
        rod.position.copy(a).add(b).multiplyScalar(0.5);
        if (length > 1e-10) rod.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), direction.normalize());
        const scale = this.meshes[i].getWorldScale(new T.Vector3());
        const radius = Math.max(scale.x, scale.y, scale.z) * 0.4;
        rod.scale.set(radius, length, radius);
      });
      if (pending) {
        const last = this.points.length - 1;
        this.label.position.copy(positions[last]);
        const head = this.el.camera.getWorldPosition(new T.Vector3());
        const width = T.MathUtils.clamp(this.meshes[last].getWorldPosition(new T.Vector3()).distanceTo(head) * 0.19, 0.10, 0.5);
        this.label.position.y += width * 0.36;
        this.label.scale.set(width * this.labelWidth / 512, width / 4, 1);
        this.label.renderOrder = 1110;
        this.label.visible = visible;
        this.line.visible = false;
        return;
      }
      if (!this.points.length) {
        this.label.visible = this.line.visible = false;
        return;
      }
      const attribute = this.geometry.attributes.position;
      positions.forEach((position, i) => attribute.setXYZ(i, position.x, position.y, position.z));
      this.geometry.setDrawRange(0, positions.length);
      attribute.needsUpdate = true;
      this.geometry.computeBoundingSphere();
      this.label.position.set(0, 0, 0);
      positions.forEach(position => this.label.position.add(position));
      this.label.position.multiplyScalar(1 / positions.length);
      const head = new T.Vector3();
      this.el.camera.getWorldPosition(head);
      const width = T.MathUtils.clamp(this.meshes[0].getWorldPosition(new T.Vector3()).distanceTo(head) * 0.18, 0.10, 0.5);
      const height = width / 4;
      const centerWorld = this.el.object3D.localToWorld(this.label.position.clone());
      const direction = head.clone().sub(centerWorld);
      const offset = Math.min(direction.length() * 0.3, width * 0.7);
      centerWorld.addScaledVector(direction.normalize(), offset);
      this.label.position.copy(this.el.object3D.worldToLocal(centerWorld));
      this.label.scale.set(height * this.labelWidth / 128, height, 1);
      this.line.visible = this.label.visible = visible;
      this.guide.visible = this.planes.visible = false;
      if (this.measurementMode === "angle") {
        const [a, b, c] = positions;
        const u = a.clone().sub(b);
        const v = c.clone().sub(b);
        const normal = u.clone().cross(v);
        if (normal.lengthSq() > 1e-16) {
          const radius = Math.min(u.length(), v.length()) * 0.3;
          const sweep = u.angleTo(v);
          u.normalize(); normal.normalize();
          const attr = this.guideGeometry.attributes.position;
          for (let i = 0; i <= 32; i++) {
            const p = u.clone().applyAxisAngle(normal, sweep * i / 32).multiplyScalar(radius).add(b);
            attr.setXYZ(i, p.x, p.y, p.z);
          }
          attr.needsUpdate = true;
          this.guideGeometry.computeBoundingSphere();
          this.guide.visible = visible;
        }
      } else if (this.measurementMode === "torsion") {
        const attr = this.planeGeometry.attributes.position;
        [positions[0], positions[1], positions[2], positions[1], positions[2], positions[3]]
          .forEach((p, i) => attr.setXYZ(i, p.x, p.y, p.z));
        attr.needsUpdate = true;
        this.planeGeometry.computeBoundingSphere();
        this.planes.visible = visible;
      }
    },
    disposeDisplay: function () {
      this.halos.concat(this.rods).forEach(object => this.el.object3D.remove(object));
      this.haloGeometry.dispose();
      this.haloMaterial.dispose();
      this.rodGeometry.dispose();
      this.rodMaterial.dispose();
      this.el.object3D.remove(this.line, this.label);
      this.geometry.dispose();
      this.material.dispose();
      this.texture.dispose();
      this.labelMaterial.dispose();
      this.el.object3D.remove(this.guide, this.planes);
      this.guideGeometry.dispose();
      this.guideMaterial.dispose();
      this.planeGeometry.dispose();
      this.planeMaterial.dispose();
    },
    remove: function () {
      this.updateShared(new Map());
      this.reset();
      this.disposeDisplay();
    }
  });
})(window.FKCVR);