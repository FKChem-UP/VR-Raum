"use strict";

(function (F) {
  /*
   * ============================================================
   * RAUMDESIGNS — RAUMDESIGN-1
   * ============================================================
   *
   * Laden NACH xray-demo.js und welcome-demo.js,
   * aber VOR app.js.
   *
   * Bestehende Raumhüllen werden reversibel ausgeblendet.
   * Lehrmodelle, Folientafeln, Modellpodeste, Türen mit
   * Raumwahltafeln und Demonstrationen bleiben unverändert.
   *
   * Navigationsgrenzen und Hindernisse des Builders bleiben
   * unverändert.
   *
   * Dekoration wird nach Geometrie und Material gebündelt:
   * InstancedMesh statt einer Entity pro Blatt oder Baustein.
   *
   * Speicherung: lokal pro Browser, keine Synchronisierung.
   */

  if (
    !F ||
    !F.RoomBuilder ||
    !F.Menu ||
    !window.AFRAME
  ) {
    throw new Error(
      "Raumdesign-1: A-Frame, room-builder.js und " +
      "vr-tools.js müssen vorher geladen sein."
    );
  }

  const T = AFRAME.THREE;
  const STORAGE_KEY = "fkc-vr-room-themes-v1";

  const DEFINITIONS = [
    {
      id: "lab",
      title: "Potsdam · helles Labor",
      background: "#dce9ef",
      floor: "#dce4e9",
      wall: "#f0f4f6",
      ceiling: "#f8fafc",
      accent: "#426d8a",
      glow: "#eefaff"
    },
    {
      id: "gallery",
      title: "Moderne Galerie",
      background: "#ece7df",
      floor: "#c79b6b",
      wall: "#f3eee5",
      ceiling: "#eae4db",
      accent: "#343a40",
      glow: "#fff4da"
    },
    {
      id: "future",
      title: "Futuristisches Labor",
      background: "#102135",
      floor: "#293e52",
      wall: "#20344d",
      ceiling: "#14273d",
      accent: "#44617b",
      glow: "#62e8f4"
    },
    {
      id: "castle",
      title: "Dracula-Schloss",
      background: "#16182d",
      floor: "#817d79",
      wall: "#92908d",
      ceiling: "#44404a",
      accent: "#663045",
      glow: "#ffbd68"
    },
    {
      id: "island",
      title: "Einsame Insel",
      background: "#a7d9ef",
      floor: "#ead5a0",
      wall: "#ead5a0",
      ceiling: "#a7d9ef",
      accent: "#89613d",
      glow: "#fff4d4"
    },
    {
      id: "jungle",
      title: "Dschungel",
      background: "#abc8b5",
      floor: "#9c8961",
      wall: "#9c8961",
      ceiling: "#abc8b5",
      accent: "#66513b",
      glow: "#ffe7b2"
    }
  ];

  function definition(id) {
    return DEFINITIONS.find(item => item.id === id) || null;
  }

  function validTheme(id) {
    return id === "original" || !!definition(id);
  }

  function configurations() {
    return [F.welcomeRoom].concat(F.rooms || [])
      .filter(item => item && typeof item.id === "string");
  }

  function roomIds() {
    return configurations().map(item => item.id);
  }

  function themeTitle(id) {
    if (id === "original") return "Originalgestaltung";
    const item = definition(id);
    return item ? item.title : "Originalgestaltung";
  }

  /*
   * ============================================================
   * LOKALE SPEICHERUNG
   * ============================================================
   */

  const preferences = Object.create(null);
  let storageAvailable = true;

  function loadPreferences() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);

      if (
        !parsed ||
        parsed.version !== 1 ||
        !parsed.rooms ||
        typeof parsed.rooms !== "object"
      ) return;

      roomIds().forEach(id => {
        const value = parsed.rooms[id];
        if (validTheme(value)) preferences[id] = value;
      });
    } catch (error) {
      storageAvailable = false;
      console.warn(
        "Raumdesign: lokale Einstellungen konnten " +
        "nicht gelesen werden.",
        error
      );
    }
  }

  function savePreferences() {
    try {
      const rooms = {};

      roomIds().forEach(id => {
        if (validTheme(preferences[id])) {
          rooms[id] = preferences[id];
        }
      });

      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({version: 1, rooms})
      );

      storageAvailable = true;
    } catch (error) {
      storageAvailable = false;
      console.warn(
        "Raumdesign: lokale Einstellungen konnten " +
        "nicht gespeichert werden.",
        error
      );
    }
  }

  loadPreferences();

  /*
   * ============================================================
   * RESSOURCEN
   * ============================================================
   */

  function resources() {
    return {
      geometries: new Set(),
      materials: new Set(),
      textures: new Set(),
      disposed: false,

      dispose: function () {
        if (this.disposed) return;
        this.disposed = true;

        this.geometries.forEach(item => item.dispose());
        this.materials.forEach(item => item.dispose());
        this.textures.forEach(item => item.dispose());

        this.geometries.clear();
        this.materials.clear();
        this.textures.clear();
      }
    };
  }

  AFRAME.registerComponent("fkc-room-theme-layer", {
    remove: function () {
      const owned = this.el.fkcThemeResources;
      if (owned) owned.dispose();

      if (F.invalidateHits) F.invalidateHits();
    }
  });

  /*
   * ============================================================
   * PROZEDURALE TEXTUREN
   * ============================================================
   */

  function randomGenerator(seed) {
    let value = seed >>> 0;

    return function () {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function canvasTexture(owned, kind, repeatX, repeatY) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;

    const ctx = canvas.getContext("2d");
    const random = randomGenerator(71539);
    const size = 512;

    if (kind === "tiles") {
      ctx.fillStyle = "#eef2f5";
      ctx.fillRect(0, 0, size, size);

      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          const light = 228 + Math.floor(random() * 15);

          ctx.fillStyle =
            "rgb(" + light + "," +
            (light + 2) + "," + (light + 4) + ")";

          ctx.fillRect(
            col * 128 + 2,
            row * 128 + 2,
            124,
            124
          );
        }
      }

      ctx.strokeStyle = "#bbc7cf";
      ctx.lineWidth = 2;

      for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 128, 0);
        ctx.lineTo(i * 128, size);
        ctx.moveTo(0, i * 128);
        ctx.lineTo(size, i * 128);
        ctx.stroke();
      }
    } else if (kind === "wood") {
      ctx.fillStyle = "#b88450";
      ctx.fillRect(0, 0, size, size);

      for (let row = 0; row < 8; row++) {
        const y = row * 64;
        const shade = Math.floor(random() * 24);

        ctx.fillStyle =
          "rgb(" + (183 + shade) + "," +
          (137 + shade) + "," + (87 + shade) + ")";

        ctx.fillRect(0, y + 2, size, 60);

        for (let line = 0; line < 12; line++) {
          const gy = y + 5 + random() * 52;

          ctx.strokeStyle = "rgba(74,43,20,0.13)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.bezierCurveTo(
            140, gy - 3,
            330, gy + 3,
            size, gy
          );
          ctx.stroke();
        }

        const joint = row % 2 === 0 ? 170 : 340;

        ctx.fillStyle = "#956738";
        ctx.fillRect(joint, y, 2, 64);
      }
    } else if (kind === "grid") {
      ctx.fillStyle = "#304358";
      ctx.fillRect(0, 0, size, size);

      ctx.strokeStyle = "#506479";
      ctx.lineWidth = 3;

      for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 128, 0);
        ctx.lineTo(i * 128, size);
        ctx.moveTo(0, i * 128);
        ctx.lineTo(size, i * 128);
        ctx.stroke();
      }

      ctx.fillStyle = "#86cbd2";

      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          ctx.fillRect(x * 128 + 9, y * 128 + 9, 8, 8);
        }
      }
    } else if (kind === "stone") {
      ctx.fillStyle = "#514d4b";
      ctx.fillRect(0, 0, size, size);

      for (let row = 0; row < 8; row++) {
        const offset = row % 2 === 0 ? 0 : -64;

        for (let col = 0; col < 5; col++) {
          const shade = Math.floor(random() * 23);
          const x = col * 128 + offset;
          const y = row * 64;

          ctx.fillStyle =
            "rgb(" + (133 + shade) + "," +
            (130 + shade) + "," + (125 + shade) + ")";

          ctx.fillRect(x + 3, y + 3, 122, 58);

          ctx.fillStyle = "rgba(255,255,255,0.09)";
          ctx.fillRect(x + 5, y + 5, 118, 3);
        }
      }

      for (let i = 0; i < 1200; i++) {
        ctx.fillStyle = i % 2
          ? "rgba(30,25,23,0.07)"
          : "rgba(255,255,255,0.06)";

        ctx.fillRect(
          random() * size,
          random() * size,
          1 + random() * 4,
          1 + random() * 3
        );
      }
    } else if (kind === "sand" || kind === "earth") {
      const sand = kind === "sand";

      ctx.fillStyle = sand ? "#ead5a0" : "#9c8961";
      ctx.fillRect(0, 0, size, size);

      for (let i = 0; i < 6500; i++) {
        ctx.fillStyle = i % 2
          ? (
              sand
                ? "rgba(116,86,39,0.13)"
                : "rgba(53,43,24,0.17)"
            )
          : "rgba(255,248,210,0.15)";

        ctx.fillRect(
          random() * size,
          random() * size,
          1 + random() * 2,
          1 + random() * 2
        );
      }

      if (!sand) {
        ctx.strokeStyle = "rgba(72,67,32,0.18)";
        ctx.lineWidth = 2;

        for (let i = 0; i < 75; i++) {
          const x = random() * size;
          const y = random() * size;

          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 8, y + 3);
          ctx.stroke();
        }
      }
    } else if (kind === "water") {
      ctx.fillStyle = "#429cba";
      ctx.fillRect(0, 0, size, size);

      ctx.lineWidth = 2;

      for (let i = 0; i < 100; i++) {
        const x = random() * size;
        const y = random() * size;

        ctx.strokeStyle = i % 3 === 0
          ? "rgba(226,250,255,0.34)"
          : "rgba(17,91,133,0.13)";

        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(
          x + 8, y - 3,
          x + 20, y + 3,
          x + 34, y
        );
        ctx.stroke();
      }
    }

    const texture = new T.CanvasTexture(canvas);

    texture.wrapS = T.RepeatWrapping;
    texture.wrapT = T.RepeatWrapping;
    texture.repeat.set(repeatX || 1, repeatY || 1);

    texture.encoding = T.sRGBEncoding;
    texture.anisotropy = 1;

    owned.textures.add(texture);
    return texture;
  }

  /*
   * ============================================================
   * GEOMETRIEHILFEN
   * ============================================================
   */

  function standardMaterial(owned, color, map) {
    const material = new T.MeshStandardMaterial({
      color: map ? "#ffffff" : color,
      map: map || null,
      roughness: 0.86,
      metalness: 0
    });

    owned.materials.add(material);
    return material;
  }

  function addSurface(layer, owned, name, position, size, material) {
    const entity = document.createElement("a-entity");
    entity.classList.add("paintable");
    entity.dataset.themeSurface = name;

    layer.appendChild(entity);

    const geometry = new T.BoxGeometry(1, 1, 1);
    owned.geometries.add(geometry);

    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.scale.set(size[0], size[1], size[2]);

    entity.setObject3D("mesh", mesh);

    return entity;
  }

  /*
   * Dekorations-Batching:
   * pro Geometrie und Farbe eine InstancedMesh.
   *
   * Dekoration ist weder greifbar noch bemalbar.
   */
  function decorationBatch(owned) {
    const buckets = new Map();
    const dummy = new T.Object3D();

    function add(type, color, position, scale, rotation, flat) {
      const key = type + ":" + color + ":" + !!flat;

      if (!buckets.has(key)) {
        buckets.set(key, {
          type,
          color,
          flat: !!flat,
          items: []
        });
      }

      dummy.position.set(
        position[0], position[1], position[2]
      );

      dummy.scale.set(scale[0], scale[1], scale[2]);

      dummy.rotation.set(
        rotation ? rotation[0] : 0,
        rotation ? rotation[1] : 0,
        rotation ? rotation[2] : 0
      );

      dummy.updateMatrix();

      buckets.get(key).items.push(dummy.matrix.clone());
    }

    return {
      box: function (color, position, size, rotation, flat) {
        add("box", color, position, size, rotation, flat);
      },

      cylinder: function (color, position, scale, rotation, flat) {
        add("cylinder", color, position, scale, rotation, flat);
      },

      sphere: function (color, position, scale, rotation, flat) {
        add("sphere", color, position, scale, rotation, flat);
      },

      cone: function (color, position, scale, rotation, flat) {
        add("cone", color, position, scale, rotation, flat);
      },

      finish: function (parent) {
        buckets.forEach(bucket => {
          let geometry;

          if (bucket.type === "box") {
            geometry = new T.BoxGeometry(1, 1, 1);
          } else if (bucket.type === "cylinder") {
            geometry = new T.CylinderGeometry(1, 1, 1, 8);
          } else if (bucket.type === "cone") {
            geometry = new T.ConeGeometry(1, 1, 8);
          } else {
            geometry = new T.SphereGeometry(1, 10, 6);
          }

          owned.geometries.add(geometry);

          const material = bucket.flat
            ? new T.MeshBasicMaterial({
                color: bucket.color,
                toneMapped: false
              })
            : new T.MeshStandardMaterial({
                color: bucket.color,
                roughness: 0.87,
                metalness: 0
              });

          owned.materials.add(material);

          const mesh = new T.InstancedMesh(
            geometry,
            material,
            bucket.items.length
          );

          bucket.items.forEach((matrix, index) => {
            mesh.setMatrixAt(index, matrix);
          });

          mesh.instanceMatrix.needsUpdate = true;

          /*
           * Statische, überschaubare Umgebung.
           * Verhindert unpassendes Culling mit älteren
           * THREE-Versionen bei verteilten Instanzen.
           */
          mesh.frustumCulled = false;
          mesh.name = "room-theme-decoration";

          parent.add(mesh);
        });

        buckets.clear();
      }
    };
  }

  /*
   * ============================================================
   * GLEICHMÄSSIGE LEHRBELEUCHTUNG
   * ============================================================
   *
   * Gleiche neutrale Beleuchtung in allen neuen Designs.
   * Fackeln und Lichtleisten sind nur sichtbare Dekoration:
   * keine zusätzlichen Punktlichter, keine Schattenberechnung.
   */

  function addTeachingLights(group) {
    group.add(new T.AmbientLight("#ffffff", 0.8));

    const main = new T.DirectionalLight("#fffaf3", 0.65);
    main.position.set(-7, 11, 4);
    group.add(main);

    const fill = new T.DirectionalLight("#f3f8ff", 0.35);
    fill.position.set(8, 10, -6);
    group.add(fill);
  }

  /*
   * ============================================================
   * INNENRÄUME
   * ============================================================
   */

  function indoorRoom(layer, owned, group, batch, config, design) {
    const w = config.width;
    const d = config.depth;
    const h = config.height;

    const kind = design.id === "lab"
      ? "tiles"
      : design.id === "gallery"
        ? "wood"
        : design.id === "future"
          ? "grid"
          : "stone";

    const floorTexture = canvasTexture(
      owned,
      kind,
      w / 4,
      d / 4
    );

    const floorMaterial = standardMaterial(
      owned,
      design.floor,
      floorTexture
    );

    const wallTexture = design.id === "castle"
      ? canvasTexture(owned, "stone", w / 4, h / 3)
      : null;

    const wallMaterial = standardMaterial(
      owned,
      design.wall,
      wallTexture
    );

    const ceilingMaterial = standardMaterial(
      owned,
      design.ceiling
    );

    addSurface(
      layer, owned, "Boden",
      [0, 0.003, 0],
      [w, 0.006, d],
      floorMaterial
    );

    addSurface(
      layer, owned, "Linke Wand",
      [-w / 2, h / 2, 0],
      [0.25, h, d],
      wallMaterial
    );

    addSurface(
      layer, owned, "Rechte Wand",
      [w / 2, h / 2, 0],
      [0.25, h, d],
      wallMaterial
    );

    addSurface(
      layer, owned, "Hintere Wand",
      [0, h / 2, -d / 2],
      [w, h, 0.25],
      wallMaterial
    );

    addSurface(
      layer, owned, "Vordere Wand",
      [0, h / 2, d / 2],
      [w, h, 0.25],
      wallMaterial
    );

    addSurface(
      layer, owned, "Decke",
      [0, h + 0.08, 0],
      [w, 0.16, d],
      ceilingMaterial
    );

    /*
     * Sockelleisten bleiben hinter den bestehenden
     * Modellpodesten und außerhalb der Laufgrenze.
     */
    [-1, 1].forEach(sign => {
      batch.box(
        design.accent,
        [sign * (w / 2 - 0.14), 0.13, 0],
        [0.035, 0.26, d]
      );

      batch.box(
        design.accent,
        [0, 0.13, sign * (d / 2 - 0.14)],
        [w, 0.26, 0.035]
      );
    });

    if (design.id === "lab") {
      /*
       * Große rechteckige Deckenpaneele,
       * blau-graue Oberkanten und klare Flächengliederung.
       */
      [-0.28, 0, 0.28].forEach(fraction => {
        batch.box(
          "#71899b",
          [fraction * w, h - 0.04, 0],
          [2.7, 0.06, d * 0.66]
        );

        batch.box(
          design.glow,
          [fraction * w, h - 0.079, 0],
          [2.45, 0.012, d * 0.62],
          null,
          true
        );
      });

      [-1, 1].forEach(sign => {
        batch.box(
          design.accent,
          [sign * (w / 2 - 0.14), h - 0.28, 0],
          [0.03, 0.16, d]
        );
      });
    }

    if (design.id === "gallery") {
      /*
       * Dunkle schmale Deckenträger statt historischer
       * Goldornamente und Kronleuchter.
       */
      [-0.32, -0.16, 0, 0.16, 0.32].forEach(fraction => {
        batch.box(
          design.accent,
          [fraction * w, h - 0.035, 0],
          [0.18, 0.06, d * 0.87]
        );
      });

      [-0.28, 0.28].forEach(fraction => {
        batch.box(
          design.glow,
          [fraction * w, h - 0.078, 0],
          [0.075, 0.012, d * 0.75],
          null,
          true
        );
      });
    }

    if (design.id === "future") {
      /*
       * Cyanfarbene Lichtleisten an der Decke
       * und in den oberen Wandbereichen.
       */
      [-1, 1].forEach(sign => {
        batch.box(
          design.glow,
          [sign * (w / 2 - 0.145), h - 0.23, 0],
          [0.028, 0.055, d - 0.6],
          null,
          true
        );

        batch.box(
          design.glow,
          [0, h - 0.23, sign * (d / 2 - 0.145)],
          [w - 0.6, 0.055, 0.028],
          null,
          true
        );
      });

      [-0.27, 0, 0.27].forEach(fraction => {
        batch.box(
          "#405975",
          [fraction * w, h - 0.025, 0],
          [1.2, 0.045, d * 0.72]
        );

        batch.box(
          design.glow,
          [fraction * w, h - 0.055, 0],
          [0.07, 0.012, d * 0.68],
          null,
          true
        );
      });
    }

    if (design.id === "castle") {
      /*
       * Eckpfeiler liegen außerhalb der vorhandenen
       * Navigationsgrenzen.
       */
      [-1, 1].forEach(sx => {
        [-1, 1].forEach(sz => {
          batch.box(
            "#605d62",
            [
              sx * (w / 2 - 0.15),
              h / 2,
              sz * (d / 2 - 0.15)
            ],
            [0.28, h, 0.28]
          );
        });
      });

      [-0.3, 0, 0.3].forEach(fraction => {
        batch.box(
          "#514650",
          [fraction * w, h - 0.03, 0],
          [0.17, 0.05, d]
        );
      });

      /*
       * Nachtfenster oberhalb der Folientafeln.
       * Stilisierte Wandfelder, keine Durchbrüche.
       */
      [-1, 1].forEach(sign => {
        [-0.27, 0, 0.27].forEach(fraction => {
          const x = fraction * w;
          const z = sign * (d / 2 - 0.145);
          const y = h - 0.66;

          batch.box(
            "#4c3e49",
            [x, y, z],
            [1.28, 1.04, 0.025]
          );

          batch.box(
            "#172b49",
            [x, y, z - sign * 0.022],
            [1.05, 0.85, 0.025],
            null,
            true
          );

          batch.box(
            "#788495",
            [x, y, z - sign * 0.041],
            [0.035, 0.85, 0.02]
          );

          batch.box(
            "#788495",
            [x, y, z - sign * 0.043],
            [1.05, 0.035, 0.02]
          );

          batch.sphere(
            "#d3d9e6",
            [x - 0.28, y + 0.22, z - sign * 0.061],
            [0.095, 0.095, 0.012],
            null,
            true
          );
        });
      });

      /*
       * Fackeln nahe den Ecken, über Kopf und außerhalb
       * der Laufzone. Flammen bleiben vollständig statisch.
       */
      [-1, 1].forEach(sx => {
        [-1, 1].forEach(sz => {
          const x = sx * (w / 2 - 0.19);
          const z = sz * (d / 2 - 1.0);
          const y = Math.min(h - 1.1, 4.8);

          batch.cylinder(
            "#3c3030",
            [x, y - 0.23, z],
            [0.06, 0.47, 0.06]
          );

          batch.cone(
            "#f18d38",
            [x, y + 0.12, z],
            [0.12, 0.35, 0.12],
            null,
            true
          );

          batch.cone(
            "#ffe2a0",
            [x, y + 0.08, z],
            [0.065, 0.23, 0.065],
            null,
            true
          );
        });
      });
    }
  }

  /*
   * ============================================================
   * AUSSENRÄUME
   * ============================================================
   */

  function perimeter(batch, config, color) {
    const w = config.width;
    const d = config.depth;

    /*
     * Sichtbare Randmarkierung hinter den Folientafeln.
     * Die tatsächliche Laufgrenze bleibt im bisherigen Builder.
     */
    [-1, 1].forEach(sign => {
      batch.box(
        color,
        [sign * (w / 2 + 0.16), 0.14, 0],
        [0.2, 0.28, d + 0.6]
      );

      batch.box(
        color,
        [0, 0.14, sign * (d / 2 + 0.16)],
        [w + 0.6, 0.28, 0.2]
      );
    });

    /*
     * Pfosten hinter den bisherigen Tafeln:
     * keine Verschiebung oder neue Träger innerhalb der Laufzone.
     */
    [-1, 1].forEach(sign => {
      [-0.34, 0, 0.34].forEach(fraction => {
        batch.box(
          color,
          [sign * (w / 2 + 0.19), 1.95, fraction * d],
          [0.12, 3.9, 0.12]
        );

        batch.box(
          color,
          [fraction * w, 1.95, sign * (d / 2 + 0.19)],
          [0.12, 3.9, 0.12]
        );
      });
    });
  }

  function palm(batch, x, z, height, angle) {
    const green = "#468c50";

    batch.cylinder(
      "#946e45",
      [x, height / 2, z],
      [0.17, height, 0.17],
      [0, angle, 0.055]
    );

    for (let i = 0; i < 7; i++) {
      const a = angle + i * Math.PI * 2 / 7;
      const distance = 1.18;

      batch.sphere(
        green,
        [
          x + Math.cos(a) * distance,
          height - 0.2,
          z + Math.sin(a) * distance
        ],
        [1.65, 0.105, 0.31],
        [0, -a, -0.15]
      );
    }

    batch.sphere(
      "#6b5a36",
      [x, height - 0.23, z],
      [0.25, 0.22, 0.25]
    );
  }

  function jungleTree(batch, x, z, height, index) {
    batch.cylinder(
      "#65503a",
      [x, height / 2, z],
      [0.27, height, 0.27]
    );

    const colors = ["#467446", "#54824b", "#35663e"];
    const color = colors[index % colors.length];

    batch.sphere(
      color,
      [x, height + 0.15, z],
      [2.1, 1.3, 2.0]
    );

    batch.sphere(
      color,
      [x + 1.0, height - 0.18, z + 0.3],
      [1.5, 0.95, 1.5]
    );

    batch.sphere(
      "#729550",
      [x - 0.65, height + 0.55, z - 0.3],
      [1.45, 0.65, 1.35]
    );

    /*
     * Randbüsche bleiben vollständig außerhalb der Laufzone.
     */
    batch.sphere(
      "#4d7741",
      [x + 0.6, 0.5, z],
      [1.0, 0.65, 0.85]
    );

    for (let leaf = 0; leaf < 4; leaf++) {
      const a = leaf * Math.PI / 2 + index * 0.2;

      batch.sphere(
        "#6e9148",
        [
          x + Math.cos(a) * 0.55,
          0.64,
          z + Math.sin(a) * 0.55
        ],
        [0.83, 0.08, 0.2],
        [0, -a, 0.32]
      );
    }
  }

  function outdoorRoom(layer, owned, group, batch, config, design) {
    const w = config.width;
    const d = config.depth;
    const island = design.id === "island";

    const groundTexture = canvasTexture(
      owned,
      island ? "sand" : "earth",
      w / 5,
      d / 5
    );

    const groundMaterial = standardMaterial(
      owned,
      design.floor,
      groundTexture
    );

    /*
     * Hauptboden: gleiche Höhe wie die bisherige Raumfläche.
     */
    addSurface(
      layer, owned, "Boden",
      [0, 0.003, 0],
      [w, 0.006, d],
      groundMaterial
    );

    /*
     * Äußere Landschaft ist Dekoration und nicht bemalbar.
     * Sie erweitert NICHT die Navigationsfläche.
     */
    const outerGeometry = new T.BoxGeometry(
      w + 8,
      0.16,
      d + 8
    );

    owned.geometries.add(outerGeometry);

    const outerGround = new T.Mesh(
      outerGeometry,
      groundMaterial
    );

    outerGround.position.y = -0.09;
    group.add(outerGround);

    perimeter(batch, config, design.accent);

    if (island) {
      const waterTexture = canvasTexture(
        owned,
        "water",
        24,
        24
      );

      const waterMaterial = new T.MeshBasicMaterial({
        map: waterTexture,
        color: "#ffffff",
        side: T.DoubleSide
      });

      owned.materials.add(waterMaterial);

      const waterGeometry = new T.PlaneGeometry(180, 180);
      owned.geometries.add(waterGeometry);

      const water = new T.Mesh(
        waterGeometry,
        waterMaterial
      );

      water.rotation.x = -Math.PI / 2;
      water.position.y = -0.23;
      group.add(water);

      /*
       * Flache, helle Uferbänder zwischen Sand und Wasser.
       */
      [-1, 1].forEach(sign => {
        batch.box(
          "#f0dfb5",
          [sign * (w / 2 + 4.05), -0.09, 0],
          [0.35, 0.07, d + 8.3]
        );

        batch.box(
          "#f0dfb5",
          [0, -0.09, sign * (d / 2 + 4.05)],
          [w + 8.3, 0.07, 0.35]
        );
      });

      const positions = [];

      [-1, 1].forEach(sign => {
        [-0.32, 0.32].forEach(fraction => {
          positions.push([
            sign * (w / 2 + 2.8),
            fraction * d
          ]);

          positions.push([
            fraction * w,
            sign * (d / 2 + 2.8)
          ]);
        });
      });

      positions.forEach((position, index) => {
        palm(
          batch,
          position[0],
          position[1],
          5.5 + (index % 3) * 0.45,
          index * 0.73
        );
      });
    } else {
      /*
       * Bäume außerhalb der Raumgrenzen.
       * Das mittlere Blätterdach liegt deutlich oberhalb
       * der Lehrtafeln und der Begrüßungsüberschrift.
       */
      const canopyHeight = Math.max(config.height + 2.5, 9);
      const positions = [];

      [-1, 1].forEach(sign => {
        [-0.4, -0.2, 0, 0.2, 0.4].forEach(fraction => {
          positions.push([
            sign * (w / 2 + 2.8),
            fraction * d
          ]);

          positions.push([
            fraction * w,
            sign * (d / 2 + 2.8)
          ]);
        });
      });

      positions.forEach((position, index) => {
        jungleTree(
          batch,
          position[0],
          position[1],
          canopyHeight - 0.8 + (index % 3) * 0.45,
          index
        );
      });

      [-0.3, 0, 0.3].forEach(fraction => {
        batch.sphere(
          "#4c7948",
          [fraction * w, canopyHeight + 0.7, -d * 0.2],
          [w * 0.22, 0.8, d * 0.32]
        );

        batch.sphere(
          "#61834b",
          [fraction * w, canopyHeight + 1.0, d * 0.25],
          [w * 0.2, 0.65, d * 0.3]
        );
      });
    }
  }

  /*
   * ============================================================
   * BISHERIGE RAUMHÜLLE ERKENNEN
   * ============================================================
   *
   * Auf den angehängten Builder GALERIE-2 abgestimmt.
   *
   * Nur direkte Kinder des Raum-Roots werden betrachtet.
   * Folientafeln, Modellpodeste und Türen enthalten a-plane
   * und werden dadurch ausdrücklich ausgeschlossen.
   *
   * Demonstrationen sind ebenfalls ausgeschlossen.
   */

  const DECORATION_SELECTOR = [
    "a-box",
    "a-cylinder",
    "a-sphere",
    "a-torus",
    "a-cone"
  ].join(",");

  function isOriginalEnvironment(el) {
    if (!el || !el.matches) return false;

    if (
      el.classList.contains("interactable") ||
      el.classList.contains("vr-action") ||
      el.hasAttribute("fkc-welcome-demo") ||
      el.hasAttribute("fkc-xray-demo") ||
      el.id === "fkc-welcome-experiment" ||
      el.id === "fkc-xray-experiment"
    ) return false;

    if (el.tagName === "A-BOX") {
      return true;
    }

    /*
     * Im Museumsraum ist nur die Bodenfläche
     * eine direkt am Raum-Root liegende a-plane.
     * Zusätzliche Sicherheitsprüfung: waagerecht und bodennah.
     */
    if (el.tagName === "A-PLANE") {
      const rotation = el.getAttribute("rotation") || {};
      const position = el.getAttribute("position") || {};

      return (
        Math.abs((rotation.x || 0) + 90) < 0.1 &&
        Math.abs(position.y || 0) < 0.05
      );
    }

    if (el.tagName !== "A-ENTITY") return false;

    if (el.hasAttribute("light")) return true;

    if (el.id === "welcome-floor-diamond") return true;

    if (
      el.querySelector("a-plane") ||
      el.querySelector(".interactable") ||
      el.querySelector(".vr-action")
    ) return false;

    /*
     * Wandgruppen, Deckenleuchten und Wandleuchten
     * besitzen normale A-Frame-Dekorationsgeometrie.
     *
     * Reine THREE-Demogruppen erfüllen diese Bedingung nicht.
     */
    return !!el.querySelector(DECORATION_SELECTOR);
  }

  function setOriginalVisibility(state, themed) {
    state.originals.forEach(entry => {
      entry.el.setAttribute(
        "visible",
        themed ? false : entry.visible
      );
    });
  }

  function clearEnvironmentDrawings(state) {
    if (!F.Draw) return;

    state.originals.forEach(entry => {
      F.Draw.clear(entry.el);
    });

    if (state.layer) F.Draw.clear(state.layer);
  }

  function forgetSelectedEnvironment(state) {
    const scene = F.getScene();
    if (!scene) return;

    const target = scene.lastSelectedTarget;
    if (!target) return;

    const belongs = state.originals.some(entry => (
      entry.el === target || entry.el.contains(target)
    )) || (
      state.layer &&
      (state.layer === target || state.layer.contains(target))
    );

    if (!belongs) return;

    scene.lastSelectedTarget = null;

    if (F.Menu.target === target) {
      F.Menu.target = null;
    }
  }

  function removeLayer(state) {
    if (!state.layer) return;

    const layer = state.layer;
    state.layer = null;

    if (F.Draw) F.Draw.clear(layer);

    layer.remove();

    /*
     * Idempotenter Fallback, falls die Komponente noch
     * nicht initialisiert wurde oder bereits entfernt ist.
     */
    if (layer.fkcThemeResources) {
      layer.fkcThemeResources.dispose();
    }
  }

  function restoreBackground(state) {
    const scene = F.getScene();
    if (!scene) return;

    if (state.background) {
      scene.setAttribute(
        "background",
        Object.assign({}, state.background)
      );
    }
  }

  function createLayer(state, design) {
    const layer = document.createElement("a-entity");
    layer.id = "fkc-room-theme-layer";
    layer.setAttribute("visible", false);

    const owned = resources();
    layer.fkcThemeResources = owned;

    state.parent.appendChild(layer);
    state.layer = layer;

    layer.setAttribute("fkc-room-theme-layer", "");

    const group = new T.Group();
    group.name = "room-theme-decoration-root";
    layer.setObject3D("theme-decoration", group);

    const batch = decorationBatch(owned);

    addTeachingLights(group);

    if (
      design.id === "island" ||
      design.id === "jungle"
    ) {
      outdoorRoom(
        layer,
        owned,
        group,
        batch,
        state.config,
        design
      );
    } else {
      indoorRoom(
        layer,
        owned,
        group,
        batch,
        state.config,
        design
      );
    }

    batch.finish(group);

    return layer;
  }

  /*
   * ============================================================
   * ÖFFENTLICHE SCHNITTSTELLE
   * ============================================================
   */

  F.RoomThemes = {
    state: null,

    currentTheme: function () {
      return this.state ? this.state.theme : "original";
    },

    currentTitle: function () {
      return this.state
        ? this.state.config.title
        : "Aktueller Raum";
    },

    apply: function (themeId) {
      const state = this.state;

      if (!state || !validTheme(themeId)) return false;

      if (
        state.theme === themeId &&
        (
          themeId === "original" ||
          (state.layer && state.layer.isConnected)
        )
      ) return true;

      /*
       * Zeichnungen auf Lehrinhalten bleiben erhalten.
       * Nur Zeichnungen auf der ausgetauschten Umgebung
       * werden entfernt.
       */
      clearEnvironmentDrawings(state);
      forgetSelectedEnvironment(state);

      F.Menu.blockDrawing();

      const navigation = F.getNavigation();
      if (navigation) navigation.cancel();

      removeLayer(state);
      setOriginalVisibility(state, false);
      restoreBackground(state);

      state.theme = "original";

      if (themeId === "original") {
        if (F.invalidateHits) F.invalidateHits();
        return true;
      }

      const design = definition(themeId);

      try {
        const layer = createLayer(state, design);

        setOriginalVisibility(state, true);

        F.getScene().setAttribute(
          "background",
          "color",
          design.background
        );

        layer.setAttribute("visible", true);
        state.theme = themeId;

        if (F.invalidateHits) F.invalidateHits();
        return true;
      } catch (error) {
        console.error(
          "Raumdesign konnte nicht aufgebaut werden:",
          error
        );

        removeLayer(state);
        setOriginalVisibility(state, false);
        restoreBackground(state);

        state.theme = "original";

        if (F.invalidateHits) F.invalidateHits();
        return false;
      }
    },

    choose: function (themeId) {
      const state = this.state;
      if (!state) return;

      if (!this.apply(themeId)) {
        F.Menu.notify(
          "Design fehlgeschlagen. Originalgestaltung ist sichtbar."
        );
        return;
      }

      preferences[state.config.id] = themeId;
      savePreferences();

      const message =
        themeTitle(themeId) +
        (
          storageAvailable
            ? " · lokal gespeichert."
            : " · nur für diese Sitzung gespeichert."
        );

      F.setStatus(message);
      F.Menu.notify(message);
    },

    applyToAll: function (themeId) {
      if (!validTheme(themeId)) return;

      if (!this.apply(themeId)) {
        F.Menu.notify(
          "Design fehlgeschlagen. Keine Übernahme für alle Räume."
        );
        return;
      }

      roomIds().forEach(id => {
        preferences[id] = themeId;
      });

      savePreferences();

      F.Menu.navigate("room-themes");

      const message = storageAvailable
        ? "Für alle elf Räume lokal gespeichert."
        : "Für alle elf Räume in dieser Sitzung übernommen.";

      F.setStatus(message);
      F.Menu.notify(message);
    },

    disposeState: function () {
      const state = this.state;
      if (!state) return;

      removeLayer(state);
      setOriginalVisibility(state, false);
      restoreBackground(state);

      this.state = null;
    }
  };

  /*
   * ============================================================
   * BUILDER-WRAPPER
   * ============================================================
   *
   * Nach beiden Demo-Wrappern installiert.
   * Die ursprüngliche Builder-Rückgabe bleibt unverändert,
   * insbesondere spawn und isWalkable.
   */

  const previousBuild = F.RoomBuilder.build;

  F.RoomBuilder.build = function (parent, config, rooms) {
    F.RoomThemes.disposeState();

    const result = previousBuild.call(
      this,
      parent,
      config,
      rooms
    );

    const scene = F.getScene();
    const background = scene.getAttribute("background");

    const state = {
      parent,
      config,
      theme: "original",
      layer: null,
      background: background
        ? Object.assign({}, background)
        : null,

      originals: Array.from(parent.children)
        .filter(isOriginalEnvironment)
        .map(el => ({
          el,
          visible: el.getAttribute("visible") !== false
        }))
    };

    F.RoomThemes.state = state;

    const selected = preferences[config.id] || "original";

    if (!F.RoomThemes.apply(selected)) {
      F.setStatus(
        "Gespeichertes Raumdesign konnte nicht geladen werden."
      );
    }

    return result;
  };

  /*
   * ============================================================
   * MENÜ
   * ============================================================
   *
   * Die bestehende render-Kette wird weiterverwendet.
   * Auch die Demo-Buttons bleiben mit ihren Aktionen erhalten.
   *
   * Auf home wird ein zusätzlicher Button eingeschoben und
   * die gesamte Buttonliste etwas kompakter neu gezeichnet.
   * Kein vorhandener Button wird ersetzt.
   */

  const previousRender = F.Menu.render;

  function paintMenu(menu, title, subtitle, items, footer) {
    const ctx = menu.ctx;
    const width = 1024;
    const height = 1200;

    ctx.fillStyle = "#f4f7f5";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#263f33";
    ctx.font = "bold 44px Arial";
    ctx.fillText(title, 55, 72, 914);

    ctx.font = "25px Arial";
    ctx.fillText(subtitle, 55, 121, 914);

    menu.buttons = [];

    const startY = 160;
    const buttonHeight = 64;
    const step = 76;

    items.forEach((item, index) => {
      const x = 55;
      const y = startY + index * step;
      const w = 914;
      const h = buttonHeight;
      const pressed = index === menu.pressedIndex;
      const offset = pressed ? 4 : 0;

      const baseColor = item.color || "#dfe9e3";
      const fill = pressed ? "#bdcfc4" : baseColor;

      ctx.fillStyle = "#aabeb0";
      ctx.fillRect(x, y + 4, w, h);

      ctx.fillStyle = fill;
      ctx.fillRect(x, y + offset, w, h);

      ctx.strokeStyle = item.selected
        ? "#244d35"
        : "#aabeb0";

      ctx.lineWidth = item.selected ? 5 : 2;
      ctx.strokeRect(x, y + offset, w, h);

      ctx.fillStyle = "#213b2d";
      ctx.font = item.selected
        ? "bold 28px Arial"
        : "28px Arial";

      ctx.fillText(
        (item.selected ? "✓ " : "") + item.label,
        x + 20,
        y + 42 + offset,
        w - 40
      );

      menu.buttons.push({
        x,
        y,
        w,
        h,
        label: item.label,
        action: item.action
      });
    });

    ctx.fillStyle = menu.message ? "#dcefe2" : "#edf2ee";
    ctx.fillRect(35, 1078, 954, 53);

    ctx.fillStyle = "#244d35";
    ctx.font = "bold 24px Arial";
    ctx.fillText(
      menu.message || "Mit Laser + Trigger auswählen",
      55,
      1113,
      914
    );

    ctx.fillStyle = "#607668";
    ctx.font = "22px Arial";
    ctx.fillText(
      footer || "B/Y schließt · Raumdesign-1",
      55,
      1160,
      914
    );

    menu.texture.needsUpdate = true;
  }

  function renderThemes(menu) {
    const current = F.RoomThemes.currentTheme();

    const items = DEFINITIONS.map(item => ({
      label: item.title,
      selected: current === item.id,
      color:
        item.id === "island"
          ? "#f0e4be"
          : item.id === "jungle"
            ? "#d5e5ce"
            : item.id === "castle"
              ? "#e2d4dc"
              : item.id === "future"
                ? "#cce7ec"
                : "#dfe9e3",

      action: () => F.RoomThemes.choose(item.id)
    }));

    items.push({
      label: "Originalgestaltung wiederherstellen",
      selected: current === "original",
      action: () => F.RoomThemes.choose("original")
    });

    items.push({
      label: "Ausgewähltes Design für alle Räume übernehmen …",
      color: "#d6e0f1",

      action: () => {
        menu.fkcThemeForAll = F.RoomThemes.currentTheme();
        menu.navigate("room-themes-all");
      }
    });

    items.push({
      label: "Zurück zum Hauptmenü",
      action: () => menu.navigate("home")
    });

    paintMenu(
      menu,
      "Raumdesign",
      F.RoomThemes.currentTitle() +
        " · Lehrinhalte bleiben an ihren Positionen",
      items,
      storageAvailable
        ? "Lokal pro Browser/Brille · B/Y schließt · Raumdesign-1"
        : "Speicherung nicht verfügbar · gilt für diese Sitzung"
    );
  }

  function renderAllConfirmation(menu) {
    const theme = validTheme(menu.fkcThemeForAll)
      ? menu.fkcThemeForAll
      : F.RoomThemes.currentTheme();

    paintMenu(
      menu,
      "Für alle Räume übernehmen?",
      themeTitle(theme),
      [
        {
          label: "Ja, für Begrüßung, acht Vorlesungen und zwei Teams",
          color: "#d2e6d6",
          action: () => F.RoomThemes.applyToAll(theme)
        },
        {
          label: "Abbrechen",
          action: () => menu.navigate("room-themes")
        }
      ],
      "Nur auf diesem Browser/dieser Brille · keine Synchronisierung"
    );

    const ctx = menu.ctx;
    ctx.fillStyle = "#30493b";
    ctx.font = "28px Arial";

    [
      "Bisherige raumweise Designauswahlen werden ersetzt.",
      "Andere Räume erhalten das Design beim nächsten Betreten.",
      "Modelle, Folien und Demonstrationen werden nicht verschoben.",
      "Zeichnungen auf Lehrinhalten bleiben im aktuellen Raum erhalten.",
      "Zeichnungen auf ausgetauschten Raumflächen werden gelöscht."
    ].forEach((line, index) => {
      ctx.fillText(line, 55, 390 + index * 48, 914);
    });

    menu.texture.needsUpdate = true;
  }

  F.Menu.render = function () {
    if (!this.root) return;

    if (this.page === "room-themes") {
      renderThemes(this);
      return;
    }

    if (this.page === "room-themes-all") {
      renderAllConfirmation(this);
      return;
    }

    previousRender.call(this);

    if (this.page !== "home") return;

    /*
     * Vorherige Wrapper haben ihre Demo-Buttons bereits
     * eingetragen. Aktionen und Labels werden übernommen.
     */
    const items = this.buttons.map(item => ({
      label: item.label,
      action: item.action,
      color: "#dfe9e3"
    }));

    items.splice(4, 0, {
      label: "Raumdesign",
      color: "#d6e0f1",
      action: () => this.navigate("room-themes")
    });

    const target =
      this.target && this.target.isConnected
        ? this.target
        : null;

    const subtitle = target
      ? (
          target.classList.contains("interactable")
            ? target.dataset.title || "Ausgewähltes Modell"
            : "Ausgewählte Zeichenfläche"
        )
      : F.RoomThemes.currentTitle();

    paintMenu(
      this,
      "FKC-VR · Menü",
      subtitle,
      items,
      "B/Y schließt · Raumdesign & bestehende Werkzeuge · Raumdesign-1"
    );
  };
})(window.FKCVR);
