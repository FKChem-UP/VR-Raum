"use strict";

(function (F) {
  /*
   * RÖNTGEN-2
   *
   * Nur Vorlesung 5:
   * - durchgehbare Apparatur auf flacher Bodenmarkierung;
   * - Informationen beim Anvisieren mit dem vorhandenen Laser;
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

    if (F.Menu && F.Menu.opened) return original;

    const demo = getDemo();

    if (
      !demo ||
      demo.removed ||
      !demo.shown ||
      !demo.infoMeshes
    ) return original;

    const infoHit = demo.findInformationHit(raycaster);
    if (!infoHit) return original;

    if (original) {
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
      xrayInfo: demo.infoLookup.get(infoHit.object),
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
      this.lastCalculation = -Infinity;
      this.lastFrame = -1;

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
      this.lastInfoTime = -Infinity;

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

      this.updateFrame(true);

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

      this.el.object3D.updateWorldMatrix(true, true);

      const targets = this.infoMeshes.filter(mesh =>
        visibleInTree(mesh)
      );

      const hits = raycaster.intersectObjects(targets, false);

      return hits.length ? hits[0] : null;
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
       * Es ist kein Trefferziel und keine Zeichenfläche.
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
        this.bounds, 0xb9f3ff
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
        "Laser wegnehmen: Erklärung verschwindet",
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

    selectInformation: function (entry, time) {
      this.lastInfoTime = time;

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

    updateHighlight: function () {
      const entry = this.selectedInfo;

      if (!entry || !entry.targets.length) {
        this.highlight.visible = false;
        return;
      }

      this.bounds.makeEmpty();

      entry.targets.forEach(object => {
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

    updateInformation: function (time) {
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

      if (
        !this.shown ||
        !scene.is("vr-mode") ||
        (F.Menu && F.Menu.opened)
      ) {
        this.clearInformation();
        return;
      }

      /*
       * Die vorhandenen Controller berechnen ihre Treffer.
       * Keine zusätzlichen Controller und keine eigene
       * WebXR-Eingabesteuerung.
       *
       * Ein Treffer kann abhängig von der Tickreihenfolge
       * aus dem unmittelbar vorherigen Renderframe stammen.
       */
      const candidates = [];

      scene.querySelectorAll("[fkc-controller]").forEach(hand => {
        const tools = hand.components["fkc-controller"];
        const grabber = hand.components["fkc-grabber"];

        if (
          !tools ||
          !tools.source ||
          (grabber && grabber.grabbed)
        ) return;

        const hit = tools.hit;

        if (
          hit &&
          hit.xrayDemo === this &&
          hit.xrayInfo
        ) {
          candidates.push(hit.xrayInfo);
        }
      });

      /*
       * Wenn beide Hände verschiedene Teile anvisieren,
       * bleibt die bereits angezeigte Erklärung bevorzugt.
       * Ansonsten ist die erste aktive Hand maßgeblich.
       */
      const entry = candidates.includes(this.selectedInfo)
        ? this.selectedInfo
        : candidates[0];

      if (entry) {
        this.selectInformation(entry, time);
        this.updateHighlight();
      } else if (time - this.lastInfoTime > 350) {
        this.clearInformation();
      }
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
      }

      if (F.invalidateHits) F.invalidateHits();
    },

    restart: function () {
      this.time = 0;
      this.paused = true;
      this.lastFrame = -1;
      this.lastCalculation = -Infinity;

      this.clearSpots();
      this.clearInformation();
      this.updateFrame(true);
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
      this.addInfo(
        "Evakuierte Röntgenröhre",
        "Das Vakuum ermöglicht einen weitgehend ungestörten " +
        "Elektronenflug von der Kathode zur Anode.",
        vec(-3.1, 1.52, -0.85),
        []
      );

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
        "Anode (+). Ihr Energiegewinn beträgt näherungsweise eU. " +
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
        "innerer Schalen. Bei Mo-Kα wird eine K-Schalenlücke " +
        "durch einen Übergang aus der L-Schale aufgefüllt.",
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
        "Darstellung Mo-Kα aus. Der Strahl wird um 2θ abgelenkt. " +
        "Ein realer Monochromator bewirkt keine perfekte " +
        "spektrale Reinigung.",
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
        "Die Rotation bringt unterschiedliche Netzebenen " +
        "in Beugungsstellung. Reflexe entstehen bei erfüllter " +
        "Beugungsbedingung. Gezeigt wird ein primitives " +
        "kubisches Modellgitter.",
        this.samplePosition.clone().add(vec(-0.55, 0.65, 0)),
        [this.crystal, sampleSupport]
      );

      this.line(
        vec(0, 0, 0), vec(0, 0, 5.7),
        this.colors.ka, this.scattering, 0.55
      );

      const stop = new T.Mesh(
        this.trackGeometry(new T.CylinderGeometry(
          0.18, 0.18, 0.26, 16
        )),
        this.material(0x303845)
      );

      stop.rotation.x = Math.PI / 2;
      stop.position.set(0, 0, 5.7);
      this.scattering.add(stop);

      const stopSupport = this.rod(
        vec(0, -1.1, 5.7), vec(0, -0.2, 5.7),
        0.045, 0x8a98ac, this.scattering
      );

      const stopWorld = this.samplePosition.clone()
        .addScaledVector(this.beamDirection, 5.7);

      this.addInfo(
        "Beamstop",
        "Der Beamstop absorbiert den direkten Primärstrahl " +
        "hinter der Probe. Dieser direkte Strahl wird hier " +
        "nicht als Beugungsreflex verwendet.",
        stopWorld.clone().add(vec(-0.55, 0.55, 0)),
        [stop, stopSupport]
      );

      this.addStream(
        this.samplePosition, stopWorld, this.colors.ka, 35, 0.6
      );

      this.detectorRadius = 4.7;
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

      for (let i = -6; i <= 6; i++) {
        const x = i * 2.8 / 14;

        this.line(
          vec(x, -1.15, -0.017),
          vec(x, 1.15, -0.017),
          0x294057, this.detector, 0.35
        );
      }

      for (let i = -5; i <= 5; i++) {
        const y = i * 2.3 / 12;

        this.line(
          vec(-1.4, y, -0.017),
          vec(1.4, y, -0.017),
          0x294057, this.detector, 0.35
        );
      }

      this.detectorInfo = this.addInfo(
        "Beweglicher Flächendetektor",
        "Der Detektor sammelt Reflexereignisse während eines " +
        "Rotationsabschnitts. Während seiner Fahrt werden hier " +
        "keine Ereignisse gesammelt. Die Flecken zeigen " +
        "geometrische Treffer, keine berechneten Intensitäten.",
        vec(0, 0, 0),
        [housing, face]
      );

      this.addInfo(
        "Gebeugte Strahlung",
        "Die gebeugte Strahlung läuft in diskreten, von der " +
        "Kristallorientierung abhängigen Richtungen. Nur ein " +
        "Teil trifft die aktuelle Detektorfläche. Die blauen " +
        "Strahlen sind symbolisch sichtbar gemacht.",
        this.samplePosition.clone().add(vec(1.4, 0.8, 1.5)),
        []
      );

      const arcPoints = [];

      for (let i = 0; i <= 70; i++) {
        const angle = T.MathUtils.degToRad(15 + i);

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

      this.spotGeometry = this.trackGeometry(
        new T.CircleGeometry(0.028, 12)
      );

      this.spotMaterial = this.trackMaterial(
        new T.MeshBasicMaterial({
          color: 0xd9efff,
          side: T.DoubleSide,
          transparent: true,
          opacity: 0.85,
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
        "Start/Pause und Geschwindigkeit: B/Y-Menü, dann " +
        "„Röntgendemo & Bedienhilfe“. Bauteile und i-Markierungen " +
        "mit dem Laser anvisieren. Die Apparatur ist durchgehbar, " +
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
        "Mo-Kα: λ = 0,7107 Å; primitives kubisches Modellgitter. " +
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
        "Grün: Mo-Kα. Blau: gebeugte Strahlung. " +
        "Die Farben stellen keine sichtbaren Strahlungsfarben dar.",
        vec(-2.8, -0.25, 8.7),
        []
      );
    },

    clearSpots: function () {
      this.spots.forEach(spot => {
        if (spot.parent) spot.parent.remove(spot);
      });

      this.spots.length = 0;
      this.frameHits.clear();
    },

    calculateReflections: function (omega, moving) {
      const waveNumber = 1 / this.data.wavelength;
      const tolerance = 0.010;

      this.rotationQ.setFromAxisAngle(this.axisY, omega);
      this.reflections.length = 0;

      for (const point of this.reciprocalPoints) {
        this.gTemp.copy(point.g).applyQuaternion(this.rotationQ);
        this.outTemp.copy(this.gTemp);
        this.outTemp.z += waveNumber;

        const mismatch = Math.abs(
          this.outTemp.length() - waveNumber
        );

        if (mismatch > tolerance) continue;

        point.direction.copy(this.outTemp).normalize();

        if (point.direction.z < 0.15) continue;

        point.hit = false;
        point.distance = 5;
        point.x = 0;
        point.y = 0;

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

        point.visibility = 1 - mismatch / tolerance;
        this.reflections.push(point);

        if (
          point.hit &&
          !moving &&
          !this.frameHits.has(point.key)
        ) {
          const spot = new T.Mesh(
            this.spotGeometry, this.spotMaterial
          );

          spot.position.set(point.x, point.y, -0.028);
          this.detector.add(spot);
          this.spots.push(spot);
          this.frameHits.add(point.key);
        }
      }

      this.reflections.sort((a, b) => (
        Number(b.hit) - Number(a.hit) ||
        b.visibility - a.visibility
      ));

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
      const omega = t * 0.20;

      this.crystal.rotation.y = omega;

      const angles = [20, 35, 50, 65];
      const blockDuration = 5;
      const moveDuration = 0.7;

      const block = Math.floor(t / blockDuration);
      const slot = block % angles.length;
      const within = t % blockDuration;
      const moving = within > blockDuration - moveDuration;

      let degrees = angles[slot];

      if (moving) {
        let f = (within - blockDuration + moveDuration) / moveDuration;
        f = f * f * (3 - 2 * f);

        degrees += (
          angles[(slot + 1) % angles.length] - angles[slot]
        ) * f;
      }

      if (block !== this.lastFrame) {
        this.clearSpots();
        this.lastFrame = block;
        force = true;
      }

      if (moving && this.spots.length) this.clearSpots();

      const beta = T.MathUtils.degToRad(degrees);

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

      if (force) this.calculateReflections(omega, moving);

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
        this.time += Math.min(
          Math.max((delta || 0) / 1000, 0), 0.05
        ) * this.data.speed;

        const calculate = time - this.lastCalculation >= 40;

        if (calculate) this.lastCalculation = time;
        this.updateFrame(calculate);
      }

      // Informationen funktionieren auch bei pausierter Animation.
      this.updateInformation(time);
    },

    remove: function () {
      this.removed = true;
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

      if (
        this.page === "home" &&
        getDemo() &&
        this.buttons &&
        this.buttons[3]
      ) {
        const entry = this.buttons[3];

        entry.label = "Röntgendemo & Bedienhilfe";
        entry.action = () => this.navigate("xray-demo");

        paintButton(this, entry, 3, false);
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
        x: 55, y, w: 914, h: 72, label, action
      };

      const index = this.buttons.length;
      this.buttons.push(entry);
      paintButton(this, entry, index, selected);
      y += 86;
    };

    if (demo) {
      const speedLabel = demo.data.speed === 0.5
        ? "0,5×"
        : demo.data.speed === 2 ? "2×" : "1×";

      text(
        (demo.paused ? "Status: pausiert" : "Status: läuft") +
        " · Geschwindigkeit: " + speedLabel +
        "\nBauteil oder i-Markierung mit dem Laser anvisieren."
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
