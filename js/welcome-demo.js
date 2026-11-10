"use strict";

(function (F) {
  /*
   * ============================================================
   * WILLKOMMEN-1
   * Von der NaCl-Elementarzelle zur Salzprobe im Becherglas.
   *
   * Ergänzt ausschließlich den Begrüßungsraum.
   * Bestehende Raumgeometrie, Steuerung und Röntgendemo bleiben
   * unverändert.
   *
   * Fachliche Grundlage:
   * NaCl, Steinsalzstruktur, Fm-3m, Nr. 225.
   * Cl: 4a (0,0,0); Na: 4b (1/2,1/2,1/2).
   * Konventionelle kubische Zelle: Z = 4.
   *
   * Darstellung auf einem Halbgitter:
   * Position = (i,j,k) * a/2.
   * Gerade Summe i+j+k: Cl.
   * Ungerade Summe i+j+k: Na.
   *
   * Ein einziges Ion je Position, auch an Zellgrenzen.
   * Ausgangszelle: i,j,k = 0 ... 2.
   * Die sechs nächsten Nachbarn liegen entlang +/-x, +/-y, +/-z.
   *
   * Symbolische Farben und vereinfachte Maßstabsübergänge.
   * Keine Wachstums-, Packungs- oder optische Simulation.
   * ============================================================
   */

  if (
    !F ||
    !F.RoomBuilder ||
    !F.Menu ||
    !window.AFRAME
  ) {
    console.error(
      "Willkommen-1: A-Frame, room-builder.js und vr-tools.js " +
      "müssen vorher geladen sein."
    );
    return;
  }

  const T = AFRAME.THREE;
  const V = T.Vector3;

  const COLORS = {
    sodium: "#ac73ed",
    chloride: "#56c86c",
    gold: "#d5ad50",
    ink: "#252b30",
    paper: "#fffdf5"
  };

  const LIMIT = 1.65;
  const END = 42;

  const PHASE_TIMES = [0, 6, 11, 15, 21, 27, 34];

  const PHASES = [
    {
      title: "NaCl · eine konventionelle Elementarzelle",
      text: "Fm3̅m · Nr. 225 · 4 NaCl pro Zelle · Koordination 6 : 6"
    },
    {
      title: "Periodische Ordnung",
      text: "Nachbarzellen werden sichtbar — der Kristall wächst nicht."
    },
    {
      title: "Ein größerer Ausschnitt",
      text: "Die goldene Ausgangszelle bleibt an derselben Gitterposition."
    },
    {
      title: "Immer mehr Elementarzellen",
      text: "Wir wechseln den Betrachtungsmaßstab, nicht die Struktur."
    },
    {
      title: "Vom Ionengitter zum Kristallit",
      text: "Die Ionenfarben sind Modellfarben, keine Stofffarben."
    },
    {
      title: "Viele unterschiedlich orientierte Kristallite",
      text: "Die hervorgehobene Zelle gehörte zum goldmarkierten Kristallit."
    },
    {
      title: "NaCl · eine körnige Feststoffprobe",
      text: "Viele kleine Salzkristalle erscheinen gemeinsam als weiße Probe."
    }
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

  function wrap(ctx, text, maxWidth) {
    const lines = [];
    let current = "";

    String(text).split(/\s+/).forEach(word => {
      const candidate = current ? current + " " + word : word;

      if (current && ctx.measureText(candidate).width > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    });

    if (current) lines.push(current);
    return lines;
  }

  function currentDemo() {
    const el = document.getElementById("fkc-welcome-experiment");

    return el &&
      el.components &&
      el.components["fkc-welcome-demo"];
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

      this.lastPhase = -1;
      this.lastInstanceUpdate = -1000;
      this.lastState = "";

      this.eye = new V();
      this.localEye = new V();
      this.direction = new V();
      this.matrix = new T.Matrix4();
      this.dummy = new T.Object3D();
      this.cameraQuaternion = new T.Quaternion();

      this.root = new T.Group();
      this.el.setObject3D("welcome-demo", this.root);

      /*
       * Modellzentrum liegt oberhalb der Bodenraute.
       * Keine neue Navigationssperre.
       */
      this.visual = new T.Group();
      this.visual.position.set(0, 1.9, 0);
      this.root.add(this.visual);

      this.atomic = new T.Group();
      this.atomic.rotation.set(0.22, 0.48, -0.06);
      this.visual.add(this.atomic);

      this.specimen = new T.Group();
      this.visual.add(this.specimen);

      this.makeTypography();
      this.makeLattice();
      this.makeCoordination();
      this.makeSpecimen();
      this.updateAnimation(true);
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

    texture: function (width, height, draw) {
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

    opacity: function (material, amount) {
      material.opacity =
        amount * (this.baseOpacity.get(material) || 0);

      material.visible = material.opacity > 0.002;
    },

    mesh: function (geometry, material, parent) {
      const mesh = new T.Mesh(geometry, material);
      parent.add(mesh);
      return mesh;
    },

    basicMaterial: function (color, opacity) {
      return this.ownMaterial(new T.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: opacity === undefined ? 1 : opacity,
        depthWrite: false,
        side: T.DoubleSide
      }), opacity);
    },

    litMaterial: function (color, opacity) {
      return this.ownMaterial(new T.MeshStandardMaterial({
        color,
        roughness: 0.44,
        metalness: 0,
        transparent: true,
        opacity: opacity === undefined ? 1 : opacity,
        depthWrite: false
      }), opacity);
    },

    makeTypography: function () {
      const quoteTexture = this.texture(2048, 440, (ctx, w, h) => {
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
      });

      this.quoteMaterial = this.ownMaterial(
        new T.MeshBasicMaterial({
          map: quoteTexture.texture,
          side: T.DoubleSide,
          transparent: true
        })
      );

      this.quote = this.mesh(
        this.ownGeometry(new T.PlaneGeometry(5.8, 1.246)),
        this.quoteMaterial,
        this.root
      );

      this.quote.position.set(0, 4.12, 0);

      this.phaseTexture = this.texture(1536, 300, () => {});

      this.phaseMaterial = this.ownMaterial(
        new T.MeshBasicMaterial({
          map: this.phaseTexture.texture,
          side: T.DoubleSide,
          transparent: true
        })
      );

      this.phaseBoard = this.mesh(
        this.ownGeometry(new T.PlaneGeometry(3.4, 0.664)),
        this.phaseMaterial,
        this.root
      );

      this.phaseBoard.position.set(0, 0.39, 1.68);

      this.labelMaterials = {};

      [
        ["Na", "Na⁺", COLORS.sodium],
        ["Cl", "Cl⁻", COLORS.chloride]
      ].forEach(([id, text, color]) => {
        const label = this.texture(192, 96, (ctx, w, h) => {
          ctx.fillStyle = "rgba(255,253,247,0.96)";
          ctx.fillRect(6, 6, w - 12, h - 12);

          ctx.strokeStyle = color;
          ctx.lineWidth = 8;
          ctx.strokeRect(6, 6, w - 12, h - 12);

          ctx.fillStyle = "#191b21";
          ctx.font = "bold 64px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(text, w / 2, h / 2 + 2);
        });

        this.labelMaterials[id] = this.ownMaterial(
          new T.SpriteMaterial({
            map: label.texture,
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
      ctx.font = "bold 49px Arial";
      ctx.fillText(entry.title, w / 2, 66, w - 80);

      ctx.font = "35px Arial";
      const lines = wrap(ctx, entry.text, w - 100);

      lines.slice(0, 2).forEach((line, index) => {
        ctx.fillText(line, w / 2, 126 + index * 43, w - 80);
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
      /*
       * Die Ausgangszelle plus ihre direkten äußeren Nachbarn.
       * Dadurch sind ALLE 27 dargestellten Zellpositionen bereits
       * am Anfang von sechs Gegenionen umgeben.
       *
       * Randionen gehören gleichzeitig zu benachbarten Zellen.
       * 27 Kugelpositionen im geschlossenen Würfel bedeuten daher
       * nicht 27 vollständig dieser Zelle zugeordnete Ionen.
       */
      const directions = [
        [1, 0, 0], [-1, 0, 0],
        [0, 1, 0], [0, -1, 0],
        [0, 0, 1], [0, 0, -1]
      ];

      const cells = [1, 3, 5, 7];

      function positionsFor(n) {
        const min = 1 - n;
        const max = 1 + n;
        const map = new Map();

        for (let i = min; i <= max; i++) {
          for (let j = min; j <= max; j++) {
            for (let k = min; k <= max; k++) {
              map.set(key(i, j, k), [i, j, k]);
            }
          }
        }

        const interior = Array.from(map.values());

        interior.forEach(([i, j, k]) => {
          directions.forEach(([di, dj, dk]) => {
            const p = [i + di, j + dj, k + dk];
            map.set(key(...p), p);
          });
        });

        return map;
      }

      const initial = new Set();

      for (let i = 0; i <= 2; i++) {
        for (let j = 0; j <= 2; j++) {
          for (let k = 0; k <= 2; k++) {
            initial.add(key(i, j, k));
          }
        }
      }

      const seen = new Set(initial);
      const levels = [
        Array.from(initial).map(value => value.split(",").map(Number))
      ];

      cells.forEach(n => {
        const next = [];

        positionsFor(n).forEach((position, id) => {
          if (seen.has(id)) return;
          seen.add(id);
          next.push(position);
        });

        levels.push(next);
      });

      const sphere = this.ownGeometry(
        new T.SphereGeometry(1, 10, 6)
      );

      this.ionLayers = [];
      this.labels = [];

      levels.forEach((positions, level) => {
        ["Na", "Cl"].forEach(type => {
          const points = positions
            .filter(([i, j, k]) => {
              const sodium = Math.abs((i + j + k) % 2) === 1;
              return type === "Na" ? sodium : !sodium;
            })
            .map(([i, j, k]) => new V(
              (i - 1) / 2,
              (j - 1) / 2,
              (k - 1) / 2
            ));

          if (!points.length) return;

          const material = this.litMaterial(
            type === "Na" ? COLORS.sodium : COLORS.chloride
          );

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
            points.forEach(position => {
              const sprite = new T.Sprite(this.labelMaterials[type]);
              sprite.scale.set(0.225, 0.1125, 1);

              this.atomic.add(sprite);
              this.labels.push({
                sprite,
                center: position.clone(),
                radius
              });
            });
          }
        });
      });

      /*
       * Gemeinsame Gitterlinien statt zwölf Kanten pro Einzelzelle.
       * Damit entstehen keine übereinanderliegenden Zellkanten.
       */
      this.frames = [];

      cells.forEach(n => {
        const min = -n / 2;
        const max = n / 2;
        const vertices = [];

        for (let a = 0; a <= n; a++) {
          for (let b = 0; b <= n; b++) {
            const u = min + a;
            const v = min + b;

            vertices.push(min, u, v, max, u, v);
            vertices.push(u, min, v, u, max, v);
            vertices.push(u, v, min, u, v, max);
          }
        }

        const geometry = this.ownGeometry(new T.BufferGeometry());

        geometry.setAttribute(
          "position",
          new T.Float32BufferAttribute(vertices, 3)
        );

        const material = this.ownMaterial(
          new T.LineBasicMaterial({
            color: "#8d9fac",
            transparent: true,
            opacity: 0.25,
            depthWrite: false
          }),
          0.25
        );

        const frame = new T.LineSegments(geometry, material);
        this.atomic.add(frame);
        this.frames.push({n, frame, material});
      });

      const cube = this.ownGeometry(new T.BoxGeometry(1, 1, 1));
      const edges = this.ownGeometry(new T.EdgesGeometry(cube));

      this.originMaterial = this.ownMaterial(
        new T.LineBasicMaterial({
          color: COLORS.gold,
          transparent: true,
          opacity: 1,
          depthWrite: false
        })
      );

      this.originFrame = new T.LineSegments(
        edges, this.originMaterial
      );

      this.atomic.add(this.originFrame);

      const tintMaterial = this.basicMaterial(COLORS.gold, 0.045);
      this.originTintMaterial = tintMaterial;

      this.originTint = this.mesh(
        cube, tintMaterial, this.atomic
      );
    },

    makeCoordination: function () {
      this.coordination = [];

      const examples = [
        {
          type: "Na",
          center: [1, 1, 1],
          color: COLORS.chloride
        },
        {
          type: "Cl",
          center: [1, 1, 0],
          color: COLORS.sodium
        }
      ];

      const dirs = [
        [1, 0, 0], [-1, 0, 0],
        [0, 1, 0], [0, -1, 0],
        [0, 0, 1], [0, 0, -1]
      ];

      const octEdges = [
        [0, 2], [0, 3], [0, 4], [0, 5],
        [1, 2], [1, 3], [1, 4], [1, 5],
        [2, 4], [2, 5], [3, 4], [3, 5]
      ];

      examples.forEach(example => {
        const center = new V(
          (example.center[0] - 1) / 2,
          (example.center[1] - 1) / 2,
          (example.center[2] - 1) / 2
        );

        const neighbors = dirs.map(d => center.clone().add(
          new V(d[0] / 2, d[1] / 2, d[2] / 2)
        ));

        const vertices = [];

        neighbors.forEach(p => {
          vertices.push(
            center.x, center.y, center.z,
            p.x, p.y, p.z
          );
        });

        octEdges.forEach(([a, b]) => {
          vertices.push(
            neighbors[a].x, neighbors[a].y, neighbors[a].z,
            neighbors[b].x, neighbors[b].y, neighbors[b].z
          );
        });

        const geometry = this.ownGeometry(new T.BufferGeometry());

        geometry.setAttribute(
          "position",
          new T.Float32BufferAttribute(vertices, 3)
        );

        const material = this.ownMaterial(
          new T.LineBasicMaterial({
            color: example.color,
            transparent: true,
            opacity: 0.8,
            depthWrite: false
          }),
          0.8
        );

        const lines = new T.LineSegments(geometry, material);
        this.atomic.add(lines);

        this.coordination.push({
          type: example.type, lines, material
        });
      });
    },

    makeSpecimen: function () {
      const cube = this.ownGeometry(new T.BoxGeometry(1, 1, 1));
      const edges = this.ownGeometry(new T.EdgesGeometry(cube));

      /*
       * Der ausgewählte Kristallit übernimmt die Orientierung
       * des zuvor sichtbaren Ionengitters.
       */
      this.selectedPosition = new V(0, -0.72, 0.18);
      this.selectedSize = 0.16;

      this.selectedMaterial = this.litMaterial("#f3f5f2");

      this.selectedCrystal = this.mesh(
        cube, this.selectedMaterial, this.specimen
      );

      this.selectedCrystal.position.copy(this.selectedPosition);
      this.selectedCrystal.rotation.copy(this.atomic.rotation);
      this.selectedCrystal.scale.setScalar(this.selectedSize);

      this.selectedGoldMaterial = this.ownMaterial(
        new T.LineBasicMaterial({
          color: COLORS.gold,
          transparent: true,
          opacity: 1,
          depthWrite: false
        })
      );

      this.selectedGold = new T.LineSegments(
        edges, this.selectedGoldMaterial
      );

      this.selectedCrystal.add(this.selectedGold);

      /*
       * Vereinfachte weiße Kristallkörner.
       * Deterministisches Muster, keine externe Modell- oder
       * Texturdatei erforderlich.
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

      this.grainMaterial = this.litMaterial("#f9faf7");

      this.grainMesh = new T.InstancedMesh(
        cube, this.grainMaterial, this.grains.length
      );

      this.grainMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      this.grainMesh.frustumCulled = false;
      this.specimen.add(this.grainMesh);

      for (let i = 0; i < this.grains.length; i++) {
        this.grainMesh.setColorAt(
          i,
          new T.Color().setScalar(0.83 + random() * 0.17)
        );
      }

      this.grainMesh.instanceColor.needsUpdate = true;

      /*
       * Becherglas: offene Zylinderwand, Boden, Rand und Ausguss.
       * Keine geschlossene Oberseite.
       * Transparenz ist bewusst vereinfacht.
       */
      this.beaker = new T.Group();
      this.specimen.add(this.beaker);

      this.glassMaterial = this.ownMaterial(
        new T.MeshStandardMaterial({
          color: "#d5e9ed",
          transparent: true,
          opacity: 0.13,
          roughness: 0.16,
          metalness: 0,
          side: T.DoubleSide,
          depthWrite: false
        }),
        0.13
      );

      const wall = this.mesh(
        this.ownGeometry(
          new T.CylinderGeometry(1.02, 0.98, 2.2, 48, 1, true)
        ),
        this.glassMaterial,
        this.beaker
      );

      wall.renderOrder = 3;

      const bottom = this.mesh(
        this.ownGeometry(
          new T.CylinderGeometry(0.98, 0.98, 0.045, 48)
        ),
        this.glassMaterial,
        this.beaker
      );

      bottom.position.y = -1.1;
      bottom.renderOrder = 3;

      this.glassEdgeMaterial = this.basicMaterial("#97b6bf", 0.65);

      const ringGeometry = this.ownGeometry(
        new T.TorusGeometry(1.02, 0.012, 6, 48)
      );

      const upper = this.mesh(
        ringGeometry, this.glassEdgeMaterial, this.beaker
      );

      upper.rotation.x = Math.PI / 2;
      upper.position.y = 1.1;

      const lower = this.mesh(
        ringGeometry, this.glassEdgeMaterial, this.beaker
      );

      lower.rotation.x = Math.PI / 2;
      lower.position.y = -1.08;
      lower.scale.setScalar(0.965);

      const spoutGeometry = this.ownGeometry(new T.BufferGeometry());

      spoutGeometry.setAttribute(
        "position",
        new T.Float32BufferAttribute([
          -0.16, 1.1, -1.00,
          0, 1.14, -1.14,
          0.16, 1.1, -1.00
        ], 3)
      );

      this.spoutMaterial = this.ownMaterial(
        new T.LineBasicMaterial({
          color: "#97b6bf",
          transparent: true,
          opacity: 0.7,
          depthWrite: false
        }),
        0.7
      );

      this.beaker.add(new T.Line(
        spoutGeometry, this.spoutMaterial
      ));

      /*
       * Kleine Striche als schematische Becherglas-Skala.
       * Keine Beschriftung mit erfundenem Probenvolumen.
       */
      const marks = [];

      for (let i = 0; i < 6; i++) {
        const y = -0.65 + i * 0.27;

        marks.push(
          0.18, y, 1.00,
          i % 2 ? 0.28 : 0.38, y, 0.98
        );
      }

      const markGeometry = this.ownGeometry(new T.BufferGeometry());

      markGeometry.setAttribute(
        "position", new T.Float32BufferAttribute(marks, 3)
      );

      this.markMaterial = this.ownMaterial(
        new T.LineBasicMaterial({
          color: "#738e99",
          transparent: true,
          opacity: 0.75,
          depthWrite: false
        }),
        0.75
      );

      this.beaker.add(new T.LineSegments(
        markGeometry, this.markMaterial
      ));
    },

    phaseIndex: function () {
      let phase = 0;

      PHASE_TIMES.forEach((time, index) => {
        if (this.time >= time) phase = index;
      });

      return phase;
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
      const next = PHASE_TIMES.find(value => value > this.time + 0.1);

      this.time = next === undefined ? 0 : next;
      this.paused = true;
      this.updateAnimation(true);
    },

    updateIonInstances: function (scale) {
      this.ionLayers.forEach(layer => {
        const {mesh, points, radius} = layer;

        points.forEach((point, index) => {
          /*
           * Neue Randpositionen werden innerhalb einer festen
           * Darstellungsgrenze eingeblendet.
           * Nur im Übergangsrand werden Kugeln weich verkleinert.
           * Vollständig sichtbare Ionen behalten ihr Größenverhältnis.
           */
          const available = LIMIT / scale - point.length();
          const reveal = clamp(available / radius, 0, 1);

          this.dummy.position.copy(point);
          this.dummy.quaternion.identity();
          this.dummy.scale.setScalar(radius * reveal);
          this.dummy.updateMatrix();

          mesh.setMatrixAt(index, this.dummy.matrix);
        });

        mesh.instanceMatrix.needsUpdate = true;
      });
    },

    updateGrainInstances: function (zoom) {
      const progress = ramp(this.time, 24, 34);
      const focus = this.selectedPosition.clone()
        .multiplyScalar(1 - progress);

      this.specimen.position.copy(focus).multiplyScalar(-zoom);
      this.specimen.scale.setScalar(zoom);

      this.grains.forEach((grain, index) => {
        const distance = grain.position.distanceTo(focus) * zoom;

        /*
         * Begrenzung auf denselben Präsentationsbereich.
         * sqrt(3)/2 ist der Umkugelradius eines Einheitswürfels.
         */
        const boundRadius = grain.size * zoom * Math.sqrt(3) / 2;
        const reveal = clamp(
          (LIMIT - distance) / Math.max(boundRadius, 0.0001),
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

    updateAnimation: function (forceInstances) {
      const t = this.time;

      /*
       * Langsamer Anfang, beschleunigter Wechsel des atomaren
       * Maßstabs. Danach Übergang zum makroskopischen Modell.
       */
      const zoomProgress = clamp((t - 6) / 17, 0, 1);

      const atomicScale = 1.15 * Math.exp(
        Math.log(0.20 / 1.15) * Math.pow(zoomProgress, 1.45)
      );

      this.atomic.scale.setScalar(atomicScale);

      const atomFade = 1 - ramp(t, 19, 23);

      const levelOpacity = [
        1,
        lerp(0.30, 1, ramp(t, 6, 10)),
        ramp(t, 7, 10),
        ramp(t, 11, 14),
        ramp(t, 15, 18)
      ];

      this.ionLayers.forEach(layer => {
        const alpha = levelOpacity[layer.level] * atomFade;

        this.opacity(layer.material, alpha);
        layer.mesh.visible = this.shown && alpha > 0.002;
      });

      this.frames.forEach(({n, frame, material}) => {
        let alpha = 0;

        if (n === 1) alpha = 1 - ramp(t, 8, 11);
        if (n === 3) alpha = ramp(t, 10, 12) * (1 - ramp(t, 14, 16));
        if (n === 5) alpha = ramp(t, 14, 16) * (1 - ramp(t, 18, 20));
        if (n === 7) alpha = ramp(t, 18, 20);

        /*
         * Keine großen Zellrahmen außerhalb des festen Bereichs.
         */
        if (
          n * Math.sqrt(3) / 2 * atomicScale > LIMIT
        ) alpha = 0;

        alpha *= atomFade;
        this.opacity(material, alpha);
        frame.visible = this.shown && alpha > 0.002;
      });

      const originAlpha = 1 - ramp(t, 20, 23);

      this.opacity(this.originMaterial, originAlpha);
      this.opacity(this.originTintMaterial, originAlpha);

      const sodiumCoord =
        ramp(t, 0.7, 1.2) * (1 - ramp(t, 3.0, 3.5));

      const chlorideCoord =
        ramp(t, 3.4, 3.9) * (1 - ramp(t, 5.5, 6.0));

      this.coordination.forEach(entry => {
        const alpha = entry.type === "Na"
          ? sodiumCoord
          : chlorideCoord;

        this.opacity(entry.material, alpha);
        entry.lines.visible = this.shown && alpha > 0.002;
      });

      const labelAlpha = 1 - ramp(t, 7, 10);

      Object.values(this.labelMaterials).forEach(material => {
        this.opacity(material, labelAlpha);
      });

      this.labels.forEach(label => {
        label.sprite.visible = this.shown && labelAlpha > 0.002;
      });

      /*
       * Bei t = 23:
       * 7 Elementarzellen * 0,20 m = 1,40 m Kristallitkante.
       * Der ausgewählte Probenkristallit hat endgültig 0,16
       * Darstellungseinheiten; Zoom 8,75 ergibt dieselbe Kante.
       */
      let specimenZoom;

      if (t <= 23) {
        specimenZoom = 7 * atomicScale / this.selectedSize;
      } else {
        const x = clamp((t - 23) / 11, 0, 1);
        specimenZoom = Math.exp(
          Math.log(8.75) * (1 - ramp(x, 0, 1))
        );
      }

      const crystalAlpha = ramp(t, 19, 23);

      this.opacity(this.selectedMaterial, crystalAlpha);

      this.selectedCrystal.visible =
        this.shown && crystalAlpha > 0.002;

      const selectedGoldAlpha =
        ramp(t, 21, 24) * (1 - ramp(t, 31, 34));

      this.opacity(this.selectedGoldMaterial, selectedGoldAlpha);

      const grainsAlpha = ramp(t, 24, 29);
      this.opacity(this.grainMaterial, grainsAlpha);

      this.grainMesh.visible =
        this.shown && grainsAlpha > 0.002;

      /*
       * Das Glas erscheint erst, wenn es vollständig in den
       * festen Präsentationsbereich passt.
       */
      const specimenProgress = ramp(t, 24, 34);
      const focusLength =
        this.selectedPosition.length() * (1 - specimenProgress);

      const glassFits =
        specimenZoom * (1.60 + focusLength) <= LIMIT;

      const glassAlpha = glassFits ? ramp(t, 32, 34) : 0;

      [
        this.glassMaterial,
        this.glassEdgeMaterial,
        this.spoutMaterial,
        this.markMaterial
      ].forEach(material => this.opacity(material, glassAlpha));

      this.beaker.visible = this.shown && glassAlpha > 0.002;

      if (forceInstances) {
        this.updateIonInstances(atomicScale);
        this.updateGrainInstances(specimenZoom);
      }

      this.visual.visible = this.shown;

      /*
       * Weicher Schleifenwechsel ohne rückwärtslaufende Animation.
       * Endansicht bleibt zuvor mehrere Sekunden bestehen.
       */
      const cycleAlpha =
        ramp(t, 0, 0.65) * (1 - ramp(t, 40, 42));

      const loopFade = this.loop && !this.paused
        ? cycleAlpha
        : 1;

      this.materials.forEach(material => {
        if (
          material === this.quoteMaterial ||
          material === this.phaseMaterial
        ) return;

        material.opacity *= loopFade;
      });

      const phase = this.phaseIndex();
      const state = [
        this.paused,
        this.shown,
        this.loop
      ].join(":");

      if (phase !== this.lastPhase || state !== this.lastState) {
        this.lastPhase = phase;
        this.lastState = state;
        this.drawPhase(phase);
      }
    },

    faceViewer: function (object, eye) {
      const position = object.getWorldPosition(this.direction);

      const angle = Math.atan2(
        eye.x - position.x,
        eye.z - position.z
      );

      object.rotation.set(0, angle, 0);
    },

    updateBillboards: function () {
      const scene = this.el.sceneEl;
      if (!scene || !scene.camera) return;

      scene.camera.getWorldPosition(this.eye);

      /*
       * Raumgebundene Tafeln:
       * nur Drehung um die senkrechte Achse.
       * Kein Mitschwenken mit der Kopfneigung.
       */
      this.faceViewer(this.quote, this.eye);
      this.faceViewer(this.phaseBoard, this.eye);

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

        /*
         * Beschriftung direkt vor der dem Betrachter
         * zugewandten Kugeloberfläche.
         * Sprite-Schrift richtet sich automatisch zur Kamera.
         */
        label.sprite.position.copy(label.center).addScaledVector(
          this.direction, label.radius + 0.014
        );
      });
    },

    tick: function (time, delta) {
      const menuOpen = F.Menu && F.Menu.opened;

      if (!this.paused && this.shown && !menuOpen) {
        const seconds = Math.min((delta || 0) / 1000, 0.05);

        this.time += seconds * this.data.speed;

        if (this.time >= END) {
          if (this.loop) {
            this.time = 0;
            this.lastPhase = -1;
          } else {
            this.time = 34;
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
   *
   * Wrapper wird NACH xray-demo.js installiert.
   * Der vorhandene Builder wird zuerst vollständig ausgeführt.
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
     * Keine .interactable-, .model-visual- oder .paintable-Klasse.
     * Die Animation wird nicht gegriffen, gezeichnet oder als
     * Raumwahlfläche behandelt.
     */
    return result;
  };

  /*
   * ============================================================
   * BESTEHENDES MENÜ ERGÄNZEN
   *
   * Im Begrüßungsraum wird der bisherige Bedienhilfe-Button
   * zur Animation-Unterseite. Die normale Bedienhilfe bleibt
   * dort weiterhin erreichbar.
   *
   * In Vorlesung 5 bleibt der Röntgenmenü-Wrapper zuständig.
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
        ctx.fillRect(item.x, item.y + 5, item.w, item.h);

        ctx.fillStyle = pressed ? "#bba466" : "#efe0b8";
        ctx.fillRect(
          item.x, item.y + offset, item.w, item.h
        );

        ctx.strokeStyle = "#a9bcae";
        ctx.lineWidth = 2;
        ctx.strokeRect(
          item.x, item.y + offset, item.w, item.h
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
    ctx.fillText("Vom Ionengitter zur Salzprobe", 55, 75, 914);

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
      ctx.fillText(label, x + 22, y + 46 + offset, w - 44);

      this.buttons.push({x, y, w, h, label, action});
      y += 86;
    };

    button(
      demo.paused ? "Animation starten / fortsetzen" : "Animation pausieren",
      () => {
        if (!demo.shown) demo.setShown(true);

        demo.paused = !demo.paused;
        demo.updateAnimation(true);

        feedback(
          this,
          demo.paused ? "Animation pausiert." : "Animation läuft."
        );
      },
      "#efe0b8"
    );

    button(
      "Zum Anfang — anschließend pausiert",
      () => {
        demo.restart();
        feedback(this, "Ausgangszelle wird angezeigt. Animation pausiert.");
      }
    );

    button(
      "Nächste Phase — anschließend pausiert",
      () => {
        demo.nextPhase();
        feedback(this, "Nächste Phase angezeigt. Animation pausiert.");
      }
    );

    button(
      "Geschwindigkeit: " + demo.data.speed + "×",
      () => {
        const speeds = [0.5, 1, 2];
        const index = speeds.indexOf(demo.data.speed);
        const next = speeds[(index + 1) % speeds.length];

        demo.el.setAttribute("fkc-welcome-demo", "speed", next);
        feedback(this, "Geschwindigkeit: " + next + "×");
      },
      "#cddff3"
    );

    button(
      "Automatische Wiederholung: " + (demo.loop ? "an" : "aus"),
      () => {
        demo.loop = !demo.loop;

        feedback(
          this,
          demo.loop
            ? "Wiederholung eingeschaltet."
            : "Wiederholung aus. Die Animation endet bei der Salzprobe."
        );
      }
    );

    button(
      demo.shown ? "Animation ausblenden" : "Animation einblenden",
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
      "B/Y schließt · NaCl-Begrüßungsanimation · Version Willkommen-1",
      55, 1160, 914
    );

    this.texture.needsUpdate = true;
  };
})(window.FKCVR);
