"use strict";

(function (F) {
  /*
   * ============================================================
   * WILLKOMMEN-2
   *
   * NaCl-Elementarzelle -> periodisches Gitter ->
   * Einkristallit -> körnige Salzprobe im Becherglas.
   *
   * Änderungen gegenüber Willkommen-1:
   * - Sattere Ionenfarben.
   * - Dunkler, zur Betrachtungsrichtung ausgerichteter Hintergrund.
   * - Zellrahmen für 3x3x3, 6x6x6 und 9x9x9 Zellen.
   * - Längerer beschleunigter atomarer Zoom.
   * - Deutlicheres Becherglas mit geformtem Ausguss und mL-Skala.
   *
   * Fachliche Grundlage:
   * NaCl: Fm-3m, Nr. 225.
   * Cl: 4a (0,0,0).
   * Na: 4b (1/2,1/2,1/2).
   * Konventionelle kubische Zelle: Z = 4.
   * Beide Ionensorten: sechs nächste Gegenionen.
   *
   * Halbgitterdarstellung:
   * Koordinaten = (i-1,j-1,k-1)/2.
   * Gerade Summe i+j+k: Cl.
   * Ungerade Summe i+j+k: Na.
   *
   * Ausgangszelle: i,j,k = 0 ... 2.
   * Gemeinsame Randionen werden nicht doppelt erzeugt.
   *
   * Spätere Darstellungen sind didaktische Detailstufen.
   * Nicht jede atomare Position eines makroskopischen Kristalls
   * wird berechnet oder gezeichnet.
   *
   * Keine Wachstums- oder maßstabsgetreue optische Simulation.
   * Keine Änderung an Navigation oder Raumbeleuchtung.
   * ============================================================
   */

  if (
    !F ||
    !F.RoomBuilder ||
    !F.Menu ||
    !window.AFRAME
  ) {
    console.error(
      "Willkommen-2: A-Frame, room-builder.js und vr-tools.js " +
      "müssen vorher geladen sein."
    );
    return;
  }

  const T = AFRAME.THREE;
  const V = T.Vector3;

  const END = 42;
  const BOUND = 1.34;

  const COLORS = {
    sodium: "#a345ff",
    chloride: "#18dc56",
    gold: "#f1c45b",
    paper: "#fffdf5",
    ink: "#202a2e",
    backdrop: "#172936"
  };

  const PHASE_TIMES = [0, 6, 11, 16, 20, 26, 34];

  const PHASES = [
    {
      title: "NaCl · eine konventionelle Elementarzelle",
      text: "Fm3̅m · Nr. 225 · Z = 4 · beide Ionen sechsfacht koordiniert"
    },
    {
      title: "Periodische Ordnung · 3 × 3 × 3 Zellen",
      text: "Ein größerer Ausschnitt wird sichtbar — kein Kristallwachstum."
    },
    {
      title: "Periodische Ordnung · 6 × 6 × 6 Zellen",
      text: "Der goldene Rahmen kennzeichnet weiterhin die Ausgangszelle."
    },
    {
      title: "Periodische Ordnung · 9 × 9 × 9 Zellen",
      text: "Die einzelnen Zellen werden beim weiteren Herauszoomen kleiner."
    },
    {
      title: "Vom Ionengitter zum Einkristallit",
      text: "Der Zoom beschleunigt sich; einzelne Ionen werden nicht mehr aufgelöst."
    },
    {
      title: "Viele unterschiedlich orientierte Kristallite",
      text: "Der goldmarkierte Kristallit enthält die ursprüngliche Elementarzelle."
    },
    {
      title: "NaCl · eine körnige Feststoffprobe",
      text: "Weiße Salzprobe im schematischen 500-mL-Becherglas."
    }
  ];

  const DIRECTIONS = [
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [0, 0, -1]
  ];

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function ramp(time, start, end) {
    const x = clamp((time - start) / (end - start), 0, 1);
    return x * x * (3 - 2 * x);
  }

  function lerp(a, b, x) {
    return a + (b - a) * x;
  }

  function key(i, j, k) {
    return i + "," + j + "," + k;
  }

  function wrap(ctx, text, width) {
    const lines = [];
    let line = "";

    String(text).split(/\s+/).forEach(word => {
      const candidate = line ? line + " " + word : word;

      if (line && ctx.measureText(candidate).width > width) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });

    if (line) lines.push(line);
    return lines;
  }

  function currentDemo() {
    const el = document.getElementById("fkc-welcome-experiment");

    return el &&
      el.components &&
      el.components["fkc-welcome-demo"];
  }

  /*
   * Für eine gerade Anzahl von Zellen kann die Ausgangszelle
   * nicht exakt in der Mitte des gesamten Blocks liegen.
   * Sie bleibt an derselben Gitterposition; der zusätzliche
   * Platz liegt bei 6x6x6 überwiegend auf der negativen Seite.
   */
  function cellBounds(n) {
    const first = -Math.floor(n / 2);

    return {
      first,
      min: first - 0.5,
      max: first + n - 0.5,
      minIndex: first * 2,
      maxIndex: (first + n) * 2
    };
  }

  function latticePositions(n) {
    const bounds = cellBounds(n);
    const map = new Map();

    for (let i = bounds.minIndex; i <= bounds.maxIndex; i++) {
      for (let j = bounds.minIndex; j <= bounds.maxIndex; j++) {
        for (let k = bounds.minIndex; k <= bounds.maxIndex; k++) {
          map.set(key(i, j, k), [i, j, k]);
        }
      }
    }

    /*
     * Eine zusätzliche Nachbarschicht:
     * vollständig sechs Gegenionen für alle Positionen
     * innerhalb des gezeigten Zellblocks.
     */
    const interior = Array.from(map.values());

    interior.forEach(([i, j, k]) => {
      DIRECTIONS.forEach(([di, dj, dk]) => {
        const p = [i + di, j + dj, k + dk];
        map.set(key(...p), p);
      });
    });

    return map;
  }

  AFRAME.registerComponent("fkc-welcome-demo", {
    schema: {
      speed: {type: "number", default: 1}
    },

    init: function () {
      this.time = 0;
      this.paused = false;
      this.loop = true;
      this.shown = true;

      this.geometries = new Set();
      this.materials = new Set();
      this.textures = new Set();
      this.baseOpacity = new Map();

      this.eye = new V();
      this.localEye = new V();
      this.direction = new V();
      this.tempPosition = new V();
      this.dummy = new T.Object3D();

      this.lastPhase = -1;
      this.lastState = "";
      this.lastInstanceUpdate = -1000;

      this.root = new T.Group();
      this.el.setObject3D("welcome-demo", this.root);

      this.visual = new T.Group();
      this.visual.position.set(0, 1.9, 0);
      this.root.add(this.visual);

      this.atomic = new T.Group();
      this.atomic.rotation.set(0.18, 0.42, -0.04);
      this.visual.add(this.atomic);

      this.specimen = new T.Group();
      this.visual.add(this.specimen);

      this.makeBackdrop();
      this.makeTypography();
      this.makeLattice();
      this.makeCoordination();
      this.makeSpecimen();

      this.updateAnimation(true);
      this.updateBillboards();
    },

    ownGeometry: function (geometry) {
      this.geometries.add(geometry);
      return geometry;
    },

    ownMaterial: function (material, opacity) {
      this.materials.add(material);
      this.baseOpacity.set(
        material,
        opacity === undefined ? 1 : opacity
      );

      return material;
    },

    makeTexture: function (width, height, draw) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      draw(canvas.getContext("2d"), width, height);

      const texture = new T.CanvasTexture(canvas);
      texture.minFilter = T.LinearFilter;
      texture.magFilter = T.LinearFilter;
      texture.generateMipmaps = false;

      this.textures.add(texture);
      return {canvas, texture};
    },

    mesh: function (geometry, material, parent) {
      const mesh = new T.Mesh(geometry, material);
      parent.add(mesh);
      return mesh;
    },

    basic: function (color, opacity) {
      return this.ownMaterial(
        new T.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: opacity === undefined ? 1 : opacity,
          side: T.DoubleSide,
          depthWrite: false
        }),
        opacity
      );
    },

    lit: function (color, opacity) {
      return this.ownMaterial(
        new T.MeshStandardMaterial({
          color,
          roughness: 0.4,
          metalness: 0,
          transparent: true,
          opacity: opacity === undefined ? 1 : opacity,
          depthWrite: false
        }),
        opacity
      );
    },

    lineMaterial: function (color, opacity) {
      return this.ownMaterial(
        new T.LineBasicMaterial({
          color,
          transparent: true,
          opacity,
          depthWrite: false
        }),
        opacity
      );
    },

    setAlpha: function (material, alpha, cycle) {
      material.opacity =
        this.baseOpacity.get(material) *
        clamp(alpha, 0, 1) *
        (cycle === undefined ? 1 : cycle);

      material.visible = material.opacity > 0.001;
    },

    makeBackdrop: function () {
      /*
       * Opaque, nur raumgebundene Darstellungshilfe.
       * Sie steht stets hinter dem Modell, aus Sicht des Betrachters.
       * Kein Raycastziel, kein Navigationshindernis.
       */
      const material = this.ownMaterial(
        new T.MeshBasicMaterial({
          color: COLORS.backdrop,
          side: T.DoubleSide
        })
      );

      this.backdrop = new T.Group();
      this.root.add(this.backdrop);

      this.mesh(
        this.ownGeometry(new T.PlaneGeometry(3.65, 3.35)),
        material,
        this.backdrop
      );

      const borderGeometry = this.ownGeometry(
        new T.EdgesGeometry(
          this.ownGeometry(new T.PlaneGeometry(3.65, 3.35))
        )
      );

      const border = new T.LineSegments(
        borderGeometry,
        this.lineMaterial(COLORS.gold, 0.8)
      );

      border.position.z = 0.008;
      this.backdrop.add(border);

      const floorMaterial = this.basic("#223643", 0.96);

      this.floorDisc = this.mesh(
        this.ownGeometry(new T.CircleGeometry(1.9, 64)),
        floorMaterial,
        this.root
      );

      this.floorDisc.rotation.x = -Math.PI / 2;
      this.floorDisc.position.y = 0.017;
    },

    makeTypography: function () {
      const quoteTexture = this.makeTexture(
        2048, 440, (ctx, w, h) => {
          ctx.fillStyle = COLORS.paper;
          ctx.fillRect(0, 0, w, h);

          ctx.strokeStyle = COLORS.gold;
          ctx.lineWidth = 10;
          ctx.strokeRect(10, 10, w - 20, h - 20);

          ctx.fillStyle = COLORS.ink;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = "bold 103px Georgia";

          ctx.fillText(
            "„Dass ich erkenne, was die Welt",
            w / 2, 133, w - 120
          );

          ctx.fillText(
            "im Innersten zusammenhält“",
            w / 2, 256, w - 120
          );

          ctx.fillStyle = "#746544";
          ctx.font = "42px Arial";

          ctx.fillText(
            "Johann Wolfgang von Goethe · Faust I",
            w / 2, 370, w - 120
          );
        }
      );

      this.quoteMaterial = this.ownMaterial(
        new T.MeshBasicMaterial({
          map: quoteTexture.texture,
          side: T.DoubleSide
        })
      );

      this.quote = this.mesh(
        this.ownGeometry(new T.PlaneGeometry(5.4, 1.16)),
        this.quoteMaterial,
        this.root
      );

      this.quote.position.set(0, 4.25, 0);

      this.phaseTexture = this.makeTexture(1536, 300, () => {});

      this.phaseMaterial = this.ownMaterial(
        new T.MeshBasicMaterial({
          map: this.phaseTexture.texture,
          side: T.DoubleSide
        })
      );

      this.phaseBoard = this.mesh(
        this.ownGeometry(new T.PlaneGeometry(3.4, 0.664)),
        this.phaseMaterial,
        this.root
      );

      this.phaseBoard.position.set(0, 0.39, 1.7);

      this.labelMaterials = {};

      [
        ["Na", "Na⁺", COLORS.sodium],
        ["Cl", "Cl⁻", COLORS.chloride]
      ].forEach(([id, text, color]) => {
        const texture = this.makeTexture(
          192, 96, (ctx, w, h) => {
            ctx.fillStyle = "rgba(255,253,247,0.97)";
            ctx.fillRect(6, 6, w - 12, h - 12);

            ctx.strokeStyle = color;
            ctx.lineWidth = 8;
            ctx.strokeRect(6, 6, w - 12, h - 12);

            ctx.fillStyle = "#171923";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "bold 64px Arial";
            ctx.fillText(text, w / 2, h / 2 + 2);
          }
        );

        this.labelMaterials[id] = this.ownMaterial(
          new T.SpriteMaterial({
            map: texture.texture,
            transparent: true,
            depthTest: true,
            depthWrite: false
          })
        );
      });
    },

    drawPhase: function (phase) {
      const canvas = this.phaseTexture.canvas;
      const ctx = canvas.getContext("2d");
      const w = canvas.width;
      const h = canvas.height;
      const entry = PHASES[phase];

      ctx.fillStyle = COLORS.paper;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 7;
      ctx.strokeRect(5, 5, w - 10, h - 10);

      ctx.fillStyle = COLORS.ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 48px Arial";
      ctx.fillText(entry.title, w / 2, 64, w - 80);

      ctx.font = "35px Arial";

      const lines = wrap(ctx, entry.text, w - 100);

      lines.slice(0, 2).forEach((line, index) => {
        ctx.fillText(line, w / 2, 124 + index * 43, w - 80);
      });

      const state = !this.shown
        ? "Animation ausgeblendet"
        : this.paused
          ? "Pausiert"
          : "Animation läuft";

      ctx.fillStyle = "#776441";
      ctx.font = "30px Arial";

      ctx.fillText(
        state + " · B/Y → Begrüßungsanimation & Bedienhilfe",
        w / 2, 254, w - 70
      );

      this.phaseTexture.texture.needsUpdate = true;
    },

    makeLattice: function () {
      const initial = new Map();

      for (let i = 0; i <= 2; i++) {
        for (let j = 0; j <= 2; j++) {
          for (let k = 0; k <= 2; k++) {
            initial.set(key(i, j, k), [i, j, k]);
          }
        }
      }

      const seen = new Set(initial.keys());
      const levels = [Array.from(initial.values())];

      /*
       * Ebene 0: Ionenpositionen der Ausgangszelle.
       * Ebene 1: ihre ergänzenden direkten Nachbarn.
       * Ebene 2: zusätzlich benötigte Positionen für 3x3x3.
       * Ebene 3: zusätzlich benötigte Positionen für 6x6x6.
       * Ebene 4: zusätzlich benötigte Positionen für 9x9x9.
       */
      [1, 3, 6, 9].forEach(n => {
        const next = [];

        latticePositions(n).forEach((position, id) => {
          if (seen.has(id)) return;

          seen.add(id);
          next.push(position);
        });

        levels.push(next);
      });

      const sphere = this.ownGeometry(
        new T.SphereGeometry(1, 12, 8)
      );

      this.ionLayers = [];
      this.labels = [];

      levels.forEach((positions, level) => {
        ["Na", "Cl"].forEach(type => {
          const points = positions.filter(([i, j, k]) => {
            const sodium = Math.abs((i + j + k) % 2) === 1;
            return type === "Na" ? sodium : !sodium;
          }).map(([i, j, k]) => new V(
            (i - 1) / 2,
            (j - 1) / 2,
            (k - 1) / 2
          ));

          if (!points.length) return;

          const material = this.lit(
            type === "Na" ? COLORS.sodium : COLORS.chloride
          );

          /*
           * Kleiner Eigenleuchtanteil für stabile Modellfarben.
           * Es werden keine zusätzlichen Raumlichter erzeugt.
           */
          material.emissive.set(
            type === "Na" ? COLORS.sodium : COLORS.chloride
          );
          material.emissiveIntensity = 0.15;

          const mesh = new T.InstancedMesh(
            sphere, material, points.length
          );

          mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
          mesh.frustumCulled = false;
          this.atomic.add(mesh);

          const radius = type === "Na" ? 0.115 : 0.165;

          this.ionLayers.push({
            mesh, material, points, radius, level
          });

          if (level === 0) {
            points.forEach(center => {
              const sprite = new T.Sprite(
                this.labelMaterials[type]
              );

              sprite.scale.set(0.225, 0.1125, 1);
              this.atomic.add(sprite);

              this.labels.push({
                sprite,
                center: center.clone(),
                radius
              });
            });
          }
        });
      });

      /*
       * Gemeinsame Gitterlinien:
       * Jede Zellkante wird geometrisch nur einmal erzeugt.
       */
      this.frames = [];

      [3, 6, 9].forEach(n => {
        const bounds = cellBounds(n);
        const vertices = [];

        for (let a = 0; a <= n; a++) {
          for (let b = 0; b <= n; b++) {
            const u = bounds.min + a;
            const v = bounds.min + b;

            vertices.push(
              bounds.min, u, v,
              bounds.max, u, v
            );

            vertices.push(
              u, bounds.min, v,
              u, bounds.max, v
            );

            vertices.push(
              u, v, bounds.min,
              u, v, bounds.max
            );
          }
        }

        const geometry = this.ownGeometry(
          new T.BufferGeometry()
        );

        geometry.setAttribute(
          "position",
          new T.Float32BufferAttribute(vertices, 3)
        );

        const material = this.lineMaterial("#b6cbd9", 0.62);
        const frame = new T.LineSegments(geometry, material);

        this.atomic.add(frame);
        this.frames.push({n, bounds, frame, material});
      });

      const cube = this.ownGeometry(
        new T.BoxGeometry(1, 1, 1)
      );

      const edges = this.ownGeometry(
        new T.EdgesGeometry(cube)
      );

      this.originMaterial = this.lineMaterial(COLORS.gold, 1);

      this.originFrame = new T.LineSegments(
        edges, this.originMaterial
      );

      this.atomic.add(this.originFrame);

      this.originTintMaterial = this.basic(COLORS.gold, 0.06);

      this.originTint = this.mesh(
        cube, this.originTintMaterial, this.atomic
      );
    },

    makeCoordination: function () {
      this.coordination = [];

      const examples = [
        {
          type: "Na",
          center: new V(0, 0, 0),
          color: COLORS.chloride
        },
        {
          type: "Cl",
          center: new V(0, 0, -0.5),
          color: COLORS.sodium
        }
      ];

      const octEdges = [
        [0, 2], [0, 3], [0, 4], [0, 5],
        [1, 2], [1, 3], [1, 4], [1, 5],
        [2, 4], [2, 5], [3, 4], [3, 5]
      ];

      examples.forEach(example => {
        const center = example.center;

        const neighbors = DIRECTIONS.map(d => {
          return center.clone().add(
            new V(d[0] / 2, d[1] / 2, d[2] / 2)
          );
        });

        const vertices = [];

        neighbors.forEach(p => {
          vertices.push(
            center.x, center.y, center.z,
            p.x, p.y, p.z
          );
        });

        octEdges.forEach(([a, b]) => {
          vertices.push(
            neighbors[a].x,
            neighbors[a].y,
            neighbors[a].z,
            neighbors[b].x,
            neighbors[b].y,
            neighbors[b].z
          );
        });

        const geometry = this.ownGeometry(
          new T.BufferGeometry()
        );

        geometry.setAttribute(
          "position",
          new T.Float32BufferAttribute(vertices, 3)
        );

        const material = this.lineMaterial(example.color, 0.9);
        const lines = new T.LineSegments(geometry, material);

        this.atomic.add(lines);

        this.coordination.push({
          type: example.type,
          lines,
          material
        });
      });
    },

    makeSpecimen: function () {
      const cube = this.ownGeometry(
        new T.BoxGeometry(1, 1, 1)
      );

      const edges = this.ownGeometry(
        new T.EdgesGeometry(cube)
      );

      this.selectedPosition = new V(0, -0.72, 0.18);
      this.selectedSize = 0.16;

      this.selectedMaterial = this.lit("#eff6fa");
      this.selectedMaterial.roughness = 0.26;

      this.selectedCrystal = this.mesh(
        cube, this.selectedMaterial, this.specimen
      );

      this.selectedCrystal.position.copy(this.selectedPosition);
      this.selectedCrystal.rotation.copy(this.atomic.rotation);
      this.selectedCrystal.scale.setScalar(this.selectedSize);

      this.selectedGoldMaterial = this.lineMaterial(COLORS.gold, 1);

      this.selectedGold = new T.LineSegments(
        edges, this.selectedGoldMaterial
      );

      this.selectedCrystal.add(this.selectedGold);

      /*
       * Frühe Hüllfläche als Detailstufen-Übergang.
       * Sie deutet den größeren geordneten Bereich an, während
       * das explizite Ionengitter weiter schrumpft.
       */
      this.envelopeMaterial = this.basic("#adc8df", 0.075);

      this.envelope = this.mesh(
        cube, this.envelopeMaterial, this.visual
      );

      this.envelope.rotation.copy(this.atomic.rotation);
      this.envelope.scale.setScalar(2.2);

      this.envelopeEdgeMaterial = this.lineMaterial("#8faac0", 0.3);

      this.envelopeEdges = new T.LineSegments(
        edges, this.envelopeEdgeMaterial
      );

      this.envelope.add(this.envelopeEdges);

      /*
       * Vereinfachte Kristallkörner der endgültigen Probe.
       * Keine Packungs- oder Partikeldynamiksimulation.
       */
      let seed = 745219;

      const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };

      this.grains = [];

      for (let ix = -5; ix <= 5; ix++) {
        for (let iz = -5; iz <= 5; iz++) {
          const x = ix * 0.165;
          const z = iz * 0.165;
          const r = Math.sqrt(x * x + z * z);

          if (r > 0.83) continue;

          const layers = r < 0.47 ? 3 : 2;

          for (let layer = 0; layer < layers; layer++) {
            const position = new V(
              x + (random() - 0.5) * 0.025,
              -1.01 + layer * 0.145,
              z + (random() - 0.5) * 0.025
            );

            if (
              position.distanceTo(this.selectedPosition) < 0.20
            ) continue;

            const rotation = new T.Quaternion().setFromEuler(
              new T.Euler(
                random() * Math.PI,
                random() * Math.PI,
                random() * Math.PI
              )
            );

            this.grains.push({
              position,
              rotation,
              size: 0.115 + random() * 0.035
            });
          }
        }
      }

      this.grainMaterial = this.lit("#ffffff");
      this.grainMaterial.roughness = 0.56;

      this.grainMesh = new T.InstancedMesh(
        cube, this.grainMaterial, this.grains.length
      );

      this.grainMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      this.grainMesh.frustumCulled = false;
      this.specimen.add(this.grainMesh);

      for (let i = 0; i < this.grains.length; i++) {
        this.grainMesh.setColorAt(
          i,
          new T.Color().setScalar(0.86 + random() * 0.14)
        );
      }

      this.grainMesh.instanceColor.needsUpdate = true;

      this.makeBeaker();
    },

    makeBeaker: function () {
      this.beaker = new T.Group();
      this.specimen.add(this.beaker);

      this.glassMaterial = this.ownMaterial(
        new T.MeshStandardMaterial({
          color: "#d4eaf4",
          transparent: true,
          opacity: 0.29,
          roughness: 0.2,
          metalness: 0,
          side: T.DoubleSide,
          depthWrite: false
        }),
        0.29
      );

      /*
       * Geformter Ausguss:
       * Die obere Wand wird an einer Seite nach außen gezogen.
       * Der Rand folgt derselben Kontur.
       */
      const spoutAngle = Math.PI * 1.5;

      function spoutWeight(angle) {
        const delta = Math.atan2(
          Math.sin(angle - spoutAngle),
          Math.cos(angle - spoutAngle)
        );

        return Math.exp(
          -(delta * delta) / (2 * 0.15 * 0.15)
        );
      }

      const wallGeometry = new T.CylinderGeometry(
        1.02, 0.98, 2.2, 64, 5, true
      );

      const positions = wallGeometry.attributes.position;

      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);

        const angle = Math.atan2(x, z);
        const weight = spoutWeight(angle);
        const top = ramp(y, 0.65, 1.1);
        const radial = Math.sqrt(x * x + z * z);
        const extra = 0.23 * weight * top;

        const factor = (radial + extra) / radial;

        positions.setXYZ(
          i,
          x * factor,
          y + 0.045 * weight * top,
          z * factor
        );
      }

      positions.needsUpdate = true;
      wallGeometry.computeVertexNormals();

      const wall = this.mesh(
        this.ownGeometry(wallGeometry),
        this.glassMaterial,
        this.beaker
      );

      wall.renderOrder = 3;

      this.baseGlassMaterial = this.ownMaterial(
        new T.MeshStandardMaterial({
          color: "#c7e1ed",
          transparent: true,
          opacity: 0.43,
          roughness: 0.24,
          side: T.DoubleSide,
          depthWrite: false
        }),
        0.43
      );

      const bottom = this.mesh(
        this.ownGeometry(
          new T.CylinderGeometry(0.98, 0.98, 0.065, 64)
        ),
        this.baseGlassMaterial,
        this.beaker
      );

      bottom.position.y = -1.1;
      bottom.renderOrder = 3;

      this.glassEdgeMaterial = this.basic("#c6e7f5", 0.95);

      const lipPoints = [];

      for (let i = 0; i < 96; i++) {
        const angle = i / 96 * Math.PI * 2;
        const weight = spoutWeight(angle);
        const radius = 1.02 + 0.23 * weight;

        lipPoints.push(new V(
          Math.sin(angle) * radius,
          1.1 + 0.045 * weight,
          Math.cos(angle) * radius
        ));
      }

      const lipCurve = new T.CatmullRomCurve3(
        lipPoints, true, "centripetal"
      );

      const lip = this.mesh(
        this.ownGeometry(
          new T.TubeGeometry(lipCurve, 128, 0.022, 6, true)
        ),
        this.glassEdgeMaterial,
        this.beaker
      );

      lip.renderOrder = 4;

      const baseRing = this.mesh(
        this.ownGeometry(
          new T.TorusGeometry(0.98, 0.018, 6, 64)
        ),
        this.glassEdgeMaterial,
        this.beaker
      );

      baseRing.rotation.x = Math.PI / 2;
      baseRing.position.y = -1.08;
      baseRing.renderOrder = 4;

      /*
       * Laborartige Skala auf der vorderen Glasfläche.
       * 500-mL-Beschriftung ist schematisch, keine berechnete
       * Füllmenge aus der atomaren Szene.
       */
      const scaleTexture = this.makeTexture(
        384, 1024, (ctx, w, h) => {
          ctx.clearRect(0, 0, w, h);

          ctx.fillStyle = "#f2fbff";
          ctx.strokeStyle = "#f2fbff";
          ctx.lineWidth = 8;

          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.font = "bold 62px Arial";

          ctx.fillText("mL", 168, 62);

          for (let i = 0; i <= 8; i++) {
            const y = 166 + i * 91;
            const major = i % 2 === 0;

            ctx.beginPath();
            ctx.moveTo(32, y);
            ctx.lineTo(major ? 142 : 101, y);
            ctx.stroke();

            if (major) {
              const value = 500 - i * 50;
              ctx.fillText(String(value), 165, y);
            }
          }

          ctx.font = "bold 48px Arial";
          ctx.fillText("NaCl", 118, 968);
        }
      );

      this.scaleMaterial = this.ownMaterial(
        new T.MeshBasicMaterial({
          map: scaleTexture.texture,
          transparent: true,
          side: T.DoubleSide,
          depthWrite: false
        })
      );

      this.scaleBoard = this.mesh(
        this.ownGeometry(new T.PlaneGeometry(0.59, 1.57)),
        this.scaleMaterial,
        this.beaker
      );

      this.scaleBoard.position.set(0.18, 0.06, 1.035);
      this.scaleBoard.renderOrder = 5;

      this.glassMaterials = [
        this.glassMaterial,
        this.baseGlassMaterial,
        this.glassEdgeMaterial,
        this.scaleMaterial
      ];
    },

    phaseIndex: function () {
      let phase = 0;

      PHASE_TIMES.forEach((value, index) => {
        if (this.time >= value) phase = index;
      });

      return phase;
    },

    atomicScale: function () {
      const t = this.time;

      /*
       * Die Zellblöcke sind zunächst gut erkennbar.
       * Nach 9x9x9 beschleunigt der Zoom deutlich und setzt
       * sich noch mehrere Sekunden fort.
       */
      if (t < 6) return 1.10;

      if (t < 10) {
        return Math.exp(lerp(
          Math.log(1.10),
          Math.log(0.68),
          ramp(t, 6, 10)
        ));
      }

      if (t < 15) {
        return Math.exp(lerp(
          Math.log(0.68),
          Math.log(0.35),
          ramp(t, 10, 15)
        ));
      }

      if (t < 19) {
        return Math.exp(lerp(
          Math.log(0.35),
          Math.log(0.26),
          ramp(t, 15, 19)
        ));
      }

      const x = clamp((t - 19) / 7, 0, 1);

      return 0.26 * Math.exp(
        Math.log(0.003 / 0.26) * Math.pow(x, 1.55)
      );
    },

    setShown: function (shown) {
      this.shown = !!shown;

      if (!this.shown) this.paused = true;

      this.updateAnimation(true);
    },

    restart: function () {
      this.time = 0;
      this.paused = true;
      this.lastPhase = -1;
      this.updateAnimation(true);
    },

    nextPhase: function () {
      const next = PHASE_TIMES.find(
        value => value > this.time + 0.1
      );

      this.time = next === undefined ? 0 : next;
      this.paused = true;
      this.updateAnimation(true);
    },

    updateIonInstances: function (scale) {
      this.ionLayers.forEach(layer => {
        layer.points.forEach((point, index) => {
          /*
           * Nur während des Einblendens am Präsentationsrand
           * wird eine Kugel weich verkleinert.
           */
          const edge = Math.max(
            Math.abs(point.x),
            Math.abs(point.y),
            Math.abs(point.z)
          );

          const available = BOUND / scale - edge;

          const reveal = clamp(
            available / layer.radius,
            0, 1
          );

          this.dummy.position.copy(point);
          this.dummy.quaternion.identity();
          this.dummy.scale.setScalar(
            layer.radius * reveal
          );

          this.dummy.updateMatrix();
          layer.mesh.setMatrixAt(index, this.dummy.matrix);
        });

        layer.mesh.instanceMatrix.needsUpdate = true;
      });
    },

    updateGrainInstances: function (zoom) {
      const progress = ramp(this.time, 26, 34);

      const focus = this.tempPosition
        .copy(this.selectedPosition)
        .multiplyScalar(1 - progress);

      this.specimen.position.copy(focus).multiplyScalar(-zoom);
      this.specimen.scale.setScalar(zoom);

      this.grains.forEach((grain, index) => {
        const distance = grain.position.distanceTo(focus) * zoom;
        const radius = grain.size * zoom * Math.sqrt(3) / 2;

        const reveal = clamp(
          (1.65 - distance) / Math.max(radius, 0.0001),
          0, 1
        );

        this.dummy.position.copy(grain.position);
        this.dummy.quaternion.copy(grain.rotation);
        this.dummy.scale.setScalar(grain.size * reveal);
        this.dummy.updateMatrix();

        this.grainMesh.setMatrixAt(index, this.dummy.matrix);
      });

      this.grainMesh.instanceMatrix.needsUpdate = true;
    },

    updateAnimation: function (updateInstances) {
      const t = this.time;
      const scale = this.atomicScale();

      const cycle = this.loop && !this.paused
        ? ramp(t, 0, 0.65) * (1 - ramp(t, 40, 42))
        : 1;

      this.atomic.scale.setScalar(scale);

      const atomFade = 1 - ramp(t, 23, 26);

      const levelAlpha = [
        1,
        lerp(0.32, 1, ramp(t, 6, 9)),
        ramp(t, 6.5, 9),
        ramp(t, 11, 14),
        ramp(t, 16, 18)
      ];

      this.ionLayers.forEach(layer => {
        const alpha = levelAlpha[layer.level] * atomFade;

        this.setAlpha(layer.material, alpha, cycle);
        layer.mesh.visible = alpha > 0.001;
      });

      this.frames.forEach(entry => {
        let alpha = 0;

        if (entry.n === 3) {
          alpha =
            ramp(t, 8, 9.5) *
            (1 - ramp(t, 13, 15));
        }

        if (entry.n === 6) {
          alpha =
            ramp(t, 13, 15) *
            (1 - ramp(t, 17.5, 19));
        }

        if (entry.n === 9) {
          alpha =
            ramp(t, 17.5, 19) *
            (1 - ramp(t, 21, 23));
        }

        const extent = Math.max(
          Math.abs(entry.bounds.min),
          Math.abs(entry.bounds.max)
        );

        if (extent * scale > BOUND) alpha = 0;

        this.setAlpha(entry.material, alpha, cycle);
        entry.frame.visible = alpha > 0.001;
      });

      const originAlpha = 1 - ramp(t, 24, 26);

      this.setAlpha(this.originMaterial, originAlpha, cycle);
      this.setAlpha(this.originTintMaterial, originAlpha, cycle);

      const sodiumCoord =
        ramp(t, 0.7, 1.2) *
        (1 - ramp(t, 3, 3.5));

      const chlorideCoord =
        ramp(t, 3.4, 3.9) *
        (1 - ramp(t, 5.5, 6));

      this.coordination.forEach(entry => {
        const alpha = entry.type === "Na"
          ? sodiumCoord
          : chlorideCoord;

        this.setAlpha(entry.material, alpha, cycle);
        entry.lines.visible = alpha > 0.001;
      });

      const labelAlpha = 1 - ramp(t, 7, 10);

      Object.values(this.labelMaterials).forEach(material => {
        this.setAlpha(material, labelAlpha, cycle);
      });

      this.labels.forEach(label => {
        label.sprite.visible = labelAlpha > 0.001;
      });

      /*
       * Die Hülle erscheint sehr schwach, während der atomare
       * Zoom noch weitergeht. Erst später wird daraus der
       * sichtbare makroskopische Kristallit.
       */
      const envelopeAlpha =
        ramp(t, 20, 23) *
        (1 - ramp(t, 24.5, 27));

      this.setAlpha(
        this.envelopeMaterial, envelopeAlpha, cycle
      );

      this.setAlpha(
        this.envelopeEdgeMaterial, envelopeAlpha, cycle
      );

      this.envelope.visible = envelopeAlpha > 0.001;

      /*
       * Größerer Einkristallit übernimmt die Orientierung
       * des zuvor sichtbaren Gitters.
       */
      const initialZoom = 2.2 / this.selectedSize;

      const specimenZoom = t <= 26
        ? initialZoom
        : Math.exp(
            Math.log(initialZoom) *
            (1 - ramp(t, 26, 34))
          );

      const crystalAlpha = ramp(t, 24, 27);

      this.setAlpha(
        this.selectedMaterial, crystalAlpha, cycle
      );

      this.selectedCrystal.visible = crystalAlpha > 0.001;

      const goldAlpha =
        ramp(t, 25, 27) *
        (1 - ramp(t, 31.5, 34));

      this.setAlpha(
        this.selectedGoldMaterial, goldAlpha, cycle
      );

      const grainAlpha = ramp(t, 27, 31);

      this.setAlpha(
        this.grainMaterial, grainAlpha, cycle
      );

      this.grainMesh.visible = grainAlpha > 0.001;

      /*
       * Becherglas erst einblenden, wenn es in die feste
       * Präsentationsgröße passt.
       */
      const focusLength =
        this.selectedPosition.length() *
        (1 - ramp(t, 26, 34));

      const glassFits =
        specimenZoom * (1.63 + focusLength) <= 1.68;

      const glassAlpha = glassFits
        ? ramp(t, 32.5, 34.5)
        : 0;

      this.glassMaterials.forEach(material => {
        this.setAlpha(material, glassAlpha, cycle);
      });

      this.beaker.visible = glassAlpha > 0.001;

      if (updateInstances) {
        this.updateIonInstances(scale);
        this.updateGrainInstances(specimenZoom);
      }

      this.visual.visible = this.shown;
      this.backdrop.visible = this.shown;
      this.floorDisc.visible = this.shown;

      const phase = this.phaseIndex();
      const state = [
        this.paused,
        this.shown,
        this.loop
      ].join(":");

      if (
        phase !== this.lastPhase ||
        state !== this.lastState
      ) {
        this.lastPhase = phase;
        this.lastState = state;
        this.drawPhase(phase);
      }
    },

    faceViewer: function (object) {
      object.getWorldPosition(this.tempPosition);

      object.rotation.set(
        0,
        Math.atan2(
          this.eye.x - this.tempPosition.x,
          this.eye.z - this.tempPosition.z
        ),
        0
      );
    },

    updateBillboards: function () {
      const scene = this.el.sceneEl;

      if (!scene || !scene.camera) return;

      scene.camera.getWorldPosition(this.eye);

      this.faceViewer(this.quote);

      /*
       * Infotafel liegt auf der Betrachterseite des Modells.
       * Hintergrund liegt auf der gegenüberliegenden Seite.
       * Nur horizontale Ausrichtung, kein Folgen der Kopfneigung.
       */
      this.direction.set(this.eye.x, 0, this.eye.z);

      if (this.direction.lengthSq() < 0.0001) {
        this.direction.set(0, 0, 1);
      } else {
        this.direction.normalize();
      }

      this.backdrop.position.set(
        -this.direction.x * 1.85,
        1.9,
        -this.direction.z * 1.85
      );

      this.faceViewer(this.backdrop);

      this.phaseBoard.position.set(
        this.direction.x * 1.72,
        0.39,
        this.direction.z * 1.72
      );

      this.faceViewer(this.phaseBoard);

      if (!this.shown || this.time >= 10) return;

      this.atomic.updateWorldMatrix(true, false);

      this.localEye.copy(this.eye);
      this.atomic.worldToLocal(this.localEye);

      this.labels.forEach(label => {
        this.direction.copy(this.localEye).sub(label.center);

        if (this.direction.lengthSq() < 0.00001) {
          this.direction.set(0, 0, 1);
        } else {
          this.direction.normalize();
        }

        label.sprite.position
          .copy(label.center)
          .addScaledVector(
            this.direction,
            label.radius + 0.014
          );
      });
    },

    tick: function (time, delta) {
      const menuOpen = F.Menu && F.Menu.opened;

      if (
        !this.paused &&
        this.shown &&
        !menuOpen
      ) {
        const seconds = Math.min(
          Math.max((delta || 0) / 1000, 0),
          0.05
        );

        this.time += seconds * this.data.speed;

        if (this.time >= END) {
          if (this.loop) {
            this.time = 0;
            this.lastPhase = -1;
          } else {
            this.time = 35;
            this.paused = true;
          }
        }
      }

      const updateInstances =
        time - this.lastInstanceUpdate >= 40;

      if (updateInstances) {
        this.lastInstanceUpdate = time;
      }

      this.updateAnimation(updateInstances);
      this.updateBillboards();
    },

    remove: function () {
      this.el.removeObject3D("welcome-demo");

      this.geometries.forEach(geometry => geometry.dispose());
      this.materials.forEach(material => material.dispose());
      this.textures.forEach(texture => texture.dispose());

      this.geometries.clear();
      this.materials.clear();
      this.textures.clear();
    }
  });

  /*
   * ============================================================
   * BEGRÜSSUNGSRAUM ERGÄNZEN
   * ============================================================
   */
  const previousBuild = F.RoomBuilder.build;

  F.RoomBuilder.build = function (parent, config, rooms) {
    const result = previousBuild.call(
      this, parent, config, rooms
    );

    if (config.kind !== "welcome") return result;

    const experiment = document.createElement("a-entity");

    experiment.id = "fkc-welcome-experiment";
    experiment.setAttribute("fkc-welcome-demo", "");

    parent.appendChild(experiment);

    /*
     * Keine Navigationssperre und keine interaktiven
     * oder bemalbaren Modellklassen.
     */
    return result;
  };

  /*
   * ============================================================
   * MENÜ ERGÄNZEN
   *
   * Bestehende Röntgen-Unterseite bleibt unverändert.
   * ============================================================
   */
  const previousRender = F.Menu.render;

  function feedback(menu, message) {
    menu.blockDrawing();
    menu.notify(message);

    if (F.setStatus) F.setStatus(message);
  }

  F.Menu.render = function () {
    const demo = currentDemo();

    if (this.page !== "welcome-demo") {
      previousRender.call(this);

      if (
        demo &&
        this.page === "home" &&
        this.root &&
        this.buttons[3]
      ) {
        const item = this.buttons[3];

        item.label = "Begrüßungsanimation & Bedienhilfe";
        item.action = () => this.navigate("welcome-demo");

        const pressed = this.pressedIndex === 3;
        const offset = pressed ? 5 : 0;
        const ctx = this.ctx;

        ctx.fillStyle = "#a9bcae";
        ctx.fillRect(
          item.x, item.y + 5, item.w, item.h
        );

        ctx.fillStyle = pressed
          ? "#bba466"
          : "#efe0b8";

        ctx.fillRect(
          item.x,
          item.y + offset,
          item.w,
          item.h
        );

        ctx.strokeStyle = "#a9bcae";
        ctx.lineWidth = 2;

        ctx.strokeRect(
          item.x,
          item.y + offset,
          item.w,
          item.h
        );

        ctx.fillStyle = "#263f33";
        ctx.font = "30px Arial";

        ctx.fillText(
          item.label,
          item.x + 22,
          item.y + 46 + offset,
          item.w - 44
        );

        this.texture.needsUpdate = true;
      }

      return;
    }

    if (!this.root) return;

    if (!demo) {
      this.page = "home";
      previousRender.call(this);
      return;
    }

    const ctx = this.ctx;
    this.buttons = [];

    ctx.fillStyle = "#fffdf5";
    ctx.fillRect(0, 0, 1024, 1200);

    ctx.fillStyle = "#263f33";
    ctx.font = "bold 45px Arial";

    ctx.fillText(
      "Vom Ionengitter zur Salzprobe",
      55, 75, 914
    );

    ctx.font = "27px Arial";

    ctx.fillText(
      "NaCl · Fm3̅m · Koordination 6 : 6",
      55, 125, 914
    );

    let y = 175;

    const button = (label, action, color) => {
      const x = 55;
      const w = 914;
      const h = 72;
      const index = this.buttons.length;
      const pressed = index === this.pressedIndex;
      const offset = pressed ? 5 : 0;

      ctx.fillStyle = "#a9bcae";
      ctx.fillRect(x, y + 5, w, h);

      ctx.fillStyle = pressed
        ? "#b8c7bd"
        : color || "#dfe9e2";

      ctx.fillRect(x, y + offset, w, h);

      ctx.strokeStyle = "#a9bcae";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y + offset, w, h);

      ctx.fillStyle = "#263f33";
      ctx.font = "30px Arial";

      ctx.fillText(
        label,
        x + 22,
        y + 46 + offset,
        w - 44
      );

      this.buttons.push({
        x, y, w, h, label, action
      });

      y += 86;
    };

    button(
      demo.paused
        ? "Animation starten / fortsetzen"
        : "Animation pausieren",
      () => {
        if (!demo.shown) demo.setShown(true);

        demo.paused = !demo.paused;
        demo.updateAnimation(true);

        feedback(
          this,
          demo.paused
            ? "Animation pausiert."
            : "Animation läuft."
        );
      },
      "#efe0b8"
    );

    button(
      "Zum Anfang — anschließend pausiert",
      () => {
        demo.restart();

        feedback(
          this,
          "Ausgangszelle wird angezeigt. Animation pausiert."
        );
      }
    );

    button(
      "Nächste Phase — anschließend pausiert",
      () => {
        demo.nextPhase();

        feedback(
          this,
          "Nächste Phase angezeigt. Animation pausiert."
        );
      }
    );

    button(
      "Geschwindigkeit: " + demo.data.speed + "×",
      () => {
        const speeds = [0.5, 1, 2];
        const index = speeds.indexOf(demo.data.speed);
        const next = speeds[(index + 1) % speeds.length];

        demo.el.setAttribute(
          "fkc-welcome-demo",
          "speed",
          next
        );

        feedback(this, "Geschwindigkeit: " + next + "×");
      },
      "#cddff3"
    );

    button(
      "Automatische Wiederholung: " +
      (demo.loop ? "an" : "aus"),
      () => {
        demo.loop = !demo.loop;

        feedback(
          this,
          demo.loop
            ? "Wiederholung eingeschaltet."
            : "Wiederholung aus. Ende bei der Salzprobe."
        );
      }
    );

    button(
      demo.shown
        ? "Animation ausblenden"
        : "Animation einblenden",
      () => {
        demo.setShown(!demo.shown);

        feedback(
          this,
          demo.shown
            ? "Animation eingeblendet; bei Bedarf starten."
            : "Animation ausgeblendet und pausiert."
        );
      }
    );

    button(
      "Allgemeine Bedienhilfe",
      () => this.navigate("help")
    );

    button(
      "Zurück zum Hauptmenü",
      () => this.navigate("home")
    );

    ctx.fillStyle = "#6b624e";
    ctx.font = "25px Arial";

    ctx.fillText(
      "Maßstabsübergänge vereinfacht · kein Kristallwachstum",
      55, 914, 914
    );

    ctx.fillText(
      "Während das Menü offen ist, hält die Animation an.",
      55, 957, 914
    );

    ctx.fillStyle = this.message
      ? "#dcefe2"
      : "#edf2ee";

    ctx.fillRect(35, 1078, 954, 53);

    ctx.fillStyle = "#244d35";
    ctx.font = "bold 25px Arial";

    ctx.fillText(
      this.message ||
      "Buttons mit Laser + Trigger auswählen",
      55, 1113, 910
    );

    ctx.fillStyle = "#607668";
    ctx.font = "23px Arial";

    ctx.fillText(
      "B/Y schließt · NaCl-Begrüßungsanimation · Version Willkommen-2",
      55, 1160, 914
    );

    this.texture.needsUpdate = true;
  };
})(window.FKCVR);
