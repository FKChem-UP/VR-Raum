"use strict";

(function (F) {
  /*
   * ============================================================
   * RAUMAUFBAU — GALERIE-3
   * ============================================================
   *
   * - Begrüßungsmodelle aus den zentralen Raumdaten.
   * - Podestbeschriftungen innerhalb der goldenen Rahmen.
   * - Automatische Schriftanpassung und Zeilenumbrüche.
   * - Ablauf.jpg vollständig in das mittlere Wandfeld eingepasst.
   * - Begrüßungsmodelle auf die Podestoberkante setzen.
   *
   * Die bestehende fkc-normalize-Komponente bleibt zuständig
   * für Modellskalierung und Hitboxen.
   *
   * Builder-Schnittstelle, Raumpositionen und Museumsgestaltung
   * bleiben erhalten.
   */

  const THREE = AFRAME.THREE;
  const create = F.create;
  const V = THREE.Vector3;

  const WELCOME_PEDESTAL_TOP = 0.9625;
  const WELCOME_MODEL_GAP = 0.015;

  /*
   * ============================================================
   * GRUNDGEOMETRIE
   * ============================================================
   */

  function box(parent, x, y, z, width, height, depth, color, extra) {
    return create("a-box", {
      position: {x, y, z},
      width,
      height,
      depth,
      material: Object.assign({
        color,
        roughness: 0.8,
        metalness: 0
      }, extra || {})
    }, parent);
  }

  function gold(parent, x, y, z, w, h, d, color) {
    return box(parent, x, y, z, w, h, d, color || "#b38b39", {
      metalness: 0.55,
      roughness: 0.36
    });
  }

  function image(draw, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width || 1024;
    canvas.height = height || 576;

    draw(canvas.getContext("2d"), canvas.width, canvas.height);

    return canvas.toDataURL("image/png");
  }

  /*
   * Zeilenumbruch ohne horizontales Stauchen.
   * Auch ungewöhnlich lange Einzelwörter werden bei Bedarf geteilt.
   */
  function wrapCanvasText(ctx, value, maxWidth) {
    const result = [];

    String(value || "").split("\n").forEach(paragraph => {
      const words = paragraph.split(/\s+/).filter(Boolean);
      let line = "";

      words.forEach(word => {
        const candidate = line ? line + " " + word : word;

        if (ctx.measureText(candidate).width <= maxWidth) {
          line = candidate;
          return;
        }

        if (line) {
          result.push(line);
          line = "";
        }

        if (ctx.measureText(word).width <= maxWidth) {
          line = word;
          return;
        }

        let piece = "";

        Array.from(word).forEach(character => {
          const next = piece + character;

          if (piece && ctx.measureText(next).width > maxWidth) {
            result.push(piece);
            piece = character;
          } else {
            piece = next;
          }
        });

        line = piece;
      });

      result.push(line);
    });

    return result;
  }

  /*
   * Text in einen festgelegten Innenbereich einpassen.
   * Keine fillText-maxWidth-Stauchung.
   */
  function fittedText(
    ctx, value, x, y, width, height, options
  ) {
    const o = Object.assign({
      maxSize: 80,
      minSize: 10,
      weight: "bold",
      family: "Arial, sans-serif",
      lineHeight: 1.15,
      color: "#222222"
    }, options || {});

    let size = o.maxSize;
    let lines = [];

    while (size >= o.minSize) {
      ctx.font = o.weight + " " + size + "px " + o.family;
      lines = wrapCanvasText(ctx, value, width);

      const fitsWidth = lines.every(
        line => ctx.measureText(line).width <= width
      );

      const fitsHeight =
        lines.length * size * o.lineHeight <= height;

      if (fitsWidth && fitsHeight) break;
      size -= 1;
    }

    size = Math.max(o.minSize, size);
    ctx.font = o.weight + " " + size + "px " + o.family;
    lines = wrapCanvasText(ctx, value, width);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();

    ctx.fillStyle = o.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const lineHeight = size * o.lineHeight;
    const startY =
      y + height / 2 - (lines.length - 1) * lineHeight / 2;

    lines.forEach((line, index) => {
      ctx.fillText(
        line,
        x + width / 2,
        startY + index * lineHeight
      );
    });

    ctx.restore();
  }

  /*
   * Allgemeine Tafeln:
   * Alle Textzeilen werden innerhalb der Canvasfläche angeordnet.
   */
  function textBoard(lines, background, color) {
    return image((ctx, w, h) => {
      ctx.fillStyle = background || "#f8faf8";
      ctx.fillRect(0, 0, w, h);

      if (!lines.length) return;

      const ink = color || "#304c3d";

      if (lines.length === 1) {
        fittedText(
          ctx, lines[0],
          54, 44, w - 108, h - 88,
          {maxSize: 100, color: ink}
        );
        return;
      }

      fittedText(
        ctx, lines[0],
        54, 30, w - 108, 128,
        {maxSize: 60, color: ink}
      );

      const bodyTop = 178;
      const bodyBottom = h - 38;
      const rowHeight = (bodyBottom - bodyTop) / (lines.length - 1);

      lines.slice(1).forEach((line, index) => {
        fittedText(
          ctx, line,
          58,
          bodyTop + index * rowHeight + 3,
          w - 116,
          rowHeight - 6,
          {
            maxSize: 36,
            weight: "normal",
            color: ink
          }
        );
      });
    });
  }

  const nameImages = new Map();

  function nameImage(title) {
    const key = "galerie-3-plaque:" + title;
    if (nameImages.has(key)) return nameImages.get(key);

    const src = image((ctx, w, h) => {
      ctx.fillStyle = "#fffdf8";
      ctx.fillRect(0, 0, w, h);

      /*
       * Feiner Innenrand der Tafel.
       * Der räumliche goldene Podestrahmen liegt außerhalb.
       */
      ctx.strokeStyle = "#e4ca83";
      ctx.lineWidth = 4;
      ctx.strokeRect(14, 14, w - 28, h - 28);

      fittedText(
        ctx, title,
        56, 42, w - 112, h - 84,
        {
          maxSize: 120,
          minSize: 18,
          lineHeight: 1.12,
          color: "#000000"
        }
      );
    }, 1024, 480);

    nameImages.set(key, src);
    return src;
  }

  /*
   * ============================================================
   * GERAHMTE FLÄCHEN
   * ============================================================
   */

  function panel(parent, position, rotation, width, height, src, roomId) {
    const group = create("a-entity", {position, rotation}, parent);

    box(group, 0, 0, -0.025,
      width + 0.12, height + 0.12, 0.08, "#c8d2cb");

    const screen = create("a-plane", {
      position: "0 0 0.025",
      width,
      height,
      material: {
        shader: "flat",
        src,
        color: "#ffffff"
      }
    }, group);

    if (roomId) {
      screen.classList.add("vr-action");
      screen.dataset.roomId = roomId;
    }

    return group;
  }

  function frameLayer(parent, c, offset, thickness, depth, z, color) {
    const w = c.posterWidth;
    const h = c.posterHeight;

    gold(parent, 0, -(h / 2 + offset), z,
      w + 2 * offset + thickness, thickness, depth, color);

    gold(parent, 0, h / 2 + offset, z,
      w + 2 * offset + thickness, thickness, depth, color);

    gold(parent, -(w / 2 + offset), 0, z,
      thickness, h + 2 * offset, depth, color);

    gold(parent, w / 2 + offset, 0, z,
      thickness, h + 2 * offset, depth, color);
  }

  function framedPanel(
    parent, position, rotation, width, height, src, roomId, colors
  ) {
    const group = panel(
      parent, position, rotation, width, height, src, roomId
    );

    const c = {posterWidth: width, posterHeight: height};

    frameLayer(group, c, 0.045, 0.055, 0.08, 0.055, colors.gold);
    frameLayer(group, c, 0.105, 0.035, 0.06, 0.04, colors.goldLight);

    return group;
  }

  /*
   * ============================================================
   * BILD OHNE BESCHNEIDEN IN EINEN RAHMEN EINPASSEN
   * ============================================================
   *
   * Das Bild wird in eine Canvasfläche mit dem Seitenverhältnis
   * der tatsächlichen a-plane gezeichnet.
   *
   * Dadurch bleibt es unverzerrt und vollständig sichtbar.
   */

  if (!AFRAME.components["fkc-gallery-contained-image"]) {
    AFRAME.registerComponent("fkc-gallery-contained-image", {
      schema: {
        src: {type: "string", default: ""},
        width: {type: "number", default: 3.72},
        height: {type: "number", default: 2.55},
        background: {type: "color", default: "#fffdf8"}
      },

      init: function () {
        this.requestId = 0;
        this.imageElement = null;
      },

      update: function () {
        const data = this.data;
        const requestId = ++this.requestId;

        if (this.imageElement) {
          this.imageElement.onload = null;
          this.imageElement.onerror = null;
        }

        if (!data.src) return;

        const img = new Image();
        this.imageElement = img;
        img.crossOrigin = "anonymous";

        img.onload = () => {
          if (requestId !== this.requestId) return;

          try {
            const width = 2048;
            const height = Math.round(
              width * data.height / data.width
            );

            const src = image((ctx, w, h) => {
              ctx.fillStyle = data.background;
              ctx.fillRect(0, 0, w, h);

              const margin = 32;
              const availableW = w - margin * 2;
              const availableH = h - margin * 2;

              const scale = Math.min(
                availableW / img.naturalWidth,
                availableH / img.naturalHeight
              );

              const drawW = img.naturalWidth * scale;
              const drawH = img.naturalHeight * scale;

              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = "high";

              ctx.drawImage(
                img,
                (w - drawW) / 2,
                (h - drawH) / 2,
                drawW,
                drawH
              );
            }, width, height);

            this.el.setAttribute("material", "src", src);
            this.el.emit("fkc-gallery-image-ready", {
              src: data.src
            });
          } catch (error) {
            this.showError(data.src, error);
          }
        };

        img.onerror = () => {
          if (requestId !== this.requestId) return;
          this.showError(
            data.src,
            new Error("Bild konnte nicht geladen werden.")
          );
        };

        img.src = data.src;
      },

      showError: function (src, error) {
        console.error(
          "GALERIE-3: Poster konnte nicht geladen werden:",
          src,
          error
        );

        this.el.setAttribute("material", "src", textBoard([
          "Poster nicht geladen",
          "Bitte Dateipfad und Schreibweise prüfen:",
          src
        ], "#fffdf8", "#222222"));
      },

      remove: function () {
        this.requestId++;

        if (this.imageElement) {
          this.imageElement.onload = null;
          this.imageElement.onerror = null;
          this.imageElement = null;
        }
      }
    });
  }

  /*
   * ============================================================
   * BEGRÜSSUNGSMODELLE AUF DAS PODEST SETZEN
   * ============================================================
   *
   * Erst nach der vorhandenen Normalisierung aktiv.
   * Es wird nur die Anfangshöhe des gesamten Modellroots geändert.
   * Visual, Hitbox und Manipulationskörper bleiben zusammen.
   */

  if (!AFRAME.components["fkc-gallery-seat-model"]) {
    AFRAME.registerComponent("fkc-gallery-seat-model", {
      schema: {
        top: {type: "number", default: WELCOME_PEDESTAL_TOP},
        gap: {type: "number", default: WELCOME_MODEL_GAP}
      },

      init: function () {
        this.finished = false;
        this.readyFrames = 0;
        this.bounds = new THREE.Box3();
        this.inverseParent = new THREE.Matrix4();
      },

      tick: function () {
        if (this.finished || !this.el.modelReady) return;

        /*
         * Zwei zusätzliche Frames lassen vorhandenen
         * model-loaded-Handlern Zeit für ihre Anpassungen.
         */
        this.readyFrames++;
        if (this.readyFrames < 3) return;

        const visual = this.el.querySelector(".model-visual");
        const parent = this.el.object3D.parent;

        if (!visual || !parent) return;
        if (!visual.getObject3D("mesh")) return;

        parent.updateWorldMatrix(true, true);

        this.bounds.setFromObject(visual.object3D);
        if (this.bounds.isEmpty()) return;

        this.inverseParent.copy(parent.matrixWorld).invert();
        this.bounds.applyMatrix4(this.inverseParent);

        const adjustment =
          this.data.top + this.data.gap - this.bounds.min.y;

        if (!Number.isFinite(adjustment)) return;

        const position = this.el.object3D.position.clone();
        position.y += adjustment;

        this.el.setAttribute("position", {
          x: position.x,
          y: position.y,
          z: position.z
        });

        if (this.el.homePosition) {
          this.el.homePosition.copy(position);
        }

        this.finished = true;
        this.el.emit("fkc-gallery-model-seated");
      }
    });
  }

  /*
   * ============================================================
   * NAVIGATION UND LICHT
   * ============================================================
   */

  function makeWalkable(config, obstacles) {
    return function (x, z) {
      if (
        Math.abs(x) > config.width / 2 - 0.45 ||
        Math.abs(z) > config.depth / 2 - 0.45
      ) return false;

      return !obstacles.some(obstacle => (
        Math.abs(x - obstacle.x) < obstacle.width / 2 + 0.28 &&
        Math.abs(z - obstacle.z) < obstacle.depth / 2 + 0.28
      ));
    };
  }

  function lighting(parent, museum) {
    create("a-entity", {
      light: {
        type: "ambient",
        color: museum ? "#fff7e6" : "#fffaf0",
        intensity: museum ? 0.7 : 0.8
      }
    }, parent);

    create("a-entity", {
      position: "-7 11 4",
      light: {
        type: "directional",
        color: "#fff4de",
        intensity: museum ? 0.65 : 0.7
      }
    }, parent);

    create("a-entity", {
      position: "8 10 -6",
      light: {
        type: "directional",
        color: museum ? "#e5f2f4" : "#ffffff",
        intensity: museum ? 0.4 : 0.35
      }
    }, parent);
  }

  /*
   * ============================================================
   * MODELLE
   * ============================================================
   */

  function makeModel(parent, s, index, c, position, placeholderColor) {
    const root = create("a-entity", {
      id: c.id + "-model-" + (index + 1),
      class: "interactable",
      position
    }, parent);

    root.dataset.title = s.title;
    root.homePosition = new V(position.x, position.y, position.z);
    root.modelReady = false;
    root.fkcInfo = s.info || "";
    root.fkcModelSize = c.modelSize;

    /*
     * Begrüßungsmodelle erhalten dieselbe horizontale Ausrichtung
     * wie das jeweilige Podest.
     */
    if (c.kind === "welcome" && s.presentationRotation) {
      root.setAttribute("rotation", s.presentationRotation);
    }

    const body = create("a-entity", {
      class: "manip-body"
    }, root);

    create("a-box", {
      class: "hitbox",
      width: c.modelSize + 0.06,
      height: c.modelSize + 0.06,
      depth: c.modelSize + 0.06,
      visible: false
    }, body);

    if (s.model) {
      const visual = create("a-entity", {
        class: "model-visual",
        "fkc-normalize": {
          targetSize: c.modelSize,
          padding: 0.06
        }
      }, body);

      visual.addEventListener("model-error", event => {
        console.error(
          "GALERIE-3: Modell konnte nicht geladen werden:",
          s.model,
          event.detail
        );
      });

      visual.setAttribute("gltf-model", "url(" + s.model + ")");
    } else {
      create("a-sphere", {
        class: "model-visual",
        radius: c.modelSize / 2,
        "segments-width": 20,
        "segments-height": 12,
        material: {
          color: placeholderColor || "#79aa98",
          roughness: 0.4,
          metalness: 0.12
        }
      }, body);

      root.modelReady = true;
    }

    root.setAttribute("fkc-manipulable", "");

    if (c.kind === "welcome") {
      root.setAttribute("fkc-gallery-seat-model", {
        top: WELCOME_PEDESTAL_TOP,
        gap: WELCOME_MODEL_GAP
      });
    }

    return root;
  }

  /*
   * ============================================================
   * BODENTEXTUREN
   * ============================================================
   */

  let parquetImage = null;
  let marbleImage = null;

  function parquet() {
    if (parquetImage) return parquetImage;

    parquetImage = image((ctx, w, h) => {
      let seed = 1234567;

      function random() {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      }

      const cell = 128;
      const plank = cell / 4;

      ctx.fillStyle = "#725037";
      ctx.fillRect(0, 0, w, h);

      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const vertical = (row + col) % 2 === 0;

          for (let p = 0; p < 4; p++) {
            ctx.save();
            ctx.translate(col * cell, row * cell);

            if (vertical) {
              ctx.translate(cell, 0);
              ctx.rotate(Math.PI / 2);
            }

            const y = p * plank;
            const v = Math.floor(random() * 26);
            const gradient = ctx.createLinearGradient(
              0, y, 0, y + plank
            );

            gradient.addColorStop(
              0, `rgb(${169 + v},${115 + v},${65 + v})`
            );
            gradient.addColorStop(
              0.5, `rgb(${189 + v},${134 + v},${79 + v})`
            );
            gradient.addColorStop(
              1, `rgb(${153 + v},${101 + v},${55 + v})`
            );

            ctx.fillStyle = gradient;
            ctx.fillRect(1, y + 1, cell - 2, plank - 2);

            for (let g = 0; g < 16; g++) {
              const gy = y + 3 + random() * (plank - 6);

              ctx.strokeStyle = random() > 0.5
                ? "rgba(65,35,12,0.13)"
                : "rgba(255,222,165,0.16)";

              ctx.lineWidth = 0.5 + random();
              ctx.beginPath();
              ctx.moveTo(2, gy);

              ctx.bezierCurveTo(
                35, gy + random() * 3 - 1.5,
                85, gy + random() * 3 - 1.5,
                cell - 2, gy
              );

              ctx.stroke();
            }

            ctx.restore();
          }
        }
      }
    }, 1024, 1024);

    return parquetImage;
  }

  function marble() {
    if (marbleImage) return marbleImage;

    marbleImage = image((ctx, w, h) => {
      ctx.fillStyle = "#f4f1e9";
      ctx.fillRect(0, 0, w, h);

      let seed = 85271;

      function random() {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      }

      for (let i = 0; i < 45; i++) {
        const y = random() * h;

        ctx.strokeStyle = i % 4 === 0
          ? "rgba(177,158,115,0.13)"
          : "rgba(151,151,146,0.10)";

        ctx.lineWidth = 0.8 + random() * 2;
        ctx.beginPath();
        ctx.moveTo(-20, y);

        ctx.bezierCurveTo(
          w * 0.30, y + random() * 180 - 90,
          w * 0.65, y + random() * 180 - 90,
          w + 20, y + random() * 80 - 40
        );

        ctx.stroke();
      }

      ctx.strokeStyle = "rgba(177,169,153,0.18)";
      ctx.lineWidth = 2;

      for (let i = 0; i <= 4; i++) {
        const p = i * w / 4;

        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, h);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, p);
        ctx.lineTo(w, p);
        ctx.stroke();
      }
    }, 1024, 1024);

    return marbleImage;
  }

  /*
   * ============================================================
   * GOLDENES BODENDEKOR
   * ============================================================
   */

  function floorGoldLine(parent, x1, z1, x2, z2, width, color) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const length = Math.sqrt(dx * dx + dz * dz);

    const stripe = gold(
      parent,
      (x1 + x2) / 2,
      0.009,
      (z1 + z2) / 2,
      length,
      0.004,
      width,
      color
    );

    stripe.setAttribute("rotation", {
      x: 0,
      y: -Math.atan2(dz, dx) * 180 / Math.PI,
      z: 0
    });

    return stripe;
  }

  function floorDiamond(parent, c) {
    const group = create("a-entity", {
      id: "welcome-floor-diamond"
    }, parent);

    function outline(rx, rz, width, color) {
      const points = [
        {x: 0, z: -rz},
        {x: rx, z: 0},
        {x: 0, z: rz},
        {x: -rx, z: 0}
      ];

      points.forEach((point, index) => {
        const next = points[(index + 1) % points.length];

        floorGoldLine(
          group,
          point.x, point.z,
          next.x, next.z,
          width, color
        );
      });
    }

    outline(2.6, 3.0, 0.065, c.colors.gold);
    outline(2.35, 2.71, 0.025, c.colors.goldLight);
    outline(1.02, 1.18, 0.035, c.colors.gold);

    const outer = [
      {x: 0, z: -2.71},
      {x: 2.35, z: 0},
      {x: 0, z: 2.71},
      {x: -2.35, z: 0}
    ];

    const inner = [
      {x: 0, z: -1.18},
      {x: 1.02, z: 0},
      {x: 0, z: 1.18},
      {x: -1.02, z: 0}
    ];

    outer.forEach((point, index) => {
      const target = inner[index];

      floorGoldLine(
        group,
        point.x, point.z,
        target.x, target.z,
        0.03, c.colors.gold
      );
    });
  }

  /*
   * ============================================================
   * BEGRÜSSUNGSRAUM: RAUMTAFELN UND WÄNDE
   * ============================================================
   */

  function welcomeCard(room) {
    return image((ctx, w, h) => {
      ctx.fillStyle = "#fffdf8";
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = "#c5a052";
      ctx.lineWidth = 6;
      ctx.strokeRect(24, 24, w - 48, h - 48);

      ctx.strokeStyle = "#e3ce99";
      ctx.lineWidth = 2;
      ctx.strokeRect(36, 36, w - 72, h - 72);

      fittedText(
        ctx,
        room.posterTitle || room.title,
        65, 70, w - 130, 240,
        {maxSize: 62, color: "#222222"}
      );

      ctx.strokeStyle = "#c5a052";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(220, 345);
      ctx.lineTo(w - 220, 345);
      ctx.stroke();

      fittedText(
        ctx,
        "Mit Laser + Trigger betreten",
        65, 435, w - 130, 75,
        {
          maxSize: 32,
          weight: "normal",
          color: "#6f6757"
        }
      );
    });
  }

  function decorativeWall(
    parent, c, position, rotation, length, centers, fieldWidth
  ) {
    const group = create("a-entity", {position, rotation}, parent);

    box(group, 0, c.height / 2, 0,
      length, c.height, 0.30, c.colors.wall);

    box(group, 0, 0.12, 0.20,
      length - 0.25, 0.24, 0.10, c.colors.creamDark);

    gold(group, 0, 0.26, 0.255,
      length - 0.25, 0.028, 0.025, c.colors.gold);

    box(group, 0, 0.70, 0.18,
      length - 0.25, 0.82, 0.055, c.colors.cream);

    gold(group, 0, 1.14, 0.23,
      length - 0.25, 0.025, 0.035, c.colors.gold);

    box(group, 0, c.height - 0.25, 0.23,
      length, 0.18, 0.22, c.colors.creamDark);

    box(group, 0, c.height - 0.10, 0.28,
      length, 0.12, 0.32, c.colors.cream);

    gold(group, 0, c.height - 0.38, 0.245,
      length - 0.10, 0.035, 0.055, c.colors.gold);

    centers.forEach(x => {
      const frame = create("a-entity", {
        position: {x, y: 2.95, z: 0.19}
      }, group);

      const fc = {
        posterWidth: fieldWidth,
        posterHeight: 3.35
      };

      frameLayer(
        frame, fc, 0, 0.022, 0.025, 0.025, c.colors.gold
      );
      frameLayer(
        frame, fc, 0.055, 0.012, 0.018, 0.019, c.colors.goldLight
      );

      [-1, 1].forEach(sign => {
        create("a-sphere", {
          position: {x: 0, y: sign * 1.69, z: 0.03},
          radius: 0.052,
          "segments-width": 8,
          "segments-height": 6,
          material: {
            color: c.colors.gold,
            metalness: 0.55,
            roughness: 0.36
          }
        }, frame);
      });
    });
  }

  function welcomeWalls(parent, c) {
    decorativeWall(parent, c,
      {x: -c.width / 2, y: 0, z: 0},
      "0 90 0", c.depth, [-4, 0, 4], 3.45);

    decorativeWall(parent, c,
      {x: c.width / 2, y: 0, z: 0},
      "0 -90 0", c.depth, [-4, 0, 4], 3.45);

    decorativeWall(parent, c,
      {x: 0, y: 0, z: -c.depth / 2},
      "0 0 0", c.width, [-6, -2, 2, 6], 3.45);

    decorativeWall(parent, c,
      {x: 0, y: 0, z: c.depth / 2},
      "0 180 0", c.width, [-5, 0, 5], 4.1);
  }

  /*
   * ============================================================
   * BEGRÜSSUNGSRAUM: LEUCHTEN
   * ============================================================
   */

  function ring(parent, radius, tube, color, extra) {
    return create("a-torus", {
      radius,
      "radius-tubular": tube,
      "segments-radial": 8,
      "segments-tubular": 32,
      rotation: "90 0 0",
      material: Object.assign({
        color,
        metalness: 0.55,
        roughness: 0.36
      }, extra || {})
    }, parent);
  }

  function ceilingPendant(parent, c, z) {
    const group = create("a-entity", {
      position: {x: 0, y: c.height - 0.85, z}
    }, parent);

    gold(group, 0, 0.40, 0,
      0.045, 0.80, 0.045, c.colors.gold);

    const crown = create("a-entity", {
      position: "0 0.78 0"
    }, group);

    ring(crown, 0.25, 0.035, c.colors.gold);
    ring(group, 0.87, 0.045, c.colors.gold);

    const glow = create("a-entity", {
      position: "0 -0.035 0"
    }, group);

    ring(glow, 0.87, 0.025, "#fff4cf", {
      shader: "flat",
      metalness: 0
    });

    ring(group, 0.38, 0.025, c.colors.goldLight);

    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;

      const arm = create("a-entity", {
        rotation: {x: 0, y: i * 60, z: 0}
      }, group);

      gold(arm, 0, 0, 0.43,
        0.024, 0.025, 0.86, c.colors.gold);

      create("a-cylinder", {
        position: {
          x: Math.sin(angle) * 0.87,
          y: 0.11,
          z: Math.cos(angle) * 0.87
        },
        radius: 0.09,
        height: 0.20,
        "segments-radial": 12,
        material: {
          color: "#fffdf8",
          roughness: 0.45,
          emissive: "#fff0ce",
          emissiveIntensity: 0.25
        }
      }, group);
    }
  }

  function welcomeSconce(parent, position, rotation, c) {
    const group = create("a-entity", {position, rotation}, parent);

    gold(group, 0, 0, 0,
      0.18, 0.32, 0.045, c.colors.gold);

    gold(group, 0, -0.03, 0.13,
      0.035, 0.035, 0.26, c.colors.gold);

    create("a-cylinder", {
      position: "0 0.14 0.25",
      radius: 0.115,
      height: 0.25,
      "segments-radial": 12,
      material: {
        color: "#fffdf8",
        roughness: 0.5,
        emissive: "#fff1cc",
        emissiveIntensity: 0.35
      }
    }, group);

    gold(group, 0, 0.275, 0.25,
      0.24, 0.022, 0.24, c.colors.goldLight);
  }

  /*
   * ============================================================
   * BEGRÜSSUNGSPODESTE
   * ============================================================
   */

  function welcomePedestal(parent, exhibit, p, c) {
    const group = create("a-entity", {
      position: {x: p.model.x, y: 0, z: p.model.z},
      rotation: p.rotation
    }, parent);

    gold(group, 0, 0.065, 0,
      1.0, 0.13, 1.0, c.colors.goldDark);

    gold(group, 0, 0.145, 0,
      0.96, 0.035, 0.96, c.colors.goldLight);

    box(group, 0, 0.52, 0,
      0.84, 0.72, 0.84, c.colors.cream, {
        roughness: 0.36
      });

    [0, 90, 180, 270].forEach(angle => {
      const side = create("a-entity", {
        rotation: {x: 0, y: angle, z: 0}
      }, group);

      gold(side, -0.35, 0.52, 0.425,
        0.015, 0.61, 0.018, c.colors.gold);

      gold(side, 0.35, 0.52, 0.425,
        0.015, 0.61, 0.018, c.colors.gold);

      gold(side, 0, 0.215, 0.425,
        0.71, 0.015, 0.018, c.colors.gold);

      gold(side, 0, 0.825, 0.425,
        0.71, 0.015, 0.018, c.colors.gold);
    });

    gold(group, 0, 0.895, 0,
      0.94, 0.045, 0.94, c.colors.gold);

    box(group, 0, 0.94, 0,
      1.0, 0.045, 1.0, "#fffdf8", {
        roughness: 0.3
      });

    /*
     * Goldrahmen-Innenbreite: ca. 0.685 m.
     * Neue Tafel: 0.64 m breit, also sicher innerhalb.
     * Seitenverhältnis 0.64 / 0.30 = 1024 / 480.
     */
    create("a-plane", {
      position: "0 0.52 0.445",
      width: 0.64,
      height: 0.30,
      material: {
        shader: "flat",
        color: "#ffffff",
        src: nameImage(exhibit.title)
      }
    }, group);
  }

  function welcomePlacements(c) {
    const result = [];

    /*
     * Bisherige Reihenfolge und Positionen bleiben erhalten.
     */
    [4, 0, -4].forEach(z => {
      result.push({
        poster: {x: -c.width / 2 + 0.28, y: c.posterY, z},
        model: {x: -c.width / 2 + c.modelDistance, y: c.modelY, z},
        rotation: "0 90 0"
      });
    });

    [-6, -2, 2, 6].forEach(x => {
      result.push({
        poster: {x, y: c.posterY, z: -c.depth / 2 + 0.28},
        model: {x, y: c.modelY, z: -c.depth / 2 + c.modelDistance},
        rotation: "0 0 0"
      });
    });

    [-4, 0, 4].forEach(z => {
      result.push({
        poster: {x: c.width / 2 - 0.28, y: c.posterY, z},
        model: {x: c.width / 2 - c.modelDistance, y: c.modelY, z},
        rotation: "0 -90 0"
      });
    });

    return result;
  }

  function buildWelcome(parent, c, rooms) {
    const obstacles = [];

    /*
     * Wichtig für vorhandene Menüwrapper:
     * Die erste nicht bedienbare a-plane bleibt die Bedienungstafel.
     */
    framedPanel(parent,
      {x: 5, y: 2.65, z: c.depth / 2 - 0.28},
      "0 180 0", 3.3, 3.3 * 9 / 16,
      textBoard([
        "Bedienung",
        "Links: laufen · Rechts: drehen",
        "Grip: greifen · 2 Hände: skalieren",
        "Trigger: Oberflächen bemalen",
        "Laserfarbe = Malfarbe",
        "B/Y: Menü · Größen & Komfort"
      ], "#fffdf8", "#222222"),
      null, c.colors
    );

    framedPanel(parent,
      {x: -5, y: 2.65, z: c.depth / 2 - 0.28},
      "0 180 0", 3.3, 3.3 * 9 / 16,
      textBoard([
        "Willkommen",
        "Festkörperchemie · Universität Potsdam",
        "8 Räume für die Vorlesung",
        "2 Räume für die Teamarbeit",
        "Raumtafeln mit Trigger auswählen",
        "Mehrspielerbetrieb folgt später"
      ], "#fffdf8", "#222222"),
      null, c.colors
    );

    /*
     * Mittleres Wandfeld:
     * Dekorativer Rahmen 4.1 × 3.35 m.
     *
     * Neue Bildfläche 3.72 × 2.55 m.
     * Einschließlich äußerem Bilderrahmen ca. 3.965 × 2.795 m.
     * Damit bleibt die gesamte Tafel innerhalb des Wandfeldes.
     */
    const posterWidth = 3.72;
    const posterHeight = 2.55;

    const poster = framedPanel(parent,
      {x: 0, y: 2.95, z: c.depth / 2 - 0.28},
      "0 180 0",
      posterWidth,
      posterHeight,
      image((ctx, w, h) => {
        ctx.fillStyle = "#fffdf8";
        ctx.fillRect(0, 0, w, h);
      }),
      null,
      c.colors
    );

    poster.id = "welcome-ablauf-poster";

    const posterScreen = poster.querySelector("a-plane");

    posterScreen.setAttribute("fkc-gallery-contained-image", {
      src: c.welcomePoster || "assets/Bilder/Ablauf.jpg",
      width: posterWidth,
      height: posterHeight,
      background: "#fffdf8"
    });

    box(parent, 0, -0.08, 0,
      c.width, 0.16, c.depth, "#eee9de");

    box(parent, 0, 0.003, 0,
      c.width - 0.30, 0.006, c.depth - 0.30, "#ffffff", {
        src: marble(),
        repeat: "2 2",
        roughness: 0.46,
        metalness: 0.03
      });

    [-1, 1].forEach(sign => {
      gold(parent, 0, 0.008, sign * (c.depth / 2 - 0.53),
        c.width - 0.9, 0.008, 0.025, c.colors.gold);

      gold(parent, sign * (c.width / 2 - 0.53), 0.008, 0,
        0.025, 0.008, c.depth - 0.9, c.colors.gold);
    });

    floorDiamond(parent, c);
    welcomeWalls(parent, c);

    box(parent, 0, c.height + 0.08, 0,
      c.width, 0.16, c.depth, c.colors.cream);

    trim(parent, c.width - 1.5, c.depth - 1.5,
      c.height - 0.035, 0.06, 0.045, c.colors.goldLight);

    trim(parent, c.width - 1.8, c.depth - 1.8,
      c.height - 0.04, 0.025, 0.045, c.colors.gold);

    ceilingPendant(parent, c, -3);
    ceilingPendant(parent, c, 3);

    lighting(parent, false);

    const placements = welcomePlacements(c);

    rooms.slice(0, placements.length).forEach((room, index) => {
      const configured = (c.exhibits || []).find(
        exhibit => exhibit.roomId === room.id
      );

      const exhibit = configured || {
        roomId: room.id,
        title: room.title,
        model: ""
      };

      const p = placements[index];

      framedPanel(parent,
        p.poster,
        p.rotation,
        c.posterWidth,
        c.posterHeight,
        welcomeCard(room),
        room.id,
        c.colors
      );

      welcomePedestal(parent, exhibit, p, c);

      obstacles.push({
        x: p.model.x,
        z: p.model.z,
        width: 1.0,
        depth: 1.0
      });

      const modelData = Object.assign({}, exhibit, {
        presentationRotation:
          exhibit.presentationRotation || p.rotation,

        info: exhibit.info || (
          exhibit.model
            ? "Vorschau für " + room.title + ": " + exhibit.title
            : exhibit.title + "\n\n" +
              "Vorschau für " + room.title + ".\n" +
              "Die Kugel ist ein neutraler Platzhalter."
        )
      });

      makeModel(
        parent, modelData, index, c, p.model, "#ded7c3"
      );

      welcomeSconce(parent, {
        x: p.poster.x,
        y: 4.22,
        z: p.poster.z
      }, p.rotation, c);
    });

    return {
      spawn: c.spawn,
      isWalkable: makeWalkable(c, obstacles)
    };
  }

  /*
   * ============================================================
   * MUSEUMSRÄUME — BESTEHENDE GESTALTUNG
   * ============================================================
   */

  function trim(parent, width, depth, y, thickness, height, color) {
    box(parent, 0, y, -depth / 2,
      width + thickness, height, thickness, color);

    box(parent, 0, y, depth / 2,
      width + thickness, height, thickness, color);

    box(parent, -width / 2, y, 0,
      thickness, height, depth, color);

    box(parent, width / 2, y, 0,
      thickness, height, depth, color);
  }

  function museumWalls(parent, c) {
    const walls = [
      {
        position: {x: -c.width / 2, y: 0, z: 0},
        rotation: "0 90 0",
        length: c.depth
      },
      {
        position: {x: c.width / 2, y: 0, z: 0},
        rotation: "0 -90 0",
        length: c.depth
      },
      {
        position: {x: 0, y: 0, z: -c.depth / 2},
        rotation: "0 0 0",
        length: c.width
      },
      {
        position: {x: 0, y: 0, z: c.depth / 2},
        rotation: "0 180 0",
        length: c.width
      }
    ];

    walls.forEach(wall => {
      const group = create("a-entity", {
        position: wall.position,
        rotation: wall.rotation
      }, parent);

      box(group, 0, c.height / 2, 0,
        wall.length, c.height, 0.3, c.colors.wall);

      box(group, 0, 0.36, 0.17,
        wall.length - 0.3, 0.72, 0.07, c.colors.creamDark);

      box(group, 0, 0.075, 0.22,
        wall.length - 0.3, 0.15, 0.11, c.colors.cream);

      box(group, 0, 0.74, 0.23,
        wall.length - 0.3, 0.065, 0.13, c.colors.cream);

      gold(group, 0, 0.795, 0.205,
        wall.length - 0.3, 0.025, 0.055, c.colors.goldDark);

      box(group, 0, c.height - 0.52, 0.20,
        wall.length, 0.12, 0.14, c.colors.creamDark);

      box(group, 0, c.height - 0.37, 0.25,
        wall.length, 0.16, 0.24, c.colors.cream);

      box(group, 0, c.height - 0.20, 0.31,
        wall.length, 0.12, 0.36, c.colors.cream);

      gold(group, 0, c.height - 0.59, 0.20,
        wall.length - 0.1, 0.023, 0.045, c.colors.goldLight);
    });
  }

  function lamp(parent, x, y, z, tiltX, tiltZ) {
    const group = create("a-entity", {
      position: {x, y, z}
    }, parent);

    box(group, 0, 0.08, 0,
      0.035, 0.2, 0.035, "#343d38");

    const head = create("a-entity", {
      rotation: {x: tiltX, y: 0, z: tiltZ}
    }, group);

    create("a-cylinder", {
      radius: 0.095,
      height: 0.22,
      "segments-radial": 12,
      material: {
        color: "#343d38",
        metalness: 0.35,
        roughness: 0.5
      }
    }, head);

    create("a-cylinder", {
      position: "0 -0.115 0",
      radius: 0.077,
      height: 0.012,
      "segments-radial": 12,
      material: {
        shader: "flat",
        color: "#fff0bf"
      }
    }, head);
  }

  function museumCeiling(parent, c) {
    box(parent, 0, c.height + 0.08, 0,
      c.width + 0.3, 0.16, c.depth + 0.3, c.colors.cream);

    trim(parent, c.width - 2.4, c.depth - 2.4,
      c.height - 0.10, 0.12, 0.10, c.colors.creamDark);

    trim(parent, c.width - 2.8, c.depth - 2.8,
      c.height - 0.12, 0.055, 0.065, c.colors.cream);

    box(parent, 0, c.height - 0.045, 0,
      9.2, 0.035, 6.2, "#d3e8ec", {shader: "flat"});

    trim(parent, 9.5, 6.5,
      c.height - 0.11, 0.20, 0.18, c.colors.creamDark);

    trim(parent, 9.85, 6.85,
      c.height - 0.17, 0.14, 0.12, c.colors.cream);

    trim(parent, 10.1, 7.1,
      c.height - 0.21, 0.055, 0.06, c.colors.goldLight);

    [-3, -1.5, 0, 1.5, 3].forEach(x => {
      box(parent, x, c.height - 0.08, 0,
        0.055, 0.06, 6.2, c.colors.cream);
    });

    [-1.55, 0, 1.55].forEach(z => {
      box(parent, 0, c.height - 0.08, z,
        9.2, 0.06, 0.055, c.colors.cream);
    });

    [-10.3, 10.3].forEach(x => {
      box(parent, x, c.height - 0.65, 0,
        0.07, 0.065, c.depth - 3, "#343d38");

      [-8.1, -2.7, 2.7, 8.1].forEach(z => {
        lamp(
          parent, x, c.height - 0.83, z,
          0, x < 0 ? -55 : 55
        );
      });
    });

    [-6.6, 6.6].forEach(z => {
      box(parent, 0, c.height - 0.65, z,
        c.width - 5, 0.065, 0.07, "#343d38");

      [-11, -3.7, 3.7, 11].forEach(x => {
        lamp(
          parent, x, c.height - 0.83, z,
          z < 0 ? 55 : -55, 0
        );
      });
    });
  }

  function museumDoor(parent, c) {
    const door = create("a-entity", {
      position: {
        x: 0,
        y: 0,
        z: -c.depth / 2 + 0.24
      }
    }, parent);

    box(door, 0, 1.45, 0,
      2.35, 2.9, 0.12, "#795238");

    [-0.58, 0.58].forEach(x => {
      [0.73, 2.08].forEach(y => {
        box(door, x, y, 0.073,
          0.91, 1.06, 0.035, "#684530");

        gold(door, x, y - 0.54, 0.098,
          0.96, 0.025, 0.018);

        gold(door, x, y + 0.54, 0.098,
          0.96, 0.025, 0.018);

        gold(door, x - 0.47, y, 0.098,
          0.025, 1.08, 0.018);

        gold(door, x + 0.47, y, 0.098,
          0.025, 1.08, 0.018);
      });
    });

    [-1.27, 1.27].forEach(x => {
      box(door, x, 1.5, 0.04,
        0.17, 3, 0.20, c.colors.cream);

      gold(door, x, 1.5, 0.15,
        0.032, 2.98, 0.025);
    });

    box(door, 0, 3.03, 0.04,
      2.72, 0.18, 0.2, c.colors.cream);

    box(door, 0, 3.17, 0.04,
      2.9, 0.1, 0.27, c.colors.creamDark);

    panel(door,
      {x: 0, y: 1.75, z: 0.17},
      "0 0 0", 1.8, 1.8 * 9 / 16,
      textBoard([
        "Zurück",
        "zum Begrüßungsraum",
        "Laser + Trigger"
      ], "#eee7d5"),
      "welcome"
    );

    panel(door,
      {x: 0, y: 3.65, z: 0.10},
      "0 0 0", 2.8, 2.8 * 9 / 16,
      textBoard([c.title, "FKC-VR"], "#eee7d5"),
      null
    );
  }

  function placement(s, c) {
    const inset = 0.205;

    if (s.wall === "left") {
      return {
        poster: {
          x: -c.width / 2 + inset,
          y: c.posterY,
          z: s.along
        },
        model: {
          x: -c.width / 2 + c.modelDistance,
          y: c.modelY,
          z: s.along
        },
        rotation: "0 90 0"
      };
    }

    if (s.wall === "right") {
      return {
        poster: {
          x: c.width / 2 - inset,
          y: c.posterY,
          z: s.along
        },
        model: {
          x: c.width / 2 - c.modelDistance,
          y: c.modelY,
          z: s.along
        },
        rotation: "0 -90 0"
      };
    }

    if (s.wall === "front") {
      return {
        poster: {
          x: s.along,
          y: c.posterY,
          z: -c.depth / 2 + inset
        },
        model: {
          x: s.along,
          y: c.modelY,
          z: -c.depth / 2 + c.modelDistance
        },
        rotation: "0 0 0"
      };
    }

    return {
      poster: {
        x: s.along,
        y: c.posterY,
        z: c.depth / 2 - inset
      },
      model: {
        x: s.along,
        y: c.modelY,
        z: c.depth / 2 - c.modelDistance
      },
      rotation: "0 180 0"
    };
  }

  function pedestal(parent, s, p, c) {
    const group = create("a-entity", {
      position: {x: p.model.x, y: 0, z: p.model.z},
      rotation: p.rotation
    }, parent);

    gold(group, 0, 0.065, 0,
      0.9, 0.13, 0.9, c.colors.goldDark);

    gold(group, 0, 0.145, 0,
      0.85, 0.04, 0.85, c.colors.goldLight);

    box(group, 0, 0.50, 0,
      0.76, 0.68, 0.76, c.colors.cream);

    [0, 90, 180, 270].forEach(angle => {
      const side = create("a-entity", {
        rotation: {x: 0, y: angle, z: 0}
      }, group);

      box(side, 0, 0.50, 0.385,
        0.58, 0.47, 0.012, "#e4dcc8");

      gold(side, -0.3, 0.50, 0.398,
        0.015, 0.49, 0.015);

      gold(side, 0.3, 0.50, 0.398,
        0.015, 0.49, 0.015);

      gold(side, 0, 0.255, 0.398,
        0.61, 0.015, 0.015);

      gold(side, 0, 0.745, 0.398,
        0.61, 0.015, 0.015);
    });

    gold(group, 0, 0.855, 0,
      0.84, 0.055, 0.84, c.colors.gold);

    box(group, 0, 0.9, 0,
      0.9, 0.04, 0.9, "#33463e", {
        roughness: 0.4
      });

    create("a-plane", {
      position: "0 0.63 0.414",
      width: 0.54,
      height: 0.17,
      material: {
        shader: "flat",
        src: textBoard([s.title], "#75531e", "#f5e6bc")
      }
    }, group);
  }

  function station(parent, s, index, c, obstacles) {
    const p = placement(s, c);

    const frame = create("a-entity", {
      position: p.poster,
      rotation: p.rotation
    }, parent);

    box(frame, 0, 0, 0,
      c.posterWidth + 0.36,
      c.posterHeight + 0.36,
      0.055,
      c.colors.goldDark
    );

    create("a-plane", {
      position: "0 0 0.04",
      width: c.posterWidth,
      height: c.posterHeight,
      material: {
        shader: "flat",
        color: "#ffffff",
        src: s.slide || textBoard([
          s.title,
          "Vorlesungsfolie 16:9",
          "Hier kann eine eigene Folie erscheinen"
        ], "#fbf8ee")
      }
    }, frame);

    frameLayer(
      frame, c, 0.025, 0.045, 0.075, 0.065, c.colors.goldLight
    );
    frameLayer(
      frame, c, 0.075, 0.07, 0.095, 0.063, c.colors.gold
    );
    frameLayer(
      frame, c, 0.13, 0.04, 0.065, 0.04, c.colors.goldDark
    );
    frameLayer(
      frame, c, 0.165, 0.045, 0.075, 0.06, c.colors.goldLight
    );

    pedestal(parent, s, p, c);

    obstacles.push({
      x: p.model.x,
      z: p.model.z,
      width: 0.9,
      depth: 0.9
    });

    makeModel(parent, s, index, c, p.model, "#79aa98");
  }

  function buildMuseum(parent, c) {
    const obstacles = [];

    box(parent, 0, -0.08, 0,
      c.width, 0.16, c.depth, "#84603c");

    create("a-plane", {
      position: "0 0.004 0",
      rotation: "-90 0 0",
      width: c.width,
      height: c.depth,
      material: {
        src: parquet(),
        repeat: "8 5.6675",
        color: "#ffffff",
        roughness: 0.65,
        metalness: 0.02
      }
    }, parent);

    [-1, 1].forEach(sign => {
      box(parent, 0, 0.009, sign * (c.depth / 2 - 0.29),
        c.width - 0.3, 0.009, 0.35, "#775137");

      box(parent, sign * (c.width / 2 - 0.29), 0.009, 0,
        0.35, 0.009, c.depth - 0.3, "#775137");
    });

    museumWalls(parent, c);
    museumCeiling(parent, c);
    museumDoor(parent, c);
    lighting(parent, true);

    c.stations.forEach((s, index) => {
      station(parent, s, index, c, obstacles);
    });

    return {
      spawn: c.spawn,
      isWalkable: makeWalkable(c, obstacles)
    };
  }

  F.RoomBuilder = {
    build: function (parent, config, rooms) {
      if (config.kind === "welcome") {
        return buildWelcome(parent, config, rooms);
      }

      return buildMuseum(parent, config);
    }
  };
})(window.FKCVR);
