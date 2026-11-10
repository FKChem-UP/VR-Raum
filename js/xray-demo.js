"use strict";

(function (F) {
  /*
   * ============================================================
   * RÖNTGENDEMONSTRATION — RÖNTGEN-1
   * ============================================================
   *
   * Ergänzung für die hochgeladenen Galerie-2-/Komfort-1-Dateien.
   *
   * - Keine zweite Szene, Kamera oder Controllersteuerung.
   * - Keine Änderung der bisherigen Raumdateien notwendig.
   * - Plattform nur in vorlesung-5.
   * - Bestehendes Menü bekommt eine Demonstrationsseite.
   * - Geometrische Reflexauswahl etwa 25-mal pro Sekunde.
   * - Teilchen verwenden InstancedMesh.
   * - Pause vermeidet erneute Reflexberechnung.
   *
   * Fachliche Grenzen:
   * - Primitives kubisches Modellgitter.
   * - Keine Strukturfaktoren oder Reflexintensitäten.
   * - Illustrative Ewald-Schalentoleranz.
   * - Apparatur und Teilchen nicht maßstabsgetreu.
   */

  const T = AFRAME.THREE;
  const V = T.Vector3;
  const vec = (x, y, z) => new V(x, y, z);

  if (!F || !F.RoomBuilder || !F.Menu) {
    console.error(
      "Röntgen-1: room-builder.js und vr-tools.js müssen vorher geladen sein."
    );
    return;
  }

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
      this.explanations = false;
      this.lastCalculation = -Infinity;
      this.lastFrame = -1;
      this.frameHits = new Set();
      this.spots = [];
      this.labels = [];
      this.streams = [];
      this.reflections = [];
      this.removed = false;

      this.geometries = new Set();
      this.materials = new Set();
      this.textures = new Set();
      this.materialCache = new Map();

      this.model = new T.Group();
      this.el.setObject3D("xray-demo", this.model);

      this.cameraQ = new T.Quaternion();
      this.parentQ = new T.Quaternion();
      this.rotationQ = new T.Quaternion();
      this.cameraPosition = new V();
      this.normal = new V();
      this.horizontal = new V();
      this.gTemp = new V();
      this.outTemp = new V();
      this.endTemp = new V();
      this.labelTemp = new V();
      this.dummy = new T.Object3D();
      this.axisY = vec(0, 1, 0);

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
        vec(0, 1, 0),
        direction.normalize()
      );

      (parent || this.model).add(mesh);
      return mesh;
    },

    /*
     * Beschriftungen als Canvastexturen:
     * Unicode ohne zusätzliche Schriftdateien.
     *
     * Die Beschriftungen sind keine A-Frame-Primitives,
     * keine Modellziele und keine Zeichenflächen.
     */
    label: function (
      shortText, longText, position, color, width, fixed
    ) {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 256;

      const texture = new T.CanvasTexture(canvas);
      texture.minFilter = T.LinearFilter;
      texture.magFilter = T.LinearFilter;
      texture.generateMipmaps = false;
      this.textures.add(texture);

      const material = this.trackMaterial(
        new T.MeshBasicMaterial({
          map: texture,
          side: T.DoubleSide,
          toneMapped: false
        })
      );

      const mesh = new T.Mesh(
        this.trackGeometry(
          new T.PlaneGeometry(width || 3, (width || 3) / 4)
        ),
        material
      );

      mesh.position.copy(position);
      this.model.add(mesh);

      const entry = {
        mesh,
        canvas,
        texture,
        shortText,
        longText: longText || shortText,
        color: color || "#edf4ff",
        fixed: Boolean(fixed)
      };

      this.labels.push(entry);
      this.drawLabel(entry);
      return mesh;
    },

    drawLabel: function (entry) {
      const ctx = entry.canvas.getContext("2d");
      const w = entry.canvas.width;
      const h = entry.canvas.height;

      ctx.fillStyle = "#101d30";
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = entry.color;
      ctx.lineWidth = 5;
      ctx.strokeRect(4, 4, w - 8, h - 8);

      const value = entry.fixed || this.explanations
        ? entry.longText
        : entry.shortText;

      let fontSize = entry.fixed ? 39 : 58;
      let lines;

      do {
        ctx.font = "bold " + fontSize + "px Arial";
        lines = wrapText(ctx, value, w - 60);

        if (
          lines.length * fontSize * 1.15 <= h - 35 &&
          lines.every(line => ctx.measureText(line).width <= w - 60)
        ) break;

        fontSize -= 2;
      } while (fontSize >= 22);

      ctx.fillStyle = entry.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const lineHeight = fontSize * 1.15;
      const firstY = h / 2 - (lines.length - 1) * lineHeight / 2;

      lines.forEach((line, index) => {
        ctx.fillText(
          line, w / 2,
          firstY + index * lineHeight,
          w - 60
        );
      });

      entry.texture.needsUpdate = true;
    },

    setExplanations: function (value) {
      this.explanations = Boolean(value);
      this.labels.forEach(entry => this.drawLabel(entry));
    },

    setShown: function (value) {
      this.shown = Boolean(value);
      this.model.visible = this.shown;

      // Ausblenden pausiert; Einblenden startet nicht automatisch.
      if (!this.shown) this.paused = true;
    },

    restart: function () {
      this.time = 0;
      this.paused = true;
      this.lastFrame = -1;
      this.lastCalculation = -Infinity;
      this.clearSpots();
      this.updateFrame(true);
    },

    /*
     * Ein InstancedMesh pro Teilchenfarbe und Strahlabschnitt.
     */
    addStream: function (start, end, color, count, rate) {
      const mesh = new T.InstancedMesh(
        this.particleGeometry,
        this.basic(color),
        count
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

      this.label(
        "Evakuierte Röntgenröhre",
        "Evakuierte Röntgenröhre\nVakuum ermöglicht weitgehend\nungestörten Elektronenflug",
        vec(-3.2, 2.5, -0.8),
        "#c7e4ff", 3.3
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

      this.model.add(new T.Mesh(
        this.trackGeometry(new T.TubeGeometry(
          new T.CatmullRomCurve3(coilPoints),
          180, 0.027, 6, false
        )),
        this.material(0xffb34e, {
          emissive: 0xff651c,
          emissiveIntensity: 1.3
        })
      ));

      this.rod(
        vec(-5, 0.18, 0), vec(-5.6, 0.5, 0),
        0.035, 0x8f9caf
      );

      this.rod(
        vec(-4.3, 0.18, 0), vec(-5.6, -0.5, 0),
        0.035, 0x8f9caf
      );

      this.label(
        "W-Glühkathode (−)",
        "W-Glühkathode (−)\nHeißer Wolframdraht emittiert\nElektronen: Glühemission",
        vec(-5, 1.25, 0),
        "#ffbc72", 3
      );

      this.label(
        "Beschleunigte Elektronen",
        "Elektronen fliegen zur Anode (+)\nDie Hochspannung beschleunigt sie\nEnergiegewinn: etwa eU",
        vec(-2.5, -1.6, 0),
        "#56d9ff", 3.3
      );

      this.rod(
        vec(-4.1, -0.75, 0), vec(-0.35, -0.75, 0),
        0.015, this.colors.electron
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

      this.label(
        "Mo-Anode (+)",
        "Mo-Anode (+)\nElektronen werden abgebremst\nIhre Energie wird überwiegend zu Wärme",
        vec(0.4, 1.6, -0.7),
        "#e0e9ff", 3.5
      );

      this.label(
        "Brems- und charakteristische Strahlung",
        "Bremsstrahlung: kontinuierliches Spektrum\nCharakteristische Strahlung: Schalenlücke\nwird aufgefüllt; Mo-Kα: L → K",
        vec(1.7, 2.7, 1.4),
        "#ffc38c", 4.2
      );

      this.box(
        [0.85, 0.85, 0.045],
        vec(0, 0, 1.27),
        this.material(0x9bdceb, {
          transparent: true,
          opacity: 0.35,
          depthWrite: false
        })
      );

      this.label(
        "Austrittsfenster",
        "Austrittsfenster\nLässt Röntgenstrahlung austreten\nTrennt Vakuum und Umgebung",
        vec(-1.7, -1.15, 1.6),
        "#b4eaf2", 3.4
      );
    },

    buildBeamPath: function () {
      const lambdaNm = this.data.wavelength * 0.1;
      const graphiteD = 0.3354;
      const theta = Math.asin(lambdaNm / (2 * graphiteD));

      this.alpha = 2 * theta;
      this.mono = vec(0, 0, 3);

      this.beamDirection = vec(
        Math.sin(this.alpha),
        0,
        Math.cos(this.alpha)
      );

      const graphite = this.box(
        [0.07, 1.2, 1.55],
        this.mono,
        this.material(0x596576)
      );

      graphite.rotation.y = theta;

      this.label(
        "Graphit-Monochromator",
        "Graphit-Monochromator, (002)\nBragg-Beugung wählt Mo-Kα aus\nKeine perfekte spektrale Reinigung",
        vec(-1.5, 1.1, 3.4),
        "#e3e9f4", 3.7
      );

      this.box(
        [0.45, 0.85, 0.22],
        vec(0, 0, 6.3),
        this.material(0x705046)
      );

      this.label(
        "Strahlfänger",
        "Strahlfänger am Monochromator\nFängt geradlinig weiterlaufende,\nnicht ausgewählte Strahlung ab",
        vec(-2, -1, 5.8),
        "#ffb585", 3.5
      );

      this.addStream(
        this.target, this.mono,
        this.colors.brems, 14, 0.6
      );

      this.addStream(
        this.target, this.mono,
        this.colors.other, 14, 0.6
      );

      this.addStream(
        this.target, this.mono,
        this.colors.ka, 14, 0.6
      );

      this.addStream(
        this.mono, vec(0, 0, 6.15),
        this.colors.brems, 11, 0.6
      );

      this.addStream(
        this.mono, vec(0, 0, 6.15),
        this.colors.other, 11, 0.6
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
        vec(0, 0, 1),
        this.beamDirection
      );

      collimator.position.copy(collimatorCenter)
        .addScaledVector(this.beamDirection, -0.4);

      this.model.add(collimator);

      this.label(
        "Kollimator",
        "Kollimator\nBegrenzt Querschnitt und Divergenz\nFokussiert und verstärkt nicht",
        collimatorCenter.clone().add(vec(2.1, 1.3, 0)),
        "#dce7ff", 3.5
      );

      this.samplePosition = this.mono.clone()
        .addScaledVector(this.beamDirection, 4);

      this.addStream(
        this.mono,
        this.samplePosition,
        this.colors.ka,
        28, 0.6
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
        atomGeometry,
        this.basic(0xd7f5ff),
        27
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

      this.rod(
        vec(0, -0.9, 0),
        vec(0, -0.23, 0),
        0.045, 0xaab7ca,
        this.scattering
      );

      this.label(
        "Rotierender Einkristall",
        "Rotierender Einkristall\nRotation bringt neue hkl in Beugungsstellung\nReflexe bei erfüllter Beugungsbedingung",
        this.samplePosition.clone().add(vec(-2, 1.5, 0)),
        "#b8eeff", 4
      );

      this.line(
        vec(0, 0, 0),
        vec(0, 0, 5.7),
        this.colors.ka,
        this.scattering,
        0.55
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

      this.rod(
        vec(0, -1.1, 5.7),
        vec(0, -0.2, 5.7),
        0.045, 0x8a98ac,
        this.scattering
      );

      const stopWorld = this.samplePosition.clone()
        .addScaledVector(this.beamDirection, 5.7);

      this.label(
        "Beamstop",
        "Beamstop\nAbsorbiert den direkten Primärstrahl\nDieser wird hier nicht als Reflex genutzt",
        stopWorld.clone().add(vec(-1.7, -1.4, 0)),
        "#d8e2f1", 3.8
      );

      this.addStream(
        this.samplePosition,
        stopWorld,
        this.colors.ka,
        35, 0.6
      );

      this.detectorRadius = 4.7;
      this.detectorWidth = 2.8;
      this.detectorHeight = 2.3;

      this.detector = new T.Group();
      this.scattering.add(this.detector);

      this.box(
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

      this.detectorLabel = this.label(
        "Beweglicher Flächendetektor",
        "Flächendetektor sammelt Reflexereignisse\nwährend eines Rotationsabschnitts\nKeine Messung während der Fahrt",
        vec(0, 0, 0),
        "#b9d8ff", 4
      );

      this.label(
        "Gebeugte Strahlung",
        "Gebeugte Strahlung\nDiskrete, orientierungsabhängige Richtungen\nNur ein Teil trifft den Detektor",
        this.samplePosition.clone().add(vec(3.3, 2.8, 1.7)),
        "#92c7ff", 4.2
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
          vec(0, 0, 0),
          vec(0, 0, 1),
          this.colors.diffraction,
          this.scattering,
          0.7
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
      this.label(
        "Röntgenröhre → Einkristallbeugung",
        "Röntgenröhre → Einkristallbeugung\nRöntgen-1 · Start/Pause im B/Y-Menü\nApparatur zunächst nicht greifbar",
        vec(-2.8, 3.8, 1.8),
        "#edf4ff", 5,
        true
      );

      this.label(
        "Modellvereinfachungen",
        "Nicht maßstabsgetreu: Abstände, Größen, Zeiten\nRöntgenstrahlung ist unsichtbar; Farben symbolisch\nBewegte Kugeln sind schematische Teilchenmarker",
        vec(-3.2, -2.15, 3.1),
        "#bdcbe0", 5,
        true
      );

      this.label(
        "Geometrisches Beugungsmodell",
        "Mo-Kα: λ = 0,7107 Å; primitives kubisches Gitter\nReflexpositionen ohne Strukturfaktoren/Intensitäten\nEwald-Schalentoleranz nur zur Veranschaulichung",
        vec(2.7, -2.15, 8.5),
        "#bdcbe0", 5,
        true
      );

      this.label(
        "Farblegende",
        "Türkis: Elektronen · Orange: Bremsstrahlung\nViolett: andere charakteristische Linien\nGrün: Mo-Kα · Blau: gebeugte Strahlung",
        vec(-3.8, 1.2, 8),
        "#edf4ff", 4.7,
        true
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
      const normal = this.normal;
      const horizontal = this.horizontal;

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

        // Beschränkung auf die gezeigte Vorwärtsgeometrie.
        if (point.direction.z < 0.15) continue;

        point.hit = false;
        point.distance = 5;
        point.x = 0;
        point.y = 0;

        const denominator = point.direction.dot(normal);

        if (denominator > 0) {
          const distance = this.detectorRadius / denominator;

          this.endTemp.copy(point.direction).multiplyScalar(distance);

          point.x = this.endTemp.dot(horizontal);
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
            this.spotGeometry,
            this.spotMaterial
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
        const reflection = this.reflections[index];
        ray.visible = Boolean(reflection);

        if (!reflection) return;

        this.endTemp.copy(reflection.direction)
          .multiplyScalar(reflection.distance);

        const positions = ray.geometry.attributes.position;

        positions.setXYZ(0, 0, 0, 0);
        positions.setXYZ(
          1,
          this.endTemp.x,
          this.endTemp.y,
          this.endTemp.z
        );

        positions.needsUpdate = true;

        // Nur Sichtbarkeitsgewichtung, keine Intensität.
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

      this.labelTemp.copy(this.detector.position)
        .applyAxisAngle(this.axisY, this.alpha)
        .add(this.samplePosition);

      this.labelTemp.y += 2;

      this.detectorLabel.position.copy(this.labelTemp);

      if (force) {
        this.calculateReflections(omega, moving);
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

        this.reflectionParticles.setMatrixAt(
          i, this.dummy.matrix
        );
      }

      this.reflectionParticles.instanceMatrix.needsUpdate = true;
    },

    tick: function (time, delta) {
      if (this.removed || !this.model || !this.shown) return;

      const camera = this.el.sceneEl.camera;

      if (camera) {
        camera.getWorldQuaternion(this.cameraQ);
        this.el.object3D.getWorldQuaternion(this.parentQ);

        this.parentQ.invert().multiply(this.cameraQ);

        this.labels.forEach(entry => {
          entry.mesh.quaternion.copy(this.parentQ);
        });
      }

      if (this.paused) return;

      this.time += Math.min(
        Math.max((delta || 0) / 1000, 0),
        0.05
      ) * this.data.speed;

      // Reale Renderzeit für ungefähr 25 Auswertungen/s.
      const calculate = time - this.lastCalculation >= 40;

      if (calculate) this.lastCalculation = time;

      this.updateFrame(calculate);
    },

    remove: function () {
      this.removed = true;

      if (this.spots) this.clearSpots();

      if (this.geometries) {
        this.geometries.forEach(geometry => geometry.dispose());
      }

      if (this.materials) {
        this.materials.forEach(material => material.dispose());
      }

      if (this.textures) {
        this.textures.forEach(texture => texture.dispose());
      }

      this.el.removeObject3D("xray-demo");

      if (F.invalidateHits) F.invalidateHits();
    }
  });

  /*
   * ============================================================
   * PLATTFORM UND RAUMINTEGRATION
   * ============================================================
   *
   * Dieser Wrapper ruft den bisherigen Builder unverändert auf.
   * Danach wird nur Vorlesung 5 ergänzt.
   */

  const previousBuild = F.RoomBuilder.build;

  F.RoomBuilder.build = function (parent, config, rooms) {
    const result = previousBuild.call(
      this, parent, config, rooms
    );

    if (config.id !== "vorlesung-5") return result;

    const platform = F.create("a-entity", {
      id: "fkc-xray-platform"
    }, parent);

    /*
     * Plattform als THREE-Geometrie:
     * keine automatische Registrierung als Malfläche.
     */
    const baseGeometry = new T.BoxGeometry(8, 0.24, 8);
    const baseMaterial = new T.MeshStandardMaterial({
      color: "#75531e",
      roughness: 0.65,
      metalness: 0.15
    });

    const base = new T.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.12;

    const topGeometry = new T.BoxGeometry(7.94, 0.035, 7.94);
    const topMaterial = new T.MeshStandardMaterial({
      color: "#283b40",
      roughness: 0.7
    });

    const top = new T.Mesh(topGeometry, topMaterial);
    top.position.y = 0.2575;

    const platformGroup = new T.Group();
    platformGroup.add(base, top);
    platform.setObject3D("mesh", platformGroup);

    const demo = F.create("a-entity", {
      id: "fkc-xray-experiment",

      /*
       * Verschiebung zentriert die ursprünglich asymmetrische
       * Apparatur ungefähr auf der Plattform.
       */
      position: {x: -0.33, y: 1.4, z: -3.025},
      scale: {x: 0.55, y: 0.55, z: 0.55}
    }, parent);

    demo.setAttribute(
      "fkc-xray-demo",
      "wavelength: 0.7107; lattice: 5; speed: 1"
    );

    /*
     * A-Frame-Komponente übernimmt die Ressourcenfreigabe
     * der Plattform beim Entfernen des Raumes.
     */
    platform.setAttribute("fkc-xray-platform-cleanup", "");

    // Gleicher Abstandspuffer wie bei den bestehenden Podesten.
    const previousWalkable = result.isWalkable;

    result.isWalkable = function (x, z) {
      if (Math.abs(x) < 4.28 && Math.abs(z) < 4.28) {
        return false;
      }

      return previousWalkable(x, z);
    };

    if (F.invalidateHits) F.invalidateHits();

    return result;
  };

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

  /*
   * ============================================================
   * MENÜERGÄNZUNG
   * ============================================================
   *
   * Das bestehende Hauptmenü hat bereits zehn Buttons.
   * In Vorlesung 5 ersetzt deshalb der vierte Button
   * "Bedienhilfe anzeigen" durch "Röntgendemo & Bedienhilfe".
   *
   * Die Bedienhilfe bleibt auf der neuen Unterseite erreichbar.
   * Alle anderen Menüseiten bleiben unverändert.
   */

  function getDemo() {
    const el = document.getElementById("fkc-xray-experiment");

    return el && el.isConnected
      ? el.components["fkc-xray-demo"]
      : null;
  }

  function paintButton(menu, entry, index, selected) {
    const ctx = menu.ctx;
    const pressed = index === menu.pressedIndex;
    const offset = pressed ? 5 : 0;

    ctx.fillStyle = "#a9bcae";
    ctx.fillRect(entry.x, entry.y + 5, entry.w, entry.h);

    ctx.fillStyle = pressed ? "#98b0c5" : "#cddff3";
    ctx.fillRect(
      entry.x, entry.y + offset, entry.w, entry.h
    );

    ctx.strokeStyle = selected ? "#173527" : "#a9bcae";
    ctx.lineWidth = selected ? 6 : 2;

    ctx.strokeRect(
      entry.x, entry.y + offset, entry.w, entry.h
    );

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
    F.setStatus(text);
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
        ? "Vorlesung 5 · zentrale Demonstration"
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
        x: 55,
        y,
        w: 914,
        h: 72,
        label,
        action
      };

      const index = this.buttons.length;
      this.buttons.push(entry);

      paintButton(this, entry, index, selected);
      y += 86;
    };

    if (demo) {
      const speedLabel = demo.data.speed === 0.5
        ? "0,5×"
        : demo.data.speed === 2
          ? "2×"
          : "1×";

      text(
        (demo.paused ? "Status: pausiert" : "Status: läuft") +
        " · Geschwindigkeit: " + speedLabel +
        "\nBeim Schließen des Menüs läuft die Animation weiter."
      );

      button(
        demo.paused ? "Animation starten / fortsetzen" : "Animation pausieren",
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
            "Geschwindigkeit: " + String(next).replace(".", ",") + "×"
          );
        }
      );

      button(
        demo.explanations
          ? "Ausführliche Erklärungen ausschalten"
          : "Ausführliche Erklärungen einschalten",
        () => {
          const current = getDemo();
          if (!current) return;

          current.setExplanations(!current.explanations);

          notify(
            this,
            current.explanations
              ? "Ausführliche Erklärungen sichtbar."
              : "Kurze Bauteilnamen sichtbar."
          );
        },
        demo.explanations
      );

      button(
        demo.shown ? "Demonstration ausblenden" : "Demonstration einblenden",
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
        "Reflexpositionen schematisch: keine Intensitäten.\n" +
        "Apparatur nicht greifbar oder bemalbar."
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
      "B/Y schließt · Demonstration · Version Röntgen-1",
      55, 1160, 914
    );

    this.texture.needsUpdate = true;
  };
})(window.FKCVR);
