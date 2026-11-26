"use strict";

(function (F) {
  /*
   * RÖNTGEN-2
   *
   * Nur Vorlesung 5:
   * - durchgehbare Apparatur auf flacher Bodenmarkierung;
   * - Informationen erst per Trigger oder Mausklick öffnen;
   * - keine zweite Kamera oder Controllersteuerung;
   * - Apparatur nicht greifbar oder bemalbar;
   * - bestehende Menü- und Zeichenaktionen bleiben erhalten.
   *
   * Fachliche Grenzen:
   * Primitives kubisches Modellgitter, geometrische Reflexauswahl,
   * keine Strukturfaktoren/Intensitäten/Auslöschungen.
   * Ewald-Schalentoleranz und Teilchenbewegung sind illustrativ.
   * Abstände, Größen und Zeiten sind nicht maßstabsgetreu.
   */

  if (!F || !F.RoomBuilder || !F.Menu || !F.findHit) {
    console.error(
      "Röntgen-2: room-builder.js und vr-tools.js vorher laden."
    );
    return;
  }

  const T = AFRAME.THREE;
  const V = T.Vector3;
  const vec = (x, y, z) => new V(x, y, z);

  function wrapText(ctx, value, maxWidth) {
    const lines = [];

    String(value || "").split("\n").forEach(paragraph => {
      let current = "";

      paragraph.split(/\s+/).filter(Boolean).forEach(word => {
        const candidate = current ? current + " " + word : word;

        if (current && ctx.measureText(candidate).width > maxWidth) {
          lines.push(current);
          current = word;
        } else {
          current = candidate;
        }
      });

      lines.push(current);
    });

    return lines;
  }

  function visibleInTree(object) {
    for (let current = object; current; current = current.parent) {
      if (!current.visible) return false;
    }
    return true;
  }

  function getDemo() {
    const el = document.getElementById("fkc-xray-experiment");

    return el && el.isConnected && el.components
      ? el.components["fkc-xray-demo"]
      : null;
  }

  const closeInfo = Symbol("close-xray-info");
  // Der Detektor steht senkrecht zur Blickrichtung vom Kristall zum
  // Detektorzentrum, nicht unbedingt zum einfallenden Strahl (+z).
  function projectDirection(x, y, z, sin, cos, radius) {
    const denominator = x * sin + z * cos;
    if (denominator <= 0) return null;
    const distance = radius / denominator;
    return [(x * cos - z * sin) * distance, y * distance];
  }

  function angleGuides(beta, radius, width, height, labels = []) {
    const sin = Math.sin(beta), cos = Math.cos(beta), segments = [];
    labels.length = 0;
    for (let degrees = 5; degrees <= 85; degrees += 5) {
      const twoTheta = degrees * Math.PI / 180;
      const radial = Math.sin(twoTheta), axial = Math.cos(twoTheta);
      let previous = null, anchor = null, best = Infinity;
      for (let i = 0; i <= 360; i++) {
        const azimuth = i * Math.PI / 180;
        const p = projectDirection(radial * Math.cos(azimuth), radial * Math.sin(azimuth), axial, sin, cos, radius);
        const inside = p && Math.abs(p[0]) < width / 2 && Math.abs(p[1]) < height / 2;
        if (inside && previous) {
          segments.push(...previous, -0.018, ...p, -0.018);
          // Einmal pro Bogen, möglichst am oberen Bildrand; Rand und Nachbarlabels freihalten.
          const [x, y] = p;
          const score = Math.abs(y - (height / 2 - 0.29));
          if (Math.abs(x) < width / 2 - 0.19 && y < height / 2 - 0.19 && y > -height / 2 + 0.05 &&
              score < best && labels.every(label => Math.abs(label.x - x) >= 0.36 || Math.abs(label.y - y) >= 0.20)) {
            best = score;
            anchor = {degrees, x, y};
          }
        }
        previous = inside ? p : null;
      }
      if (anchor) labels.push(anchor);
    }
    return segments;
  }

  // Leicht geneigte Rotationsachse: eine reine y-Rotation konserviert g_y
  // und erzeugt im Lehrmodell auffällig gerade Reflexreihen.
  const scanAxis = [0.27, 1, 0.19];
  const detectorAngles = [20, 35, 50, 65, 0];
  const scanModes = {step: "Schrittaufnahme", detector: "Nur Detektor", crystal: "Nur Kristall"};
  const exposureTime = 4, frameTime = 5;
  // Reproduzierbare Beispielstellungen; im Kristallscan ist auch ein leerer Frame möglich.
  const crystalAngles = {step: [-18.6, 17.3, 17.1, -15.5, -10], crystal: [3, 5, 10, 59, -18.6]};
  const reflectionTolerance = 0.006; // Å⁻¹, endliche Ewald-Schale des Lehrmodells.
  const distances = [40, 60, 100], exposures = [0.2, 1, 5];
  const referenceRadius = 4.7;
  const beamstop = Object.freeze({center: 2.45, radius: 0.18, length: 0.26});
  const stopEntrance = beamstop.center - beamstop.length / 2;
  function blockedByBeamstop(direction) {
    return direction.z > 0 && Math.hypot(direction.x, direction.y) * stopEntrance <= beamstop.radius * direction.z;
  }
  const settingsLabel = value => String(value).replace(".", ",");
  function spotStyle(distance, exposure) {
    const relativeDistance = distance / 60;
    // Schematically combine a local detector blur with angular divergence.
    // The opacity describes peak brightness, not integrated Bragg intensity.
    return {radius: Math.hypot(0.21, 0.12 * relativeDistance),
      opacity: 1 - Math.exp(-0.9 * exposure / relativeDistance ** 2)};
  }
  function scanFrame(mode, time) {
    const block = Math.floor(time / frameTime), slot = block % detectorAngles.length;
    const next = (slot + 1) % detectorAngles.length;
    const progress = Math.max(0, (time % frameTime - exposureTime) / (frameTime - exposureTime));
    const mix = (a, b) => a + (b - a) * progress ** 2 * (3 - 2 * progress);
    const crystal = crystalAngles[mode];
    const detector = mode === "crystal" ? 20 : mix(detectorAngles[slot], detectorAngles[next]);
    const omega = (mode === "detector" ? 3 : mix(crystal[slot], crystal[next])) * Math.PI / 180;
    return {block, slot, moving: progress > 0, omega, detector};
  }
  F.XrayDemo = {
    projectDirection, angleGuides, scanFrame, scanModes, reflectionTolerance, distances, exposures, spotStyle,
    beamstop, stopEntrance, blockedByBeamstop,
    activate(hit) {
      const demo = hit.xrayDemo;
      if (!demo || !hit.xrayInfo) return false;
      if (!demo.removed && demo.shown && !F.Tutorial?.active && !F.Menu?.opened && !F.HandMenu?.opened) {
        if (hit.mesh?.userData?.reflectionPoint) demo.toggleReflection(hit.mesh.userData.reflectionPoint);
        else if (hit.xrayInfo === closeInfo || hit.xrayInfo === demo.selectedInfo) demo.clearInformation();
        else demo.selectInformation(hit.xrayInfo);
      }
      return true;
    }
  };

  /*
   * Ergänzung der vorhandenen Trefferprüfung.
   *
   * Ein Infotreffer wird als reine Bedienfläche zurückgegeben:
   * - kein Zeichnen;
   * - kein Modellreset;
   * - kein Raumwechsel, da kein dataset.roomId vorhanden ist.
   *
   * Menütreffer und näher liegende vorhandene Raumobjekte
   * behalten Vorrang. Außerhalb von Vorlesung 5 wird direkt
   * die bisherige Trefferprüfung verwendet.
   */
  const previousFindHit = F.findHit;

  F.findHit = function (raycaster, includeSurfaces) {
    const original = previousFindHit.call(
      this, raycaster, includeSurfaces
    );

    if (F.Menu?.opened || F.HandMenu?.opened || F.Tutorial?.active) return original;

    const demo = getDemo();

    if (
      !demo ||
      demo.removed ||
      !demo.shown ||
      !demo.infoMeshes
    ) return original;

    const infoHit = demo.findInformationHit(raycaster);
    if (!infoHit) return original;

    const closing = infoHit.object === demo.infoPanel;
    if (original && !closing) {
      const originalDistance =
        raycaster.ray.origin.distanceTo(original.point);

      if (originalDistance <= infoHit.distance) return original;
    }

    const normal = infoHit.face
      ? infoHit.face.normal.clone().applyMatrix3(
          new T.Matrix3().getNormalMatrix(infoHit.object.matrixWorld)
        ).normalize()
      : raycaster.ray.direction.clone().negate();

    if (normal.dot(raycaster.ray.direction) > 0) normal.negate();

    return {
      type: "action",
      el: demo.el,
      mesh: infoHit.object,
      point: infoHit.point.clone(),
      normal,
      uv: infoHit.uv ? infoHit.uv.clone() : null,
      xrayInfo: closing ? closeInfo : infoHit.object.userData?.reflectionPoint || demo.infoLookup.get(infoHit.object),
      xrayDemo: demo
    };
  };

  AFRAME.registerComponent("fkc-xray-demo", {
    schema: {
      wavelength: {default: 0.7107},
      lattice: {default: 5},
      speed: {default: 1}
    },

    init: function () {
      this.time = 0;
      this.paused = true;
      this.shown = true;
      this.explanations = true;
      this.removed = false;
      this.scanMode = "step";
      this.detectorDistance = 60;
      this.exposure = 1;
      this.lastFrame = -1;
      this.lastMoving = null;
      this.reflectionOmega = null;

      this.spots = [];
      this.frameHits = new Set();
      this.streams = [];
      this.reflections = [];

      this.geometries = new Set();
      this.materials = new Set();
      this.textures = new Set();
      this.materialCache = new Map();

      this.infoEntries = [];
      this.infoMeshes = [];
      this.infoLookup = new Map();
      this.selectedInfo = null;

      this.model = new T.Group();
      this.el.setObject3D("xray-demo", this.model);

      this.rotationQ = new T.Quaternion();
      this.cameraQ = new T.Quaternion();
      this.parentQ = new T.Quaternion();

      this.normal = new V();
      this.horizontal = new V();
      this.gTemp = new V();
      this.outTemp = new V();
      this.endTemp = new V();

      this.cameraPosition = new V();
      this.forward = new V();
      this.panelPosition = new V();
      this.localPosition = new V();

      this.bounds = new T.Box3();
      this.partBounds = new T.Box3();
      this.axisY = vec(0, 1, 0);
      this.scanAxis = vec(...scanAxis).normalize();
      this.dummy = new T.Object3D();

      this.colors = {
        electron: 0x56d9ff,
        brems: 0xff9948,
        other: 0xdc7aff,
        ka: 0x73ffa3,
        diffraction: 0x76baff
      };

      this.particleGeometry = this.trackGeometry(
        new T.SphereGeometry(0.045, 8, 6)
      );

      this.buildTube();
      this.buildBeamPath();
      this.buildScattering();
      this.buildReciprocalGrid();
      this.buildInformation();
      this.buildInfoPanel();
      this.angleGrid = true;
      this.inspector = F.XrayTeaching.selection(this);
      F.XrayTeaching.spectra(this);
      F.XrayTeaching.frameBoard(this);

      this.updateFrame(true);

      const canvas = this.el.sceneEl.canvas;
      if (canvas) {
        const mouse = new T.Vector2(), raycaster = new T.Raycaster();
        raycaster.far = 30;
        this.moveInfoPointer = event => {
          const scene = this.el.sceneEl;
          if (!scene.camera || scene.is("vr-mode") || scene.is("ar-mode") || event.buttons) return this.clearInfoPointer();
          const rect = canvas.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          mouse.set(2 * (event.clientX - rect.left) / rect.width - 1, 1 - 2 * (event.clientY - rect.top) / rect.height);
          scene.camera.updateWorldMatrix(true, false);
          raycaster.setFromCamera(mouse, scene.camera);
          this.mouseInfo = this.markerFromHit(F.findHit(raycaster, true));
        };
        this.clearInfoPointer = () => { this.mouseInfo = null; };
        this.infoCanvasTarget = canvas;
        canvas.addEventListener("pointermove", this.moveInfoPointer);
        canvas.addEventListener("pointerleave", this.clearInfoPointer);
        this.el.sceneEl.addEventListener("exit-vr", this.clearInfoPointer);
        this.el.sceneEl.addEventListener("enter-vr", this.clearInfoPointer);
      }

      if (F.invalidateHits) F.invalidateHits();
    },

    trackGeometry: function (geometry) {
      this.geometries.add(geometry);
      return geometry;
    },

    trackMaterial: function (material) {
      this.materials.add(material);
      return material;
    },

    material: function (color, extra) {
      return this.trackMaterial(
        new T.MeshStandardMaterial(Object.assign({
          color,
          roughness: 0.45
        }, extra || {}))
      );
    },

    basic: function (color) {
      const key = String(color);

      if (!this.materialCache.has(key)) {
        this.materialCache.set(
          key,
          this.trackMaterial(
            new T.MeshBasicMaterial({
              color,
              toneMapped: false
            })
          )
        );
      }

      return this.materialCache.get(key);
    },

    box: function (size, position, material, parent) {
      const mesh = new T.Mesh(
        this.trackGeometry(new T.BoxGeometry(...size)),
        material
      );

      mesh.position.copy(position);
      (parent || this.model).add(mesh);
      return mesh;
    },

    line: function (a, b, color, parent, opacity) {
      const alpha = opacity === undefined ? 1 : opacity;

      const geometry = this.trackGeometry(
        new T.BufferGeometry().setFromPoints([a, b])
      );

      const material = this.trackMaterial(
        new T.LineBasicMaterial({
          color,
          transparent: alpha < 1,
          opacity: alpha,
          toneMapped: false
        })
      );

      const line = new T.Line(geometry, material);
      (parent || this.model).add(line);
      return line;
    },

    rod: function (a, b, radius, color, parent) {
      const direction = b.clone().sub(a);

      const mesh = new T.Mesh(
        this.trackGeometry(new T.CylinderGeometry(
          radius, radius, direction.length(), 10
        )),
        this.material(color)
      );

      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(
        vec(0, 1, 0), direction.normalize()
      );

      (parent || this.model).add(mesh);
      return mesh;
    },

    /*
     * Info-Markierungen bestehen ausschließlich aus THREE-
     * Geometrie. Sie werden nicht automatisch als Malflächen
     * oder greifbare Modelle registriert.
     */
    makeMarkerTexture: function () {
      if (this.markerTexture) return this.markerTexture;

      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");

      ctx.clearRect(0, 0, 128, 128);
      ctx.fillStyle = "#163347";
      ctx.beginPath();
      ctx.arc(64, 64, 57, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#b9f3ff";
      ctx.lineWidth = 7;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 88px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("i", 64, 69);

      const texture = new T.CanvasTexture(canvas);
      texture.minFilter = T.LinearFilter;
      texture.magFilter = T.LinearFilter;
      texture.generateMipmaps = false;

      this.textures.add(texture);
      this.markerTexture = texture;
      return texture;
    },

    addInfo: function (title, text, position, targets) {
      const entry = {
        title,
        text,
        targets: (targets || []).filter(Boolean),
        marker: new T.Group(),
        markerFace: null
      };

      entry.marker.position.copy(position);

      const core = new T.Mesh(
        this.trackGeometry(new T.SphereGeometry(0.105, 10, 8)),
        this.basic(0x276f8b)
      );

      const face = new T.Mesh(
        this.trackGeometry(new T.PlaneGeometry(0.34, 0.34)),
        this.trackMaterial(new T.MeshBasicMaterial({
          map: this.makeMarkerTexture(),
          transparent: true,
          alphaTest: 0.05,
          side: T.DoubleSide,
          depthWrite: false,
          toneMapped: false
        }))
      );

      face.position.z = 0.12;
      entry.marker.add(core, face);
      entry.markerFace = face;

      this.model.add(entry.marker);
      this.infoEntries.push(entry);

      /*
       * Tatsächliche Bauteilgeometrien und Marker registrieren.
       * Keine großen unsichtbaren Hitboxen über der Apparatur.
       */
      const register = object => {
        object.traverse(child => {
          if (!child.isMesh || this.infoLookup.has(child)) return;

          this.infoMeshes.push(child);
          this.infoLookup.set(child, entry);
        });
      };

      entry.targets.forEach(register);
      register(entry.marker);

      return entry;
    },

    findInformationHit: function (raycaster) {
      if (!visibleInTree(this.model)) return null;

      // Die Infokarte liegt optisch vor der Welt und ist selbst anklickbar.
      if (this.infoPanel?.visible) {
        const cardHit = raycaster.intersectObject(this.infoPanel, false)[0];
        if (cardHit) return cardHit;
      }

      this.el.object3D.updateWorldMatrix(true, true);

      const targets = this.infoMeshes.filter(mesh =>
        visibleInTree(mesh)
      );

      const hits = raycaster.intersectObjects(targets.concat(this.spots), false);

      return hits.find(hit => !hit.object.userData.reflectionPoint ||
        hit.uv && Math.hypot(hit.uv.x - 0.5, hit.uv.y - 0.5) <= 0.48) || null;
    },

    buildInfoPanel: function () {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 512;

      const texture = new T.CanvasTexture(canvas);
      texture.minFilter = T.LinearFilter;
      texture.magFilter = T.LinearFilter;
      texture.generateMipmaps = false;
      this.textures.add(texture);

      const material = this.trackMaterial(
        new T.MeshBasicMaterial({
          map: texture,
          side: T.DoubleSide,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          toneMapped: false
        })
      );

      /*
       * Panel in Weltkoordinaten, nicht mit der Apparatur skaliert.
       * Ein Klick auf die Karte schließt sie; keine Zeichenfläche.
       */
      this.infoPanel = new T.Mesh(
        this.trackGeometry(new T.PlaneGeometry(1.05, 0.525)),
        material
      );

      this.infoPanel.renderOrder = 95;
      this.infoPanel.frustumCulled = false;
      this.infoPanel.visible = false;

      this.el.sceneEl.object3D.add(this.infoPanel);

      this.infoCanvas = canvas;
      this.infoTexture = texture;

      this.highlight = new T.Box3Helper(
        this.bounds, 0xffdf66
      );

      this.trackGeometry(this.highlight.geometry);
      this.trackMaterial(this.highlight.material);

      this.highlight.material.transparent = true;
      this.highlight.material.opacity = 0.85;
      this.highlight.material.toneMapped = false;
      this.highlight.visible = false;

      this.el.sceneEl.object3D.add(this.highlight);
    },

    drawInformation: function (entry) {
      const ctx = this.infoCanvas.getContext("2d");
      const w = this.infoCanvas.width;
      const h = this.infoCanvas.height;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(16,29,48,0.96)";
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "#b9f3ff";
      ctx.lineWidth = 5;
      ctx.strokeRect(4, 4, w - 8, h - 8);

      let titleSize = 49;
      let titleLines;

      do {
        ctx.font = "bold " + titleSize + "px Arial";
        titleLines = wrapText(ctx, entry.title, w - 80);
        if (titleLines.length <= 2) break;
        titleSize -= 2;
      } while (titleSize > 30);

      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#b9f3ff";

      let y = 28;

      titleLines.forEach(line => {
        ctx.fillText(line, 40, y, w - 80);
        y += titleSize * 1.16;
      });

      y += 12;
      ctx.strokeStyle = "#53778d";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(w - 40, y);
      ctx.stroke();

      y += 18;

      let size = 39;
      let lines;

      do {
        ctx.font = size + "px Arial";
        lines = wrapText(ctx, entry.text, w - 80);

        if (lines.length * size * 1.22 <= h - y - 62) break;
        size -= 1;
      } while (size > 24);

      ctx.fillStyle = "#ffffff";

      lines.forEach(line => {
        ctx.fillText(line, 40, y, w - 80);
        y += size * 1.22;
      });

      ctx.fillStyle = "#a9bdd0";
      ctx.font = "24px Arial";
      ctx.fillText(
        "Zum Schließen auf diese Karte klicken",
        40, h - 39, w - 80
      );

      this.infoTexture.needsUpdate = true;
    },

    placeInformation: function () {
      const camera = this.el.sceneEl.camera;
      if (!camera) return;

      camera.getWorldPosition(this.cameraPosition);
      camera.getWorldDirection(this.forward);

      /*
       * Aufrechte Tafel ohne Kopfneigung.
       * Position nur beim Wechsel der Erklärung festlegen:
       * kein permanentes Mitschwingen bei Kopfbewegungen.
       */
      this.forward.y = 0;

      if (this.forward.lengthSq() < 0.0001) {
        this.forward.set(0, 0, -1);
      } else {
        this.forward.normalize();
      }

      this.panelPosition.copy(this.cameraPosition)
        .addScaledVector(this.forward, 1.55);

      this.panelPosition.y = Math.max(
        0.38, this.cameraPosition.y - 0.30
      );

      this.infoPanel.position.copy(this.panelPosition);

      this.infoPanel.quaternion.setFromUnitVectors(
        vec(0, 0, 1), this.forward.clone().negate()
      );

      /*
       * Auch bei einem transformierten scene.object3D korrekte
       * lokale Position und Orientierung verwenden.
       */
      const parent = this.infoPanel.parent;

      if (parent) {
        parent.updateWorldMatrix(true, false);
        parent.worldToLocal(this.infoPanel.position);
        parent.getWorldQuaternion(this.parentQ);

        this.infoPanel.quaternion.premultiply(
          this.parentQ.invert()
        );
      }

      this.infoPanel.updateWorldMatrix(true, false);
    },

    selectInformation: function (entry) {
      this.clearReflection();
      if (entry !== this.selectedInfo) {
        this.clearInformation();

        this.selectedInfo = entry;
        this.drawInformation(entry);
        this.placeInformation();
      }

      entry.marker.scale.setScalar(1.22);
      this.infoPanel.visible = true;
    },

    clearInformation: function () {
      if (this.selectedInfo) {
        this.selectedInfo.marker.scale.setScalar(1);
      }

      this.selectedInfo = null;

      if (this.infoPanel) this.infoPanel.visible = false;
      if (this.highlight) this.highlight.visible = false;
    },

    markerFromHit: function (hit) {
      const entry = hit?.xrayInfo;
      return hit?.xrayDemo === this && entry?.marker?.children.includes(hit.mesh) ? entry : null;
    },

    updateHighlight: function (entry) {
      if (!entry) {
        this.highlight.visible = false;
        return;
      }

      this.bounds.makeEmpty();

      const targets = (entry.highlightTargets || entry.targets).filter(visibleInTree);
      (targets.length ? targets : [entry.marker]).forEach(object => {
        object.updateWorldMatrix(true, true);
        this.partBounds.setFromObject(object);
        this.bounds.union(this.partBounds);
      });

      if (this.bounds.isEmpty()) {
        this.highlight.visible = false;
        return;
      }

      this.bounds.expandByScalar(0.018);
      this.highlight.visible = true;
      this.highlight.updateMatrixWorld(true);
    },

    updateInformation: function () {
      const scene = this.el.sceneEl;
      const camera = scene.camera;

      if (camera) {
        camera.getWorldQuaternion(this.cameraQ);
        this.el.object3D.getWorldQuaternion(this.parentQ);

        this.parentQ.invert().multiply(this.cameraQ);

        this.infoEntries.forEach(entry => {
          entry.marker.quaternion.copy(this.parentQ);
          entry.marker.visible = this.explanations && this.shown;
        });
      }

      if (!this.shown || F.Tutorial?.active) {
        this.clearInformation();
        return;
      }
      const blocked = F.Menu?.opened || F.HandMenu?.opened;
      const visible = !!this.selectedInfo && !blocked;
      this.infoPanel.visible = visible;
      const xr = scene.is?.("vr-mode") || scene.is?.("ar-mode");
      const hand = xr && document.getElementById(F.HandMenu?.laserHand?.() + "Hand");
      const tools = hand?.components?.["fkc-controller"];
      const hover = xr ? tools?.source && this.markerFromHit(tools.hit) : this.mouseInfo;
      const entry = !blocked && ((hover?.marker.visible && hover) || this.selectedInfo);
      if (entry) this.updateHighlight(entry);
      else this.highlight.visible = false;
    },

    setExplanations: function (value) {
      /*
       * Menüschalter steuert jetzt die Info-Markierungen.
       * Bauteile selbst bleiben auch ohne Marker anvisierbar.
       */
      this.explanations = Boolean(value);

      this.infoEntries.forEach(entry => {
        entry.marker.visible = this.explanations && this.shown;
      });

      if (F.invalidateHits) F.invalidateHits();
    },

    setShown: function (value) {
      this.shown = Boolean(value);
      this.model.visible = this.shown;

      if (!this.shown) {
        this.paused = true;
        this.clearInformation();
        this.clearReflection();
      }

      if (F.invalidateHits) F.invalidateHits();
    },

    toggleReflection: function (point) {
      if (this.selectedReflection === point) { this.clearReflection(); return; }
      this.clearInformation();
      this.paused = true;
      this.selectedReflection = point;
      this.reflectionDisplays.forEach(ray => { ray.visible = false; });
      this.reflectionParticles.visible = false;
      this.inspector.show(point);
    },

    clearReflection: function () {
      if (!this.selectedReflection) return;
      this.selectedReflection = null;
      this.inspector.hide();
      this.reflectionParticles.visible = true;
      this.reflectionDisplays.forEach((ray,i) => { ray.visible = i < this.reflectionParticles.count; });
    },

    setAngleGrid: function (visible) {
      this.angleGrid = visible;
      this.detectorGuides.visible = this.detectorLabels.visible = visible && !this.lastMoving;
    },

    restart: function () {
      this.time = 0;
      this.paused = true;
      this.lastFrame = -1;
      this.lastMoving = null;

      this.clearSpots();
      this.clearInformation();
      this.updateFrame(true);
    },

    setScanMode: function (mode) {
      if (!Object.hasOwn(scanModes, mode) || mode === this.scanMode) return;
      this.scanMode = mode;
      this.restart();
    },

    nextFrame: function () {
      if (!this.shown) this.setShown(true);
      this.paused = true;
      this.time = ((Math.floor(this.time / frameTime) + 1) % detectorAngles.length) * frameTime;
      this.updateFrame(true);
    },

    showZeroAngle: function () {
      if (!this.shown) this.setShown(true);
      if (this.scanMode === "crystal") this.scanMode = "detector";
      this.paused = true;
      this.time = detectorAngles.indexOf(0) * frameTime;
      this.updateFrame(true);
    },

    rebuildExposure: function () {
      this.paused = true;
      // Change settings on a still frame; if travelling, return to its last pose.
      if (scanFrame(this.scanMode, this.time).moving) this.time = Math.floor(this.time / frameTime) * frameTime;
      this.updateFrame(true);
    },

    setDetectorDistance: function (distance) {
      if (!distances.includes(distance) || distance === this.detectorDistance) return;
      this.detectorDistance = distance;
      this.detectorRadius = referenceRadius * distance / 60;
      this.rebuildExposure();
    },

    setExposure: function (seconds) {
      if (!exposures.includes(seconds) || seconds === this.exposure) return;
      this.exposure = seconds;
      this.rebuildExposure();
    },

    addStream: function (start, end, color, count, rate) {
      const mesh = new T.InstancedMesh(
        this.particleGeometry, this.basic(color), count
      );

      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      mesh.frustumCulled = false;
      this.model.add(mesh);

      this.streams.push({
        mesh,
        start: start.clone(),
        end: end.clone(),
        count,
        rate
      });
    },

    buildTube: function () {
      const tube = this.box(
        [6.5, 2.5, 2.5],
        vec(-2.5, 0, 0),
        this.material(0x9bc8ed, {
          transparent: true,
          opacity: 0.07,
          depthWrite: false,
          side: T.DoubleSide
        })
      );

      const edges = new T.LineSegments(
        this.trackGeometry(new T.EdgesGeometry(tube.geometry)),
        this.trackMaterial(new T.LineBasicMaterial({
          color: 0x8fb7df,
          transparent: true,
          opacity: 0.4
        }))
      );

      edges.position.copy(tube.position);
      this.model.add(edges);

      /*
       * Röhrenhülle bewusst nicht als flächiges Infoziel:
       * sonst würde sie Kathode und Anode verdecken.
       * Die Röhrenerklärung besitzt einen eigenen Marker.
       */
      const tubeInfo = this.addInfo(
        "Evakuierte Röntgenröhre",
        "Das Vakuum ermöglicht einen weitgehend ungestörten " +
        "Elektronenflug von der Kathode zur Anode.",
        vec(-3.1, 1.52, -0.85),
        []
      );
      tubeInfo.highlightTargets = [tube]; // Hülle markieren, aber nicht als Trefferfläche verwenden.

      const coilPoints = [];

      for (let i = 0; i <= 180; i++) {
        const p = i / 180;
        const angle = p * Math.PI * 16;

        coilPoints.push(vec(
          -5 + 0.7 * p,
          0.18 * Math.cos(angle),
          0.18 * Math.sin(angle)
        ));
      }

      const coil = new T.Mesh(
        this.trackGeometry(new T.TubeGeometry(
          new T.CatmullRomCurve3(coilPoints),
          180, 0.027, 6, false
        )),
        this.material(0xffb34e, {
          emissive: 0xff651c,
          emissiveIntensity: 1.3
        })
      );

      this.model.add(coil);

      const wire1 = this.rod(
        vec(-5, 0.18, 0), vec(-5.6, 0.5, 0),
        0.035, 0x8f9caf
      );

      const wire2 = this.rod(
        vec(-4.3, 0.18, 0), vec(-5.6, -0.5, 0),
        0.035, 0x8f9caf
      );

      this.addInfo(
        "W-Glühkathode (−)",
        "Der heiße Wolframdraht emittiert Elektronen durch " +
        "Glühemission. Die Kathode liegt gegenüber der Anode " +
        "auf negativem elektrischem Potential.",
        vec(-4.75, 0.68, 0.35),
        [coil, wire1, wire2]
      );

      const electronGuide = this.rod(
        vec(-4.1, -0.75, 0), vec(-0.35, -0.75, 0),
        0.015, this.colors.electron
      );

      this.addInfo(
        "Beschleunigte Elektronen",
        "Die Hochspannung beschleunigt die Elektronen zur " +
        "Anode (+). Betriebspunkt: 50 kV, 1 mA (50 W elektrische Röhrenleistung). " +
        "Die Elektronen erreichen bis zu 50 keV; der Strom bestimmt den Elektronenfluss. " +
        "Die türkisfarbenen Kugeln sind schematische Marker.",
        vec(-2.5, 0.45, 0.38),
        [electronGuide]
      );

      const count = 28;

      this.electronMesh = new T.InstancedMesh(
        this.particleGeometry,
        this.basic(this.colors.electron),
        count
      );

      this.electronMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      this.electronMesh.frustumCulled = false;
      this.model.add(this.electronMesh);

      this.electrons = [];

      for (let i = 0; i < count; i++) {
        this.electrons.push({
          phase: i / count,
          y: Math.sin(i * 2.4) * 0.085,
          z: Math.cos(i * 1.7) * 0.085
        });
      }

      this.target = vec(0, 0, 0);

      const anode = this.box(
        [0.16, 1.45, 1.25],
        this.target,
        this.material(0xaab5c5, {metalness: 0.8})
      );

      anode.rotation.y = Math.PI / 4;

      this.impact = new T.Mesh(
        this.trackGeometry(new T.SphereGeometry(0.11, 12, 8)),
        this.basic(0xffefb8)
      );

      this.model.add(this.impact);

      this.addInfo(
        "Mo-Anode (+)",
        "An der Molybdän-Anode werden die Elektronen abgebremst. " +
        "Ihre Energie wird überwiegend in Wärme umgewandelt; " +
        "ein kleiner Anteil wird als Röntgenstrahlung abgegeben.",
        vec(0.45, 1.05, -0.55),
        [anode]
      );

      this.addInfo(
        "Brems- und charakteristische Strahlung",
        "Bremsstrahlung besitzt ein kontinuierliches Spektrum. " +
        "Charakteristische Linien entstehen nach Ionisation " +
        "innere Schalen. Mo-Kα₁ (L₃ → K) hat 17,48 keV, Mo-Kα₂ (L₂ → K) 17,37 keV. " +
        "Die Röhre emittiert beide Linien. Ob beide an der Probe ankommen, bestimmt die Optik.",
        vec(0.72, 0.55, 1.85),
        [this.impact]
      );

      const windowMesh = this.box(
        [0.85, 0.85, 0.045],
        vec(0, 0, 1.27),
        this.material(0x9bdceb, {
          transparent: true,
          opacity: 0.35,
          depthWrite: false
        })
      );

      this.addInfo(
        "Austrittsfenster",
        "Das Fenster lässt Röntgenstrahlung austreten und " +
        "trennt das Vakuum der Röhre von der Umgebung. " +
        "Die Darstellung ist schematisch.",
        vec(-0.7, 0.6, 1.35),
        [windowMesh]
      );
    },

    buildBeamPath: function () {
      const lambdaNm = this.data.wavelength * 0.1;
      const graphiteD = 0.3354;
      const theta = Math.asin(lambdaNm / (2 * graphiteD));

      this.alpha = 2 * theta;
      this.mono = vec(0, 0, 3);

      this.beamDirection = vec(
        Math.sin(this.alpha), 0, Math.cos(this.alpha)
      );

      const graphite = this.box(
        [0.07, 1.2, 1.55],
        this.mono,
        this.material(0x596576)
      );

      graphite.rotation.y = theta;

      this.addInfo(
        "Graphit-Monochromator",
        "Bragg-Beugung an Graphit-(002)-Ebenen wählt in dieser " +
        "Darstellung Mo-Kα aus. Eine übliche Graphitoptik kann beide Linien durchlassen; " +
        "eine auf Kα₁ ausgelegte Optik kann Kα₂ unterdrücken. „α₁/α₂-Splitting“ bei der " +
        "Integration berücksichtigt bei Bedarf beide Wellenlängen – es trennt sie nicht in der Röhre.",
        vec(-0.55, 0.95, 3),
        [graphite]
      );

      const catcher = this.box(
        [0.45, 0.85, 0.22],
        vec(0, 0, 6.3),
        this.material(0x705046)
      );

      this.addInfo(
        "Strahlfänger am Monochromator",
        "Der Strahlfänger absorbiert geradlinig weiterlaufende " +
        "Strahlung, die vom Monochromator nicht in die gezeigte " +
        "Messrichtung ausgewählt wurde.",
        vec(-0.55, 0.6, 6.3),
        [catcher]
      );

      this.addStream(
        this.target, this.mono, this.colors.brems, 14, 0.6
      );
      this.addStream(
        this.target, this.mono, this.colors.other, 14, 0.6
      );
      this.addStream(
        this.target, this.mono, this.colors.ka, 14, 0.6
      );
      this.addStream(
        this.mono, vec(0, 0, 6.15), this.colors.brems, 11, 0.6
      );
      this.addStream(
        this.mono, vec(0, 0, 6.15), this.colors.other, 11, 0.6
      );

      const collimatorCenter = this.mono.clone()
        .addScaledVector(this.beamDirection, 1.65);

      const shape = new T.Shape();
      shape.absarc(0, 0, 0.28, 0, Math.PI * 2, false);

      const hole = new T.Path();
      hole.absarc(0, 0, 0.12, 0, Math.PI * 2, true);
      shape.holes.push(hole);

      const collimator = new T.Mesh(
        this.trackGeometry(new T.ExtrudeGeometry(shape, {
          depth: 0.8,
          bevelEnabled: false,
          curveSegments: 16
        })),
        this.material(0x9baabd, {metalness: 0.7})
      );

      collimator.quaternion.setFromUnitVectors(
        vec(0, 0, 1), this.beamDirection
      );

      collimator.position.copy(collimatorCenter)
        .addScaledVector(this.beamDirection, -0.4);

      this.model.add(collimator);

      this.addInfo(
        "Kollimator",
        "Der Kollimator begrenzt den Strahlquerschnitt und die " +
        "Divergenz. Er fokussiert und verstärkt die Strahlung nicht.",
        collimatorCenter.clone().add(vec(0.55, 0.65, 0)),
        [collimator]
      );

      this.samplePosition = this.mono.clone()
        .addScaledVector(this.beamDirection, 4);

      this.addStream(
        this.mono, this.samplePosition, this.colors.ka, 28, 0.6
      );
      this.addStream(this.mono, this.samplePosition, this.colors.brems, 3, 0.57);
    },

    buildScattering: function () {
      this.scattering = new T.Group();
      this.scattering.position.copy(this.samplePosition);
      this.scattering.rotation.y = this.alpha;
      this.model.add(this.scattering);

      this.crystal = new T.Group();
      this.scattering.add(this.crystal);

      this.box(
        [0.38, 0.38, 0.38],
        vec(0, 0, 0),
        this.material(0x8ce1ff, {
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
          metalness: 0.15
        }),
        this.crystal
      );

      const atomGeometry = this.trackGeometry(
        new T.SphereGeometry(0.026, 8, 6)
      );

      const atoms = new T.InstancedMesh(
        atomGeometry, this.basic(0xd7f5ff), 27
      );

      let index = 0;

      for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
          for (let z = -1; z <= 1; z++) {
            this.dummy.position.set(x * 0.13, y * 0.13, z * 0.13);
            this.dummy.updateMatrix();
            atoms.setMatrixAt(index++, this.dummy.matrix);
          }
        }
      }

      atoms.instanceMatrix.needsUpdate = true;
      this.crystal.add(atoms);

      const sampleSupport = this.rod(
        vec(0, -0.9, 0), vec(0, -0.23, 0),
        0.045, 0xaab7ca, this.scattering
      );

      this.addInfo(
        "Rotierender Einkristall",
        "Die Kristallorientierung bestimmt die Beugungsrichtungen. Im Detektorscan bleibt sie fest. " +
        "Bei Schrittaufnahmen und im Kristallscan ändert sie sich zwischen den Bildern. Reale Drehaufnahmen " +
        "können auch bei festem Detektor über ein kleines Kristall-Winkelintervall belichten.",
        this.samplePosition.clone().add(vec(-0.55, 0.65, 0)),
        [this.crystal, sampleSupport]
      );

      this.line(
        vec(0, 0, 0), vec(0, 0, stopEntrance),
        this.colors.ka, this.scattering, 0.55
      );

      const stop = new T.Mesh(
        this.trackGeometry(new T.CylinderGeometry(
          beamstop.radius, beamstop.radius, beamstop.length, 16
        )),
        this.material(0x303845)
      );

      stop.rotation.x = Math.PI / 2;
      stop.position.set(0, 0, beamstop.center);
      this.scattering.add(stop);

      const stopSupport = this.rod(
        vec(0, -1.1, beamstop.center), vec(0, -beamstop.radius, beamstop.center),
        0.045, 0x8a98ac, this.scattering
      );

      const stopWorld = this.samplePosition.clone()
        .addScaledVector(this.beamDirection, beamstop.center);

      this.addInfo(
        "Beamstop",
        "Der Beamstop absorbiert den direkten Primärstrahl " +
        "hinter der Probe. Auch in der 0°-Stellung endet der Primärstrahl vor dem Detektor. " +
        "Der Beamstop schattet außerdem Beugung bei sehr kleinen Winkeln ab.",
        stopWorld.clone().add(vec(-0.55, 0.55, 0)),
        [stop, stopSupport]
      );

      this.addStream(
        this.samplePosition, this.samplePosition.clone().addScaledVector(this.beamDirection, stopEntrance),
        this.colors.ka, 20, 0.6
      );

      this.detectorRadius = referenceRadius;
      this.detectorWidth = 2.8;
      this.detectorHeight = 2.3;

      this.detector = new T.Group();
      this.scattering.add(this.detector);

      const housing = this.box(
        [2.98, 2.48, 0.16],
        vec(0, 0, 0.08),
        this.material(0x536175),
        this.detector
      );

      const face = new T.Mesh(
        this.trackGeometry(new T.PlaneGeometry(2.8, 2.3)),
        this.trackMaterial(new T.MeshBasicMaterial({
          color: 0x07111c,
          side: T.DoubleSide
        }))
      );

      face.position.z = -0.012;
      this.detector.add(face);

      this.detectorGuides = new T.LineSegments(
        this.trackGeometry(new T.BufferGeometry()),
        this.trackMaterial(new T.LineBasicMaterial({color: 0x4f7490, transparent: true, opacity: 0.48, depthWrite: false}))
      );
      this.detector.add(this.detectorGuides);

      const labels = document.createElement("canvas");
      labels.width = 1024; labels.height = 1024;
      const texture = new T.CanvasTexture(labels);
      texture.minFilter = T.LinearFilter;
      texture.generateMipmaps = false;
      this.textures.add(texture);
      this.detectorLabelCanvas = labels;
      this.detectorLabelTexture = texture;
      this.detectorLabels = new T.Mesh(
        this.trackGeometry(new T.PlaneGeometry(this.detectorWidth, this.detectorHeight)),
        this.trackMaterial(new T.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, toneMapped: false}))
      );
      // Die beschriftete Detektorvorderseite schaut zum Kristall (lokal −z).
      this.detectorLabels.rotation.y = Math.PI;
      this.detectorLabels.position.z = -0.023;
      this.detectorLabels.renderOrder = 1;
      this.detectorLabels.raycast = () => {};
      this.detector.add(this.detectorLabels);

      this.detectorInfo = this.addInfo(
        "Beweglicher Flächendetektor",
        "Reflex anklicken: Strahl, Netzebenen und Winkel verfolgen. Erneut klicken zum Abwählen. " +
        "Größerer Abstand: Reflexe liegen weiter auseinander, aber die Fläche erfasst einen kleineren Winkelbereich. " +
        "Helligkeit und Fleckgröße sind schematisch. Belichtungszeit ändert hier nur das Signal, nicht die Abspielzeit. " +
        "Die Gradangaben bezeichnen den jeweiligen Streuwinkel 2θ. Die Bögen verbinden Orte gleichen 2θ " +
        "(Schritte von 5°); sie sind keine Pulverringe. " +
        "Bei einem geneigten Detektor sind diese Bögen keine exakten Kreise.",
        vec(0, 0, 0),
        [housing, face]
      );

      const diffractionInfo = this.addInfo(
        "Gebeugte Strahlung",
        "Die gebeugte Strahlung läuft in diskreten, von der " +
        "Kristallorientierung abhängigen Richtungen. Nur ein " +
        "Teil trifft die aktuelle Detektorfläche. Die blauen " +
        "Strahlen sind symbolisch sichtbar gemacht.",
        this.samplePosition.clone().add(vec(1.4, 0.8, 1.5)),
        []
      );

      const arcPoints = [];

      for (let i = 0; i <= 65; i++) {
        const angle = T.MathUtils.degToRad(i);

        arcPoints.push(vec(
          4.7 * Math.sin(angle),
          -1.35,
          4.7 * Math.cos(angle)
        ));
      }

      this.scattering.add(new T.Line(
        this.trackGeometry(
          new T.BufferGeometry().setFromPoints(arcPoints)
        ),
        this.trackMaterial(new T.LineBasicMaterial({
          color: 0x5d7593,
          transparent: true,
          opacity: 0.5
        }))
      ));

      this.reflectionDisplays = [];

      for (let i = 0; i < 24; i++) {
        const ray = this.line(
          vec(0, 0, 0), vec(0, 0, 1),
          this.colors.diffraction, this.scattering, 0.7
        );

        ray.frustumCulled = false;
        ray.visible = false;
        this.reflectionDisplays.push(ray);
      }
      diffractionInfo.highlightTargets = this.reflectionDisplays;

      this.reflectionParticles = new T.InstancedMesh(
        this.particleGeometry,
        this.basic(this.colors.diffraction),
        24
      );

      this.reflectionParticles.instanceMatrix.setUsage(
        T.DynamicDrawUsage
      );

      this.reflectionParticles.frustumCulled = false;
      this.reflectionParticles.count = 0;
      this.scattering.add(this.reflectionParticles);

      const spotCanvas = document.createElement("canvas");
      spotCanvas.width = spotCanvas.height = 64;
      const ctx = spotCanvas.getContext("2d");
      const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      glow.addColorStop(0, "rgba(255,255,255,1)");
      glow.addColorStop(0.48, "rgba(255,255,255,0.82)");
      glow.addColorStop(0.82, "rgba(255,255,255,0.08)");
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 64, 64);
      const spotTexture = new T.CanvasTexture(spotCanvas);
      this.textures.add(spotTexture);
      this.spotGeometry = this.trackGeometry(new T.PlaneGeometry(2, 2));

      this.spotMaterial = this.trackMaterial(
        new T.MeshBasicMaterial({
          color: 0xd9efff,
          map: spotTexture,
          side: T.DoubleSide,
          transparent: true,
          depthWrite: false,
          blending: T.AdditiveBlending,
          toneMapped: false
        })
      );
    },

    buildReciprocalGrid: function () {
      this.reciprocalPoints = [];

      for (let h = -6; h <= 6; h++) {
        for (let k = -6; k <= 6; k++) {
          for (let l = -6; l <= 6; l++) {
            if (h === 0 && k === 0 && l === 0) continue;

            this.reciprocalPoints.push({
              key: h + "," + k + "," + l,
              g: vec(
                h / this.data.lattice,
                k / this.data.lattice,
                l / this.data.lattice
              ),
              direction: new V(),
              distance: 5,
              hit: false,
              visibility: 0,
              x: 0,
              y: 0
            });
          }
        }
      }
    },

    buildInformation: function () {
      /*
       * Allgemeine Informationen sind ebenfalls nur auf
       * Anforderung sichtbar. Ihre Marker liegen oberhalb
       * der Bodenfläche.
       */
      this.addInfo(
        "Röntgenröhre → Einkristallbeugung",
        "Start/Pause und Tempo: im Handmenü „Röntgendemo“ öffnen. " +
        "Für eine Erklärung ein Bauteil oder i mit Trigger oder Maus anklicken. " +
        "Die Apparatur ist durchgehbar, " +
        "aber nicht greifbar oder bemalbar.",
        vec(-4, -0.25, 4.8),
        []
      );

      this.addInfo(
        "Modellvereinfachungen",
        "Abstände, Größen und Zeiten sind nicht maßstabsgetreu. " +
        "Röntgenstrahlung ist unsichtbar; die Farben sind " +
        "symbolisch. Bewegte Kugeln dienen nur als schematische " +
        "Teilchenmarker.",
        vec(-3.6, -0.25, 6.1),
        []
      );

      this.addInfo(
        "Geometrisches Beugungsmodell",
        "Mo-Kα₁: λ ≈ 0,7093 Å; Mo-Kα₂: λ ≈ 0,7136 Å. " +
        "Das kubische Lehrmodell rechnet vereinfacht mit einer effektiven Wellenlänge von 0,7107 Å. " +
        "Berechnet werden geometrische Reflexpositionen, keine " +
        "Strukturfaktoren oder Intensitäten. Die Ewald-" +
        "Schalentoleranz dient nur der Veranschaulichung.",
        vec(-3.2, -0.25, 7.4),
        []
      );

      this.addInfo(
        "Farblegende",
        "Türkis: Elektronen. Orange: Bremsstrahlung. " +
        "Violett: andere charakteristische Linien. " +
        "Grün: Mo-Kα₁ und Mo-Kα₂ gemeinsam dargestellt. Blau: gebeugte Strahlung. " +
        "Die Farben stellen keine sichtbaren Strahlungsfarben dar.",
        vec(-2.8, -0.25, 8.7),
        []
      );
    },

    clearSpots: function () {
      this.clearReflection();
      this.spots.forEach(spot => {
        if (spot.parent) spot.parent.remove(spot);
      });

      this.spots.length = 0;
      this.frameHits.clear();
    },

    drawDetectorLabels: function (labels) {
      const canvas = this.detectorLabelCanvas;
      const ctx = canvas.getContext("2d");
      const sx = canvas.width / this.detectorWidth, sy = canvas.height / this.detectorHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = "bold 38px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const {degrees, x, y} of labels) {
        const value = `${degrees}°`;
        const px = canvas.width / 2 - x * sx, py = canvas.height / 2 - y * sy;
        const width = ctx.measureText(value).width + 22;
        ctx.fillStyle = "#427298";
        ctx.fillRect(px - 2, py - 15, 4, 17);
        ctx.fillStyle = "#102738";
        ctx.fillRect(px - width / 2, py - 68, width, 56);
        ctx.fillStyle = "#deefff";
        ctx.fillText(value, px, py - 39);
      }
      this.detectorLabelTexture.needsUpdate = true;
    },

    calculateReflections: function (omega) {
      const waveNumber = 1 / this.data.wavelength;

      this.rotationQ.setFromAxisAngle(this.scanAxis, omega);
      this.reflections.length = 0;

      for (const point of this.reciprocalPoints) {
        this.gTemp.copy(point.g).applyQuaternion(this.rotationQ);
        this.outTemp.copy(this.gTemp);
        this.outTemp.z += waveNumber;

        const mismatch = Math.abs(
          this.outTemp.length() - waveNumber
        );

        if (mismatch > reflectionTolerance) continue;

        point.direction.copy(this.outTemp).normalize();

        point.visibility = 1 - mismatch / reflectionTolerance;
        this.reflections.push(point);
      }
      this.reflections.sort((a, b) => b.visibility - a.visibility);
    },

    projectReflections: function (moving) {
      const style = spotStyle(this.detectorDistance, this.exposure);
      this.spotMaterial.opacity = style.opacity;
      for (const point of this.reflections) {
        if (point.direction.z < 0.15) continue;

        point.hit = false;
        point.distance = 5;
        point.x = 0;
        point.y = 0;

        if (blockedByBeamstop(point.direction)) {
          point.distance = stopEntrance / point.direction.z;
          continue;
        }

        const denominator = point.direction.dot(this.normal);

        if (denominator > 0) {
          const distance = this.detectorRadius / denominator;

          this.endTemp.copy(point.direction).multiplyScalar(distance);

          point.x = this.endTemp.dot(this.horizontal);
          point.y = this.endTemp.y;

          point.hit =
            Math.abs(point.x) < this.detectorWidth / 2 &&
            Math.abs(point.y) < this.detectorHeight / 2;

          if (point.hit) point.distance = distance;
        }


        if (
          point.hit &&
          !moving &&
          !this.frameHits.has(point.key)
        ) {
          const spot = new T.Mesh(
            this.spotGeometry, this.spotMaterial
          );

          spot.position.set(point.x, point.y, -0.028);
          spot.userData.reflectionPoint = point;
          spot.scale.setScalar(style.radius);
          spot.renderOrder = 1;
          this.detector.add(spot);
          this.spots.push(spot);
          this.frameHits.add(point.key);
        }
      }

      const count = Math.min(
        this.reflections.length,
        this.reflectionDisplays.length
      );

      this.reflectionParticles.count = count;

      this.reflectionDisplays.forEach((ray, index) => {
        const reflection = index < count
          ? this.reflections[index]
          : null;

        ray.visible = Boolean(reflection);
        if (!reflection) return;

        this.endTemp.copy(reflection.direction)
          .multiplyScalar(reflection.distance);

        const positions = ray.geometry.attributes.position;

        positions.setXYZ(0, 0, 0, 0);
        positions.setXYZ(
          1, this.endTemp.x, this.endTemp.y, this.endTemp.z
        );

        positions.needsUpdate = true;

        // Sichtbarkeitsgewichtung, keine Reflexintensität.
        ray.material.opacity =
          0.2 + 0.6 * reflection.visibility;
      });
    },

    updateFrame: function (force) {
      const t = this.time;
      const {omega, detector: degrees, block, moving} = scanFrame(this.scanMode, t);
      const changed = force || block !== this.lastFrame || moving !== this.lastMoving;

      this.crystal.quaternion.setFromAxisAngle(this.scanAxis, omega);

      if (changed) this.clearSpots();
      this.lastFrame = block;
      this.lastMoving = moving;

      const beta = T.MathUtils.degToRad(degrees);
      if (!moving && (degrees !== this.guideAngle || this.detectorRadius !== this.guideRadius)) {
        const geometry = this.detectorGuides.geometry;
        const labels = [];
        // Beim Winkelwechsel darf Three.js den bisherigen GPU-Puffer freigeben.
        geometry.dispose();
        geometry.setAttribute("position", new T.Float32BufferAttribute(
          angleGuides(beta, this.detectorRadius, this.detectorWidth, this.detectorHeight, labels), 3
        ));
        geometry.computeBoundingSphere();
        this.drawDetectorLabels(labels);
        this.guideAngle = degrees;
        this.guideRadius = this.detectorRadius;
      }
      this.detectorGuides.visible = this.detectorLabels.visible = this.angleGrid && !moving;

      this.normal.set(Math.sin(beta), 0, Math.cos(beta));
      this.horizontal.set(Math.cos(beta), 0, -Math.sin(beta));

      this.detector.position.copy(this.normal)
        .multiplyScalar(this.detectorRadius);

      this.detector.rotation.y = beta;

      /*
       * Info-Markierung folgt dem beweglichen Detektor.
       */
      this.localPosition.copy(this.detector.position)
        .applyAxisAngle(this.axisY, this.alpha)
        .add(this.samplePosition);

      this.localPosition.y += 1.55;
      this.detectorInfo.marker.position.copy(this.localPosition);

      if (moving && this.scanMode !== "detector") {
        this.reflectionParticles.count = 0;
        this.reflectionDisplays.forEach(ray => { ray.visible = false; });
      } else {
        if (this.reflectionOmega !== omega) {
          this.calculateReflections(omega);
          this.reflectionOmega = omega;
        }
        if (changed || moving) this.projectReflections(moving);
      }

      for (let i = 0; i < this.electrons.length; i++) {
        const electron = this.electrons[i];
        const p = (t * 0.65 + electron.phase) % 1;
        const s = p * p;

        this.dummy.position.set(
          -4.3 + 4.3 * s,
          electron.y * (1 - s),
          electron.z * (1 - s)
        );

        this.dummy.updateMatrix();
        this.electronMesh.setMatrixAt(i, this.dummy.matrix);
      }

      this.electronMesh.instanceMatrix.needsUpdate = true;

      for (const stream of this.streams) {
        for (let i = 0; i < stream.count; i++) {
          const s = (t * stream.rate + i / stream.count) % 1;

          this.dummy.position.lerpVectors(
            stream.start, stream.end, s
          );

          this.dummy.updateMatrix();
          stream.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        stream.mesh.instanceMatrix.needsUpdate = true;
      }

      this.impact.scale.setScalar(
        1 + 0.12 * Math.sin(t * 17)
      );

      for (let i = 0; i < this.reflectionParticles.count; i++) {
        const reflection = this.reflections[i];
        const flight = (t * 0.8 + i * 0.137) % 1;

        this.dummy.position.copy(reflection.direction)
          .multiplyScalar(reflection.distance * flight);

        this.dummy.updateMatrix();
        this.reflectionParticles.setMatrixAt(i, this.dummy.matrix);
      }

      this.reflectionParticles.instanceMatrix.needsUpdate = true;
    },

    tick: function (time, delta) {
      if (this.removed || !this.model) return;

      if (!this.shown) {
        this.clearInformation();
        return;
      }

      if (!this.paused) {
        this.clearReflection();
        this.time += Math.min(
          Math.max((delta || 0) / 1000, 0), 0.05
        ) * this.data.speed;

        this.updateFrame(false);
      }

      // Informationen funktionieren auch bei pausierter Animation.
      this.updateInformation();
    },

    remove: function () {
      this.removed = true;
      if (this.infoCanvasTarget) {
        this.infoCanvasTarget.removeEventListener("pointermove", this.moveInfoPointer);
        this.infoCanvasTarget.removeEventListener("pointerleave", this.clearInfoPointer);
        this.el.sceneEl.removeEventListener("exit-vr", this.clearInfoPointer);
        this.el.sceneEl.removeEventListener("enter-vr", this.clearInfoPointer);
      }
      this.clearInformation();

      if (this.spots) this.clearSpots();

      if (this.infoPanel) this.infoPanel.removeFromParent();
      if (this.highlight) this.highlight.removeFromParent();

      if (this.geometries) {
        this.geometries.forEach(geometry => geometry.dispose());
      }

      if (this.materials) {
        this.materials.forEach(material => material.dispose());
      }

      if (this.textures) {
        this.textures.forEach(texture => texture.dispose());
      }

      if (this.infoLookup) this.infoLookup.clear();
      if (this.infoMeshes) this.infoMeshes.length = 0;

      this.el.removeObject3D("xray-demo");

      if (F.invalidateHits) F.invalidateHits();
    }
  });

  /*
   * Flache Bodenmarkierung statt erhöhtem Podest.
   * Keine zusätzliche Navigationssperre.
   */
  AFRAME.registerComponent("fkc-xray-platform-cleanup", {
    remove: function () {
      const object = this.el.getObject3D("mesh");
      if (!object) return;

      const geometries = new Set();
      const materials = new Set();

      object.traverse(child => {
        if (child.geometry) geometries.add(child.geometry);

        if (child.material) {
          const list = Array.isArray(child.material)
            ? child.material
            : [child.material];

          list.forEach(material => materials.add(material));
        }
      });

      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());

      this.el.removeObject3D("mesh");
    }
  });

  const previousBuild = F.RoomBuilder.build;

  F.RoomBuilder.build = function (parent, config, rooms) {
    const result = previousBuild.call(
      this, parent, config, rooms
    );

    if (config.id !== "vorlesung-5") return result;

    const platform = F.create("a-entity", {
      id: "fkc-xray-platform"
    }, parent);

    const group = new T.Group();

    const floor = new T.Mesh(
      new T.PlaneGeometry(8, 8),
      new T.MeshStandardMaterial({
        color: "#283b40",
        roughness: 0.8,
        metalness: 0,
        side: T.DoubleSide
      })
    );

    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.012;
    group.add(floor);

    const borderMaterial = new T.MeshStandardMaterial({
      color: "#c5a052",
      roughness: 0.55,
      metalness: 0.2
    });

    const horizontalGeometry = new T.BoxGeometry(
      8, 0.003, 0.035
    );

    const verticalGeometry = new T.BoxGeometry(
      0.035, 0.003, 8
    );

    [-1, 1].forEach(sign => {
      const horizontal = new T.Mesh(
        horizontalGeometry, borderMaterial
      );

      horizontal.position.set(0, 0.015, sign * 3.98);
      group.add(horizontal);

      const vertical = new T.Mesh(
        verticalGeometry, borderMaterial
      );

      vertical.position.set(sign * 3.98, 0.015, 0);
      group.add(vertical);
    });

    platform.setObject3D("mesh", group);
    platform.setAttribute("fkc-xray-platform-cleanup", "");

    const demo = F.create("a-entity", {
      id: "fkc-xray-experiment",
      position: {x: -0.33, y: 1.4, z: -3.025},
      scale: {x: 0.55, y: 0.55, z: 0.55}
    }, parent);

    demo.setAttribute(
      "fkc-xray-demo",
      "wavelength: 0.7107; lattice: 5; speed: 1"
    );

    /*
     * result.isWalkable bleibt unverändert:
     * Raumgrenzen und vorhandene Stationspodeste gelten weiter,
     * aber die zentrale Demonstration ist kein Hindernis.
     */
    if (F.invalidateHits) F.invalidateHits();
    return result;
  };

  /*
   * Menüergänzung:
   * vorhandenes Hauptmenü und Bedienhilfe weiterverwenden.
   */
  function paintButton(menu, entry, index, selected) {
    const ctx = menu.ctx;
    const pressed = index === menu.pressedIndex;
    const offset = pressed ? 5 : 0;

    ctx.fillStyle = "#a9bcae";
    ctx.fillRect(entry.x, entry.y + 5, entry.w, entry.h);

    ctx.fillStyle = pressed ? "#98b0c5" : "#cddff3";
    ctx.fillRect(entry.x, entry.y + offset, entry.w, entry.h);

    ctx.strokeStyle = selected ? "#173527" : "#a9bcae";
    ctx.lineWidth = selected ? 6 : 2;
    ctx.strokeRect(entry.x, entry.y + offset, entry.w, entry.h);

    ctx.fillStyle = "#173527";
    ctx.font = selected ? "bold 30px Arial" : "30px Arial";

    ctx.fillText(
      (selected ? "✓ " : "") + entry.label,
      entry.x + 22,
      entry.y + 46 + offset,
      entry.w - 44
    );
  }

  function notify(menu, text) {
    menu.blockDrawing();
    if (F.setStatus) F.setStatus(text);
    menu.notify(text);
  }

  const previousRender = F.Menu.render;

  F.Menu.render = function () {
    if (this.page !== "xray-demo") {
      previousRender.call(this);

      const helpIndex = this.buttons.findIndex(
        item => item.key === "room-help"
      );

      if (
        this.page === "home" &&
        getDemo() &&
        this.root &&
        helpIndex >= 0
      ) {
        const entry = this.buttons[helpIndex];

        entry.label = "Röntgendemo & Bedienhilfe";
        entry.action = () => this.navigate("xray-demo");

        paintButton(this, entry, helpIndex, false);
        this.texture.needsUpdate = true;
      }

      return;
    }

    if (!this.root) return;

    const ctx = this.ctx;
    const demo = getDemo();
    this.buttons = [];

    ctx.fillStyle = "#f4f7f5";
    ctx.fillRect(0, 0, 1024, 1200);

    ctx.fillStyle = "#263f33";
    ctx.font = "bold 45px Arial";
    ctx.fillText("Röntgenröhre & Beugung", 55, 75, 914);

    ctx.font = "27px Arial";
    ctx.fillText(
      demo
        ? "Vorlesung 5 · durchgehbare Demonstration"
        : "Demonstration in diesem Raum nicht verfügbar",
      55, 125, 914
    );

    let y = 175;

    const text = value => {
      ctx.fillStyle = "#30493b";
      ctx.font = "28px Arial";

      wrapText(ctx, value, 910).forEach(line => {
        ctx.fillText(line, 55, y + 30, 914);
        y += 40;
      });

      y += 12;
    };

    const button = (label, action, selected) => {
      const entry = {
        x: 55, y, w: 914, h: 55, label, action
      };

      const index = this.buttons.length;
      this.buttons.push(entry);
      paintButton(this, entry, index, selected);
      y += 60;
    };

    if (demo) {
      const speedLabel = demo.data.speed === 0.5
        ? "0,5×"
        : demo.data.speed === 2 ? "2×" : "1×";

      text(
        (demo.paused ? "Status: pausiert" : "Status: läuft") +
        " · Geschwindigkeit: " + speedLabel +
        "\nReflex anklicken: (hkl), θ und 2θ anzeigen."
      );

      button(
        demo.paused
          ? "Animation starten / fortsetzen"
          : "Animation pausieren",
        () => {
          const current = getDemo();
          if (!current) return;

          if (!current.shown) current.setShown(true);
          current.paused = !current.paused;

          notify(
            this,
            current.paused ? "Animation pausiert." : "Animation läuft."
          );
        }
      );

      button(
        "Von vorn beginnen – pausiert",
        () => {
          const current = getDemo();
          if (!current) return;

          current.restart();
          notify(this, "Ausgangszustand hergestellt; pausiert.");
        }
      );

      button("Aufnahmemodus: " + scanModes[demo.scanMode] + " – wechseln", () => {
        const current = getDemo();
        if (!current) return;
        const modes = Object.keys(scanModes);
        current.setScanMode(modes[(modes.indexOf(current.scanMode) + 1) % modes.length]);
        notify(this, scanModes[current.scanMode] + " · pausiert");
      });

      button("Nächstes Bild – pausiert", () => {
        const current = getDemo();
        if (!current) return;
        current.nextFrame();
        const frame = scanFrame(current.scanMode, current.time);
        notify(this, `Frame ${frame.slot + 1} von ${detectorAngles.length} · 2θ: ${frame.detector}° · pausiert`);
      });

      button(`Winkelraster: ${demo.angleGrid ? "an" : "aus"}`, () => {
        demo.setAngleGrid(!demo.angleGrid);
        notify(this, demo.angleGrid ? "Winkelraster eingeblendet." : "Winkelraster ausgeblendet.");
      });

      button(`Detektorabstand: ${demo.detectorDistance} mm – wechseln`, () => {
        const current = getDemo();
        if (!current) return;
        current.setDetectorDistance(distances[(distances.indexOf(current.detectorDistance) + 1) % distances.length]);
        notify(this, `${current.detectorDistance} mm · aktuelles Bild pausiert`);
      });

      button(`Belichtungszeit: ${settingsLabel(demo.exposure)} s – wechseln`, () => {
        const current = getDemo();
        if (!current) return;
        current.setExposure(exposures[(exposures.indexOf(current.exposure) + 1) % exposures.length]);
        notify(this, `${settingsLabel(current.exposure)} s · aktuelles Bild pausiert`);
      });

      button(
        "Geschwindigkeit: " + speedLabel + " – wechseln",
        () => {
          const current = getDemo();
          if (!current) return;

          const values = [0.5, 1, 2];
          const index = values.indexOf(current.data.speed);
          const next = values[(index + 1) % values.length];

          current.el.setAttribute("fkc-xray-demo", "speed", next);

          notify(
            this,
            "Geschwindigkeit: " +
            String(next).replace(".", ",") + "×"
          );
        }
      );

      button(
        demo.explanations
          ? "Info-Markierungen ausblenden"
          : "Info-Markierungen anzeigen",
        () => {
          const current = getDemo();
          if (!current) return;

          current.setExplanations(!current.explanations);

          notify(
            this,
            current.explanations
              ? "Info-Markierungen sichtbar."
              : "Marker aus; Bauteile bleiben anvisierbar."
          );
        },
        demo.explanations
      );

      button(
        demo.shown
          ? "Demonstration ausblenden"
          : "Demonstration einblenden",
        () => {
          const current = getDemo();
          if (!current) return;

          current.setShown(!current.shown);

          notify(
            this,
            current.shown
              ? "Demonstration sichtbar; Start separat wählen."
              : "Demonstration ausgeblendet und pausiert."
          );
        }
      );

      button(
        "Allgemeine Bedienhilfe",
        () => this.navigate("help")
      );
    } else {
      text("Bitte Vorlesung 5 betreten.");

      button(
        "Allgemeine Bedienhilfe",
        () => this.navigate("help")
      );
    }

    button(
      "Zurück zum Hauptmenü",
      () => this.navigate("home")
    );

    if (demo) {
      text(
        "Apparatur durchgehbar; nicht greifbar oder bemalbar.\n" +
        "Reflexpositionen schematisch, keine Intensitäten."
      );
    }

    ctx.fillStyle = this.message ? "#dcefe2" : "#edf2ee";
    ctx.fillRect(35, 1078, 954, 53);

    ctx.fillStyle = "#244d35";
    ctx.font = "bold 25px Arial";
    ctx.fillText(
      this.message || "Buttons mit Laser + Trigger auswählen",
      55, 1113, 910
    );

    ctx.fillStyle = "#607668";
    ctx.font = "23px Arial";
    ctx.fillText(
      "B/Y schließt · Laser-Informationen · Version Röntgen-2",
      55, 1160, 914
    );

    this.texture.needsUpdate = true;
  };
})(window.FKCVR);
