"use strict";

(function (F) {
  /*
   * ============================================================
   * WILLKOMMEN-10 — STABILERE VR-BESCHRIFTUNGEN
   * ============================================================
   *
   * Gegenüber Willkommen-9:
   * - Mipmaps für Na/Cl, Zellparameter und Ursprung O.
   * - Kräftigere kleine Schrift.
   * - Eindeutige Zeichenreihenfolge der Beschriftungen.
   * - Ionenschrift als erklärende Überlagerung:
   *   keine wechselnde Verdeckung durch Kugeloberflächen.
   * - Etwas größerer Abstand der Ionenschrift zur Kugel.
   *
   * Unverändert:
   * - Animationszeiten und durchgehender logarithmischer Zoom.
   * - Fester Präsentationsmittelpunkt.
   * - Absenkung des geschlossenen Einkristalliten.
   * - Gitter, Füllung, Salzprobe und Becherglas.
   * - Podest, Tafeln, Menü und Raumgrenzen.
   *
   * Fachlich:
   * NaCl, Fm-3m, Nr. 225, konventionelle Zelle Z = 4.
   * Cl auf 4a; Na auf 4b; beide sechsfach koordiniert.
   * 27 dargestellte Positionen sind nicht 27 ganze Ionen
   * pro Elementarzelle.
   * Zellparameter: gerundeter Raumtemperatur-Richtwert,
   * keine Messung an einer bestimmten Probe.
   * ============================================================
   */

  if (!F || !F.RoomBuilder || !F.Menu || !window.AFRAME) {
    console.error(
      "Willkommen-10: A-Frame, room-builder.js und vr-tools.js " +
      "müssen vorher geladen sein."
    );
    return;
  }

  const T = window.AFRAME.THREE;
  const V = T.Vector3;

  const EXTRA_START_TIME = 4;
  const END = 50;
  const BOUND = 1.34;

  const TABLE_RADIUS = 2.45;
  const TABLE_TOP = 0.85;
  const SURFACE_GAP = 0.035;

  const INFO_DISTANCE = 2.82;
  const INFO_Y = 0.48;

  const FILLED_CENTER_LIMIT = 4.5;
  const FILLED_HALF_TILE = 0.25;
  const FILLED_SPAN = 9.5;
  const SELECTED_SIZE = 0.16;

  const ZOOM_START = 2;
  const ZOOM_END = 34;
  const PREVIOUS_START_SCALE = 1.10;
  const FINAL_SCALE = SELECTED_SIZE / FILLED_SPAN;

  const ZOOM_RATE =
    Math.log(PREVIOUS_START_SCALE / FINAL_SCALE) / 28;

  const START_SCALE =
    PREVIOUS_START_SCALE *
    Math.exp(ZOOM_RATE * EXTRA_START_TIME);

  const FILL_START = 21;
  const FILL_END = 25.5;
  const BOX_START = 22.5;
  const BOX_END = 25.5;
  const SOLID_SWITCH = 26;
  const DESCENT_START = 26;
  const DESCENT_END = 34;
  const BEAKER_BOTTOM_Y = -1.1325;

  const ORIGIN_EDGE_RADIUS = 0.008;
  const GRID_EDGE_RADIUS = 0.0045;

  /*
   * Kleine Schrift ist eine erklärende Überlagerung.
   * Feste renderOrder-Werte verhindern wechselnde
   * Sortierung, wenn sich Beschriftungen überdecken.
   */
  const ION_TEXT_ORDER = 20;
  const PARAMETER_TEXT_ORDER = 60;
  const ION_TEXT_SURFACE_GAP = 0.025;

  const CELL_PARAMETER_TEXT = "≈ 5,64 Å";

  const COLORS = {
    sodium: "#a345ff",
    chloride: "#18dc56",
    gold: "#f1c45b",
    paper: "#fffdf5",
    ink: "#202a2e",
    white: "#ffffff"
  };

  const PHASE_TIMES = [
    0, 10, 14, 19, 24, 28, 34, 42
  ];

  const PHASES = [
    {
      title: "NaCl · eine einzelne Elementarzelle",
      forward:
        "Kubisch · a = b = c ≈ 5,64 Å bei Raumtemperatur · Z = 4",
      reverse:
        "Die einzelne Elementarzelle: a = b = c ≈ 5,64 Å; äußere Nachbarn sind ausgeblendet."
    },
    {
      title: "Elementarzelle und Nachbarionen",
      forward:
        "Äußere Nachbarn werden sichtbar; Na⁺ und Cl⁻ sind jeweils sechsfach koordiniert.",
      reverse:
        "Wir zoomen weiter hinein; äußere Nachbarionen treten aus dem Ausschnitt."
    },
    {
      title: "Periodische Ordnung · 3 × 3 × 3 Zellen",
      forward:
        "Ein größerer Ausschnitt wird sichtbar — kein Kristallwachstum.",
      reverse:
        "Wir zoomen zur goldmarkierten Ausgangszelle hinein."
    },
    {
      title: "Periodische Ordnung · 6 × 6 × 6 Zellen",
      forward:
        "Der goldene Rahmen kennzeichnet weiterhin die Ausgangszelle.",
      reverse:
        "Die einzelnen Zellen werden beim Hineinzoomen wieder größer."
    },
    {
      title: "Periodische Ordnung · 9 × 9 × 9 Zellen",
      forward:
        "Beim Herauszoomen werden die einzelnen Zellen und Ionen kleiner.",
      reverse:
        "Das Ionengitter wird sichtbar; Grün und Lila sind Modellfarben."
    },
    {
      title: "Vom Ionengitter zum Einkristallit",
      reverseTitle: "Vom Einkristallit zum Ionengitter",
      forward:
        "Dieselben weißen Kugeln füllen die Zwischenräume — ein Darstellungswechsel.",
      reverse:
        "Am festen Mittelpunkt öffnet sich die Darstellung wieder zu einzelnen Kugeln."
    },
    {
      title: "Viele unterschiedlich orientierte Kristallite",
      reverseTitle: "Hineinzoomen in einen ausgewählten Kristalliten",
      forward:
        "Der geschlossene Kristallit sinkt langsam zur körnigen Salzprobe.",
      reverse:
        "Der goldmarkierte Kristallit steigt zum festen Präsentationsmittelpunkt."
    },
    {
      title: "NaCl · eine körnige Feststoffprobe",
      forward:
        "Weiße Salzprobe im schematischen 500-mL-Becherglas.",
      reverse:
        "Ausgehend von der Salzprobe zoomen wir wieder bis zur Elementarzelle hinein."
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
    const el = document.getElementById(
      "fkc-welcome-experiment"
    );

    return el &&
      el.components &&
      el.components["fkc-welcome-demo"];
  }

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

    Array.from(map.values()).forEach(([i, j, k]) => {
      DIRECTIONS.forEach(([di, dj, dk]) => {
        const p = [i + di, j + dj, k + dk];
        map.set(key(...p), p);
      });
    });

    return map;
  }

  window.AFRAME.registerComponent("fkc-welcome-demo", {
    schema: {
      speed: {type: "number", default: 1}
    },

    init: function () {
      this.time = 0;
      this.playDirection = 1;
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
      this.selectedCenter = new V();

      this.dummy = new T.Object3D();
      this.whiteColor = new T.Color(COLORS.white);

      this.lastPhase = -1;
      this.lastState = "";
      this.lastInstanceUpdate = -1000;
      this.lastGeometryTime = NaN;
      this.lastBoxAmount = NaN;

      this.root = new T.Group();
      this.el.setObject3D("welcome-demo", this.root);

      this.visual = new T.Group();
      this.root.add(this.visual);

      this.atomic = new T.Group();
      this.atomic.rotation.set(0.18, 0.42, -0.04);
      this.visual.add(this.atomic);

      this.atomicQuaternion = this.atomic.quaternion.clone();

      const matrix = new T.Matrix4()
        .makeRotationFromQuaternion(this.atomicQuaternion);

      const e = matrix.elements;

      const rotatedVerticalExtent = BOUND * (
        Math.abs(e[1]) +
        Math.abs(e[5]) +
        Math.abs(e[9])
      );

      this.presentationCenter = new V(
        0,
        TABLE_TOP +
          SURFACE_GAP +
          rotatedVerticalExtent +
          0.04,
        0
      );

      this.atomic.position.copy(this.presentationCenter);

      this.specimen = new T.Group();
      this.visual.add(this.specimen);

      this.edgeRodGeometry = this.ownGeometry(
        new T.CylinderGeometry(1, 1, 1, 8)
      );

      this.makePodium();
      this.makeTypography();
      this.makeLattice();
      this.makeCellParameters();
      this.makeCoordination();
      this.makeSpecimen();

      this.updateAnimation(true);
      this.updateBillboards();
    },

    storyTime: function () {
      return this.time <= 10
        ? this.time * 0.6
        : this.time - 4;
    },

    stageTime: function () {
      return this.storyTime() - EXTRA_START_TIME;
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

    /*
     * Große Tafeln behalten ihre bisherigen Einstellungen.
     * Kleine statische Schrift bekommt eine vollständige
     * Mipmap-Kette und trilineare Minifizierung.
     *
     * Alle dafür verwendeten Texturen haben Zweierpotenzmaße.
     */
    makeTexture: function (width, height, draw, smallText) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      draw(canvas.getContext("2d"), width, height);

      const texture = new T.CanvasTexture(canvas);

      texture.magFilter = T.LinearFilter;
      texture.minFilter = smallText
        ? T.LinearMipmapLinearFilter
        : T.LinearFilter;

      texture.generateMipmaps = !!smallText;
      texture.wrapS = T.ClampToEdgeWrapping;
      texture.wrapT = T.ClampToEdgeWrapping;
      texture.anisotropy = 1;

      this.textures.add(texture);

      return {canvas, texture};
    },

    /*
     * Einheitliche stabile Einstellungen für kleine Schrift.
     * Kein Tiefenschreiben und keine Tiefenprüfung:
     * Beschriftungen sind erklärende Überlagerungen.
     *
     * Kein alphaTest: Die bestehende weiche Ausblendung
     * soll auch an feinen Buchstabenkanten weich bleiben.
     */
    textSpriteMaterial: function (texture) {
      return this.ownMaterial(
        new T.SpriteMaterial({
          map: texture,
          color: "#ffffff",
          transparent: true,
          opacity: 1,
          depthTest: false,
          depthWrite: false,
          toneMapped: false
        })
      );
    },

    mesh: function (geometry, material, parent) {
      const mesh = new T.Mesh(geometry, material);
      parent.add(mesh);
      return mesh;
    },

    basic: function (color, opacity) {
      const alpha = opacity === undefined ? 1 : opacity;

      return this.ownMaterial(
        new T.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: alpha,
          side: T.DoubleSide,
          depthWrite: false
        }),
        alpha
      );
    },

    lit: function (color, opacity) {
      const alpha = opacity === undefined ? 1 : opacity;

      const material = this.ownMaterial(
        new T.MeshStandardMaterial({
          color,
          roughness: 0.4,
          metalness: 0,
          transparent: alpha < 0.999,
          opacity: alpha,
          depthWrite: alpha >= 0.999
        }),
        alpha
      );

      material.userData.welcomeSolid = true;
      return material;
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

    setAlpha: function (material, alpha) {
      const base = this.baseOpacity.get(material);

      material.opacity =
        (base === undefined ? 1 : base) *
        clamp(alpha, 0, 1);

      material.visible = material.opacity > 0.001;

      if (material.userData.welcomeSolid) {
        const transparent = material.opacity < 0.999;

        if (material.transparent !== transparent) {
          material.transparent = transparent;
          material.needsUpdate = true;
        }

        material.depthWrite = !transparent;
      }
    },

    makeRodSegments: function (
      segments, radius, material, parent
    ) {
      const mesh = new T.InstancedMesh(
        this.edgeRodGeometry,
        material,
        segments.length
      );

      const up = new V(0, 1, 0);
      const delta = new V();
      const midpoint = new V();

      segments.forEach(([start, end], index) => {
        delta.copy(end).sub(start);
        const length = delta.length();

        midpoint.copy(start).add(end).multiplyScalar(0.5);

        this.dummy.position.copy(midpoint);
        this.dummy.quaternion.setFromUnitVectors(
          up, delta.normalize()
        );
        this.dummy.scale.set(radius, length, radius);
        this.dummy.updateMatrix();

        mesh.setMatrixAt(index, this.dummy.matrix);
      });

      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
      parent.add(mesh);

      return mesh;
    },

    makePodium: function () {
      this.podium = new T.Group();
      this.root.add(this.podium);

      const stone = this.ownMaterial(
        new T.MeshStandardMaterial({
          color: "#eee9de",
          roughness: 0.66,
          metalness: 0
        })
      );

      const topMaterial = this.ownMaterial(
        new T.MeshStandardMaterial({
          color: "#fffdf8",
          roughness: 0.48,
          metalness: 0
        })
      );

      const goldMaterial = this.ownMaterial(
        new T.MeshStandardMaterial({
          color: "#c5a052",
          roughness: 0.4,
          metalness: 0.45
        })
      );

      const base = this.mesh(
        this.ownGeometry(
          new T.CylinderGeometry(1.83, 1.94, 0.12, 64)
        ),
        stone,
        this.podium
      );
      base.position.y = 0.066;

      const body = this.mesh(
        this.ownGeometry(
          new T.CylinderGeometry(1.7, 1.78, 0.60, 64)
        ),
        stone,
        this.podium
      );
      body.position.y = 0.426;

      const rim = this.mesh(
        this.ownGeometry(
          new T.CylinderGeometry(
            TABLE_RADIUS - 0.015,
            TABLE_RADIUS - 0.015,
            0.035,
            96
          )
        ),
        goldMaterial,
        this.podium
      );
      rim.position.y = 0.7475;

      const top = this.mesh(
        this.ownGeometry(
          new T.CylinderGeometry(
            TABLE_RADIUS,
            TABLE_RADIUS,
            0.085,
            96
          )
        ),
        topMaterial,
        this.podium
      );
      top.position.y = TABLE_TOP - 0.085 / 2;
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
      this.quote.position.set(0, 4.43, 0);

      this.phaseTexture = this.makeTexture(
        1536, 300, () => {}
      );

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
      this.phaseBoard.position.set(0, INFO_Y, INFO_DISTANCE);

      this.labelMaterials = {};

      [
        ["Na", "Na⁺"],
        ["Cl", "Cl⁻"]
      ].forEach(([id, text]) => {
        const texture = this.makeTexture(
          512, 256, (ctx, w, h) => {
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = "#000000";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            /*
             * Doppelte Texturauflösung, gleiche physische Größe.
             * Ein dezenter schwarzer Konturstrich stärkt
             * besonders die kleinen Ladungszeichen.
             */
            ctx.font = "bold 176px Arial";
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 2.5;
            ctx.lineJoin = "round";

            ctx.strokeText(text, w / 2, h / 2 + 6);
            ctx.fillText(text, w / 2, h / 2 + 6);
          },
          true
        );

        this.labelMaterials[id] =
          this.textSpriteMaterial(texture.texture);
      });
    },

    drawPhase: function (phase) {
      const canvas = this.phaseTexture.canvas;
      const ctx = canvas.getContext("2d");
      const w = canvas.width;
      const h = canvas.height;

      const entry = PHASES[phase];
      const backward = this.playDirection < 0;

      ctx.fillStyle = COLORS.paper;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 7;
      ctx.strokeRect(5, 5, w - 10, h - 10);

      ctx.fillStyle = COLORS.ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 48px Arial";

      ctx.fillText(
        backward && entry.reverseTitle
          ? entry.reverseTitle
          : entry.title,
        w / 2, 64, w - 80
      );

      ctx.font = "35px Arial";

      const text = backward ? entry.reverse : entry.forward;
      const lines = wrap(ctx, text, w - 100);

      lines.slice(0, 2).forEach((line, index) => {
        ctx.fillText(
          line, w / 2, 124 + index * 43, w - 80
        );
      });

      const state = !this.shown
        ? "Ausgeblendet"
        : this.paused
          ? "Pausiert"
          : "Animation läuft";

      ctx.fillStyle = "#776441";
      ctx.font = "29px Arial";
      ctx.fillText(
        state + " · " +
        (backward ? "Hineinzoomen" : "Herauszoomen") +
        " · B/Y → Animationsmenü",
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

      [1, 3, 6, 9].forEach(n => {
        const next = [];

        latticePositions(n).forEach((position, id) => {
          if (seen.has(id)) return;
          seen.add(id);
          next.push(position);
        });

        levels.push(next);
      });

      this.ionGeometry = this.ownGeometry(
        new T.BoxGeometry(2, 2, 2, 4, 4, 4)
      );

      this.ionBoxPositions = new Float32Array(
        this.ionGeometry.attributes.position.array
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

          const color = type === "Na"
            ? COLORS.sodium
            : COLORS.chloride;

          const material = this.lit(color);
          material.emissive.set(color);
          material.emissiveIntensity = 0.15;

          const mesh = new T.InstancedMesh(
            this.ionGeometry,
            material,
            points.length
          );

          mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
          mesh.frustumCulled = false;
          this.atomic.add(mesh);

          const radius = type === "Na" ? 0.115 : 0.165;

          this.ionLayers.push({
            mesh,
            material,
            points,
            radius,
            level,
            originalColor: new T.Color(color)
          });

          if (level === 0) {
            points.forEach(center => {
              const sprite = new T.Sprite(
                this.labelMaterials[type]
              );

              const width = type === "Na" ? 0.19 : 0.25;

              sprite.scale.set(width, width / 2, 1);

              /*
               * Jede der 27 Beschriftungen hat eine eigene,
               * unveränderliche Sortierposition.
               */
              sprite.renderOrder =
                ION_TEXT_ORDER + this.labels.length;

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

      this.frames = [];

      [3, 6, 9].forEach(n => {
        const bounds = cellBounds(n);
        const segments = [];

        for (let a = 0; a <= n; a++) {
          for (let b = 0; b <= n; b++) {
            const u = bounds.min + a;
            const v = bounds.min + b;

            segments.push(
              [
                new V(bounds.min, u, v),
                new V(bounds.max, u, v)
              ],
              [
                new V(u, bounds.min, v),
                new V(u, bounds.max, v)
              ],
              [
                new V(u, v, bounds.min),
                new V(u, v, bounds.max)
              ]
            );
          }
        }

        const material = this.lit("#93b3c5", 0.94);

        const frame = this.makeRodSegments(
          segments,
          GRID_EDGE_RADIUS,
          material,
          this.atomic
        );

        this.frames.push({n, bounds, frame, material});
      });

      const originSegments = [];

      [-0.5, 0.5].forEach(u => {
        [-0.5, 0.5].forEach(v => {
          originSegments.push(
            [
              new V(-0.5, u, v),
              new V(0.5, u, v)
            ],
            [
              new V(u, -0.5, v),
              new V(u, 0.5, v)
            ],
            [
              new V(u, v, -0.5),
              new V(u, v, 0.5)
            ]
          );
        });
      });

      this.originMaterial = this.lit(COLORS.gold);

      this.originFrame = this.makeRodSegments(
        originSegments,
        ORIGIN_EDGE_RADIUS,
        this.originMaterial,
        this.atomic
      );

      const cube = this.ownGeometry(
        new T.BoxGeometry(1, 1, 1)
      );

      this.originTintMaterial = this.basic(COLORS.gold, 0.10);

      this.originTint = this.mesh(
        cube,
        this.originTintMaterial,
        this.atomic
      );
    },

    makeParameterSprite: function (
      letter, position, width, order
    ) {
      const texture = this.makeTexture(
        1024, 512, (ctx, w, h) => {
          ctx.clearRect(0, 0, w, h);
          ctx.fillStyle = "#000000";
          ctx.strokeStyle = "#000000";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.lineJoin = "round";
          ctx.lineWidth = 3;

          ctx.font = "bold italic 216px Georgia";
          ctx.strokeText(letter, w / 2, 150);
          ctx.fillText(letter, w / 2, 150);

          ctx.font = "bold 132px Arial";
          ctx.strokeText(
            CELL_PARAMETER_TEXT, w / 2, 362
          );
          ctx.fillText(
            CELL_PARAMETER_TEXT, w / 2, 362
          );
        },
        true
      );

      const material =
        this.textSpriteMaterial(texture.texture);

      const sprite = new T.Sprite(material);
      sprite.position.copy(position);
      sprite.scale.set(width, width / 2, 1);
      sprite.renderOrder = order;

      this.cellParameters.add(sprite);
      this.parameterMaterials.push(material);

      return sprite;
    },

    makeCellParameters: function () {
      this.cellParameters = new T.Group();
      this.atomic.add(this.cellParameters);

      this.parameterMaterials = [];

      const origin = new V(-0.5, -0.5, -0.5);

      const definitions = [
        {
          letter: "a",
          direction: new V(1, 0, 0),
          label: new V(0, -0.68, -0.68)
        },
        {
          letter: "b",
          direction: new V(0, 1, 0),
          label: new V(-0.71, 0, -0.65)
        },
        {
          letter: "c",
          direction: new V(0, 0, 1),
          label: new V(-0.68, -0.68, 0)
        }
      ];

      definitions.forEach((definition, index) => {
        const arrow = new T.ArrowHelper(
          definition.direction,
          origin,
          1,
          0x202a2e,
          0.13,
          0.075
        );

        /*
         * ArrowHelper erzeugt pro Instanz eigene Materialien.
         * Sie werden direkt verwaltet und später freigegeben.
         * Seine gemeinsam genutzten Geometrien bleiben unangetastet.
         */
        arrow.line.material.transparent = true;
        arrow.line.material.depthTest = false;
        arrow.line.material.depthWrite = false;

        arrow.cone.material.transparent = true;
        arrow.cone.material.depthTest = false;
        arrow.cone.material.depthWrite = false;

        arrow.line.renderOrder = 10 + index * 2;
        arrow.cone.renderOrder = 11 + index * 2;

        this.ownMaterial(arrow.line.material);
        this.ownMaterial(arrow.cone.material);

        this.parameterMaterials.push(
          arrow.line.material,
          arrow.cone.material
        );

        this.cellParameters.add(arrow);

        this.makeParameterSprite(
          definition.letter,
          definition.label,
          0.39,
          PARAMETER_TEXT_ORDER + index
        );
      });

      const originTexture = this.makeTexture(
        512, 256, (ctx, w, h) => {
          ctx.clearRect(0, 0, w, h);
          ctx.fillStyle = "#000000";
          ctx.strokeStyle = "#000000";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = "bold 156px Arial";
          ctx.lineWidth = 2.5;
          ctx.lineJoin = "round";
          ctx.strokeText("O", w / 2, h / 2);
          ctx.fillText("O", w / 2, h / 2);
        },
        true
      );

      const originMaterial =
        this.textSpriteMaterial(originTexture.texture);

      const originLabel = new T.Sprite(originMaterial);
      originLabel.position.set(-0.70, -0.73, -0.70);
      originLabel.scale.set(0.16, 0.08, 1);
      originLabel.renderOrder = PARAMETER_TEXT_ORDER + 3;

      this.cellParameters.add(originLabel);
      this.parameterMaterials.push(originMaterial);
    },

    updateIonGeometry: function (t) {
      const boxAmount = ramp(t, BOX_START, BOX_END);
      if (boxAmount === this.lastBoxAmount) return;

      this.lastBoxAmount = boxAmount;

      const attr = this.ionGeometry.attributes.position;
      const source = this.ionBoxPositions;

      for (let i = 0; i < attr.count; i++) {
        const x = source[i * 3];
        const y = source[i * 3 + 1];
        const z = source[i * 3 + 2];
        const length = Math.sqrt(x * x + y * y + z * z);

        attr.setXYZ(
          i,
          lerp(x / length, x, boxAmount),
          lerp(y / length, y, boxAmount),
          lerp(z / length, z, boxAmount)
        );
      }

      attr.needsUpdate = true;
      this.ionGeometry.computeVertexNormals();
      this.ionGeometry.computeBoundingSphere();
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

        const neighbors = DIRECTIONS.map(d =>
          center.clone().add(
            new V(d[0] / 2, d[1] / 2, d[2] / 2)
          )
        );

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

        const material = this.lineMaterial(example.color, 1);
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
      this.selectedSize = SELECTED_SIZE;

      this.selectedMaterial = this.lit(COLORS.white);
      this.selectedMaterial.roughness = 0.4;
      this.selectedMaterial.emissive.set("#ffffff");
      this.selectedMaterial.emissiveIntensity = 0.08;

      this.selectedCrystal = this.mesh(
        cube,
        this.selectedMaterial,
        this.specimen
      );

      this.selectedCrystal.position.copy(this.selectedPosition);
      this.selectedCrystal.rotation.copy(this.atomic.rotation);
      this.selectedCrystal.scale.setScalar(this.selectedSize);

      this.selectedGoldMaterial =
        this.lineMaterial(COLORS.gold, 1);

      this.selectedGold = new T.LineSegments(
        edges,
        this.selectedGoldMaterial
      );
      this.selectedCrystal.add(this.selectedGold);

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
        cube,
        this.grainMaterial,
        this.grains.length
      );
      this.grainMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      this.grainMesh.frustumCulled = false;
      this.specimen.add(this.grainMesh);

      for (let i = 0; i < this.grains.length; i++) {
        this.grainMesh.setColorAt(
          i,
          new T.Color().setScalar(0.91 + random() * 0.09)
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
          opacity: 0.43,
          roughness: 0.2,
          metalness: 0,
          side: T.DoubleSide,
          depthWrite: false
        }),
        0.43
      );

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

        const weight = spoutWeight(Math.atan2(x, z));
        const top = ramp(y, 0.65, 1.1);
        const radial = Math.sqrt(x * x + z * z);
        const factor =
          (radial + 0.23 * weight * top) / radial;

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
          opacity: 0.60,
          roughness: 0.24,
          side: T.DoubleSide,
          depthWrite: false
        }),
        0.60
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

      this.glassEdgeMaterial = this.basic("#c6e7f5", 1);

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
              ctx.fillText(String(500 - i * 50), 165, y);
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

    atomicScale: function (t) {
      const elapsed = clamp(
        t - ZOOM_START,
        0,
        ZOOM_END - ZOOM_START
      );

      return START_SCALE * Math.exp(-ZOOM_RATE * elapsed);
    },

    focusProgress: function (t) {
      return ramp(t, DESCENT_START, DESCENT_END);
    },

    updateModelPositions: function (t, scale, zoom) {
      this.visual.position.set(0, 0, 0);
      this.atomic.position.copy(this.presentationCenter);
      this.atomic.scale.setScalar(scale);

      const progress = this.focusProgress(t);

      if (t <= DESCENT_START) {
        this.selectedCenter.copy(this.presentationCenter);
      } else {
        const restingCenterY =
          TABLE_TOP +
          SURFACE_GAP +
          (
            this.selectedPosition.y - BEAKER_BOTTOM_Y
          ) * zoom;

        this.selectedCenter.set(
          lerp(
            this.presentationCenter.x,
            this.selectedPosition.x,
            progress
          ),
          lerp(
            this.presentationCenter.y,
            restingCenterY,
            progress
          ),
          lerp(
            this.presentationCenter.z,
            this.selectedPosition.z,
            progress
          )
        );
      }

      this.specimen.position
        .copy(this.selectedCenter)
        .addScaledVector(this.selectedPosition, -zoom);

      this.specimen.scale.setScalar(zoom);
    },

    setShown: function (shown) {
      this.shown = !!shown;
      if (!this.shown) this.paused = true;
      this.updateAnimation(true);
    },

    restart: function () {
      this.time = 0;
      this.playDirection = 1;
      this.paused = true;
      this.lastPhase = -1;
      this.updateAnimation(true);
    },

    reverseDirection: function () {
      this.playDirection *= -1;
      this.updateAnimation(true);
    },

    nextPhase: function () {
      if (this.playDirection > 0) {
        const next = PHASE_TIMES.find(
          value => value > this.time + 0.1
        );
        this.time = next === undefined ? END : next;
      } else {
        const previous = PHASE_TIMES
          .slice()
          .reverse()
          .find(value => value < this.time - 0.1);

        this.time = previous === undefined ? 0 : previous;
      }

      this.paused = true;
      this.updateAnimation(true);
    },

    updateIonInstances: function (scale, t) {
      const fill = ramp(t, FILL_START, FILL_END);
      const outerNeighborFactor = 1 - ramp(t, 20, 24.5);

      this.ionLayers.forEach(layer => {
        const targetRadius = lerp(
          layer.radius,
          FILLED_HALF_TILE,
          fill
        );

        layer.points.forEach((point, index) => {
          const edge = Math.max(
            Math.abs(point.x),
            Math.abs(point.y),
            Math.abs(point.z)
          );

          const available = BOUND / scale - edge;

          const reveal = clamp(
            available / Math.max(targetRadius, 0.00001),
            0,
            1
          );

          const isOuterNeighbor =
            edge > FILLED_CENTER_LIMIT + 0.00001;

          const neighborFactor = isOuterNeighbor
            ? outerNeighborFactor
            : 1;

          const radius =
            targetRadius * reveal * neighborFactor;

          this.dummy.position.copy(point);
          this.dummy.quaternion.identity();
          this.dummy.scale.setScalar(radius);
          this.dummy.updateMatrix();

          layer.mesh.setMatrixAt(index, this.dummy.matrix);
        });

        layer.mesh.instanceMatrix.needsUpdate = true;
      });
    },

    updateGrainInstances: function (zoom, t) {
      const progress = this.focusProgress(t);

      const focus = this.tempPosition
        .copy(this.selectedPosition)
        .multiplyScalar(1 - progress);

      this.grains.forEach((grain, index) => {
        const distance =
          grain.position.distanceTo(focus) * zoom;

        const radius =
          grain.size * zoom * Math.sqrt(3) / 2;

        const reveal = clamp(
          (1.65 - distance) / Math.max(radius, 0.0001),
          0,
          1
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
      const t = this.stageTime();
      const scale = this.atomicScale(t);
      const specimenZoom =
        FILLED_SPAN * scale / this.selectedSize;

      this.updateModelPositions(t, scale, specimenZoom);

      const whitening = ramp(t, 18.5, 22);

      const levelAlpha = [
        1,
        ramp(t, 2, 4),
        ramp(t, 6.5, 9),
        ramp(t, 11, 14),
        ramp(t, 16, 18)
      ];

      this.ionLayers.forEach(layer => {
        layer.material.color
          .copy(layer.originalColor)
          .lerp(this.whiteColor, whitening);

        layer.material.emissive
          .copy(layer.originalColor)
          .lerp(this.whiteColor, whitening);

        layer.material.emissiveIntensity =
          lerp(0.15, 0.08, whitening);

        this.setAlpha(
          layer.material,
          levelAlpha[layer.level]
        );

        layer.mesh.visible = layer.material.visible;
      });

      this.frames.forEach(entry => {
        let alpha = 0;

        if (entry.n === 3) {
          alpha =
            ramp(t, 8, 9.5) *
            (1 - ramp(t, 13, 15));
        } else if (entry.n === 6) {
          alpha =
            ramp(t, 13, 15) *
            (1 - ramp(t, 17.5, 19));
        } else {
          alpha =
            ramp(t, 17.5, 19) *
            (1 - ramp(t, 20, 22));
        }

        const extent = Math.max(
          Math.abs(entry.bounds.min),
          Math.abs(entry.bounds.max)
        );

        if (
          (extent + GRID_EDGE_RADIUS) * scale > BOUND
        ) alpha = 0;

        this.setAlpha(entry.material, alpha);
        entry.frame.visible = entry.material.visible;
      });

      const originAlpha = 1 - ramp(t, 24, 26);

      this.setAlpha(this.originMaterial, originAlpha);
      this.setAlpha(this.originTintMaterial, originAlpha);

      this.originFrame.visible = this.originMaterial.visible;
      this.originTint.visible = this.originTintMaterial.visible;

      const parameterAlpha = 1 - ramp(t, 2, 4);

      this.parameterMaterials.forEach(material => {
        this.setAlpha(material, parameterAlpha);
      });
      this.cellParameters.visible = parameterAlpha > 0.001;

      const sodiumCoord =
        ramp(t, 2.3, 2.8) *
        (1 - ramp(t, 3.4, 3.8));

      const chlorideCoord =
        ramp(t, 4, 4.5) *
        (1 - ramp(t, 5.5, 6));

      this.coordination.forEach(entry => {
        this.setAlpha(
          entry.material,
          entry.type === "Na" ? sodiumCoord : chlorideCoord
        );

        entry.lines.visible = entry.material.visible;
      });

      const labelAlpha = 1 - ramp(t, 7, 10);

      Object.values(this.labelMaterials).forEach(material => {
        this.setAlpha(material, labelAlpha);
      });

      this.labels.forEach(label => {
        label.sprite.visible = labelAlpha > 0.001;
      });

      this.atomic.visible = t < SOLID_SWITCH;

      this.setAlpha(this.selectedMaterial, 1);
      this.selectedCrystal.visible = t >= SOLID_SWITCH;

      this.setAlpha(
        this.selectedGoldMaterial,
        ramp(t, 26, 27) *
        (1 - ramp(t, 31.5, 34))
      );
      this.selectedGold.visible =
        this.selectedGoldMaterial.visible;

      this.setAlpha(this.grainMaterial, ramp(t, 27, 30));
      this.grainMesh.visible = this.grainMaterial.visible;

      const progress = this.focusProgress(t);
      const focusLength =
        this.selectedPosition.length() * (1 - progress);

      const fitClearance =
        1.68 - specimenZoom * (1.63 + focusLength);

      const glassFitAlpha = ramp(fitClearance, 0, 0.05);
      const glassAlpha =
        ramp(t, 32.5, 34.5) * glassFitAlpha;

      this.glassMaterials.forEach(material => {
        this.setAlpha(material, glassAlpha);
      });
      this.beaker.visible = glassAlpha > 0.001;

      if (
        updateInstances &&
        this.lastGeometryTime !== t
      ) {
        if (t < SOLID_SWITCH) {
          this.updateIonGeometry(t);
          this.updateIonInstances(scale, t);
        }

        if (t >= 26) {
          this.updateGrainInstances(specimenZoom, t);
        }

        this.lastGeometryTime = t;
      }

      this.visual.visible = this.shown;

      const phase = this.phaseIndex();
      const state = [
        this.paused,
        this.shown,
        this.loop,
        this.playDirection
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
      this.localEye.copy(this.eye);
      this.root.worldToLocal(this.localEye);

      object.rotation.set(
        0,
        Math.atan2(
          this.localEye.x - object.position.x,
          this.localEye.z - object.position.z
        ),
        0
      );
    },

    updateBillboards: function () {
      const scene = this.el.sceneEl;
      if (!scene || !scene.camera) return;

      scene.camera.getWorldPosition(this.eye);
      this.root.updateWorldMatrix(true, false);

      this.faceViewer(this.quote);

      this.localEye.copy(this.eye);
      this.root.worldToLocal(this.localEye);

      this.direction.set(
        this.localEye.x, 0, this.localEye.z
      );

      if (this.direction.lengthSq() < 0.0001) {
        this.direction.set(0, 0, 1);
      } else {
        this.direction.normalize();
      }

      this.phaseBoard.position.set(
        this.direction.x * INFO_DISTANCE,
        INFO_Y,
        this.direction.z * INFO_DISTANCE
      );
      this.faceViewer(this.phaseBoard);

      if (!this.shown || this.stageTime() >= 10) return;

      this.atomic.updateWorldMatrix(true, false);
      this.localEye.copy(this.eye);
      this.atomic.worldToLocal(this.localEye);

      /*
       * Beschriftungen bleiben der jeweiligen Kugel zugeordnet.
       * Ihre Ausrichtung selbst übernimmt THREE.Sprite
       * für die gerenderte Kamera, auch in WebXR.
       *
       * Die Tiefenprüfung ist für die Schrift ausgeschaltet:
       * kleine Unterschiede zwischen den beiden Augen
       * schneiden daher keine Buchstabenteile mehr ab.
       */
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
            label.radius + ION_TEXT_SURFACE_GAP
          );
      });
    },

    tick: function (time, delta) {
      const menuOpen = F.Menu && F.Menu.opened;

      if (!this.paused && this.shown && !menuOpen) {
        const seconds = Math.min(
          Math.max((delta || 0) / 1000, 0),
          0.05
        );

        this.time +=
          seconds * this.data.speed * this.playDirection;

        if (this.playDirection > 0 && this.time >= END) {
          this.time = END;
          this.playDirection = -1;
        } else if (
          this.playDirection < 0 && this.time <= 0
        ) {
          this.time = 0;
          this.playDirection = 1;
          if (!this.loop) this.paused = true;
        }
      }

      let updateInstances =
        time - this.lastInstanceUpdate >= 40;

      const shouldShowAtomic =
        this.stageTime() < SOLID_SWITCH;

      if (shouldShowAtomic && !this.atomic.visible) {
        updateInstances = true;
      }

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
      this.baseOpacity.clear();
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

    const floorDiamond = parent.querySelector(
      "#welcome-floor-diamond"
    );
    if (floorDiamond) floorDiamond.remove();

    const experiment = document.createElement("a-entity");
    experiment.id = "fkc-welcome-experiment";
    experiment.setAttribute("fkc-welcome-demo", "");
    parent.appendChild(experiment);

    if (result && typeof result.isWalkable === "function") {
      const previousWalkable = result.isWalkable;
      const clearanceRadius = TABLE_RADIUS + 0.28;

      result.isWalkable = function (x, z) {
        if (
          x * x + z * z <
          clearanceRadius * clearanceRadius
        ) return false;

        return previousWalkable.call(this, x, z);
      };
    }

    return result;
  };

  /*
   * ============================================================
   * MENÜ ERGÄNZEN
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
    ctx.font = "bold 43px Arial";
    ctx.fillText(
      "Vom Ionengitter zur Salzprobe", 55, 75, 914
    );

    ctx.font = "27px Arial";
    ctx.fillText(
      "Hin und zurück · NaCl · Koordination 6 : 6",
      55, 125, 914
    );

    let y = 160;

    const button = (label, action, color) => {
      const x = 55;
      const w = 914;
      const h = 64;
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
      ctx.font = "29px Arial";
      ctx.fillText(
        label, x + 22, y + 41 + offset, w - 44
      );

      this.buttons.push({x, y, w, h, label, action});
      y += 76;
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
          demo.paused ? "Animation pausiert." : "Animation läuft."
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
          "Große einzelne Elementarzelle angezeigt. Animation pausiert."
        );
      }
    );

    button(
      demo.playDirection > 0
        ? "Nächste Phase — Richtung Salzprobe"
        : "Nächste Phase — Richtung Elementarzelle",
      () => {
        demo.nextPhase();
        feedback(
          this,
          "Nächste Phase angezeigt. Animation pausiert."
        );
      }
    );

    button(
      "Richtung: " +
      (demo.playDirection > 0 ? "Herauszoomen" : "Hineinzoomen") +
      " — wechseln",
      () => {
        demo.reverseDirection();

        feedback(
          this,
          demo.playDirection > 0
            ? "Richtung geändert: Herauszoomen."
            : "Richtung geändert: Hineinzoomen."
        );
      },
      "#efe0b8"
    );

    button(
      "Geschwindigkeit: " + demo.data.speed + "×",
      () => {
        const speeds = [0.5, 1, 2];
        const index = speeds.indexOf(demo.data.speed);
        const next = speeds[(index + 1) % speeds.length];

        demo.el.setAttribute(
          "fkc-welcome-demo", "speed", next
        );

        feedback(this, "Geschwindigkeit: " + next + "×");
      },
      "#cddff3"
    );

    button(
      "Hin und zurück wiederholen: " + (demo.loop ? "an" : "aus"),
      () => {
        demo.loop = !demo.loop;

        feedback(
          this,
          demo.loop
            ? "Hin- und Rückweg werden wiederholt."
            : "Nach dem Rückweg bleibt die Elementarzelle stehen."
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
            ? "Eingeblendet; bei Bedarf starten."
            : "Ausgeblendet und pausiert. Podest bleibt sichtbar."
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
      "Automatisch: Elementarzelle → Salzprobe → Elementarzelle",
      55, 904, 914
    );
    ctx.fillText(
      "Darstellungswechsel vereinfacht · kein Wachstum oder Auflösen",
      55, 948, 914
    );
    ctx.fillText(
      "Während das Menü offen ist, hält die Animation an.",
      55, 992, 914
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
      "B/Y schließt · NaCl-Begrüßungsanimation · Version Willkommen-10",
      55, 1160, 914
    );

    this.texture.needsUpdate = true;
  };
})(window.FKCVR);
