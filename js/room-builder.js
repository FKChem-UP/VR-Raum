"use strict";

(function (F) {
  const create = F.create;

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

  /*
   * Canvasbilder werden als Daten-URLs verwendet.
   * Es sind keine zusätzlichen Texturbilder nötig.
   */
  function image(draw, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width || 1024;
    canvas.height = height || 576;

    draw(canvas.getContext("2d"), canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  }

  function textBoard(lines, background, color) {
    return image((ctx, w, h) => {
      ctx.fillStyle = background || "#f8faf8";
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = color || "#304c3d";
      ctx.textAlign = "center";

      lines.forEach((line, index) => {
        ctx.font = index === 0
          ? "bold 56px Arial"
          : "32px Arial";

        ctx.fillText(line, w / 2, 105 + index * 72, w - 80);
      });
    });
  }

  function roomPreview(room, index) {
    return image((ctx, w, h) => {
      ctx.fillStyle = "#edf2ed";
      ctx.fillRect(0, 0, w, h);

      // Symbolischer Museumsinnenraum.
      ctx.fillStyle = room.colors.wall;
      ctx.fillRect(45, 35, w - 90, 300);

      ctx.fillStyle = "#b9905a";
      ctx.beginPath();
      ctx.moveTo(45, 335);
      ctx.lineTo(w - 45, 335);
      ctx.lineTo(w - 5, 445);
      ctx.lineTo(5, 445);
      ctx.closePath();
      ctx.fill();

      for (let i = 0; i < 3; i++) {
        const x = 125 + i * 285;

        ctx.fillStyle = "#78551f";
        ctx.fillRect(x, 92, 210, 140);

        ctx.fillStyle = "#d5b264";
        ctx.fillRect(x + 7, 99, 196, 126);

        ctx.fillStyle = "#faf7e9";
        ctx.fillRect(x + 16, 108, 178, 108);

        ctx.fillStyle = "#83aa96";
        ctx.beginPath();
        ctx.arc(x + 105, 158, 28, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#eee7d5";
        ctx.fillRect(x + 78, 280, 54, 70);

        ctx.fillStyle = "#b38b39";
        ctx.fillRect(x + 72, 342, 66, 8);
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 445, w, h - 445);

      ctx.textAlign = "center";
      ctx.fillStyle = "#284b39";
      ctx.font = "bold 48px Arial";
      ctx.fillText(room.title, w / 2, 502, w - 60);

      ctx.font = "26px Arial";
      ctx.fillStyle = "#637c6d";
      ctx.fillText("Mit Laser + Trigger betreten", w / 2, 548);

      ctx.textAlign = "left";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 30px Arial";
      ctx.fillText(String(index + 1).padStart(2, "0"), 70, 75);
    });
  }

  let parquetImage = null;

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
            const gradient = ctx.createLinearGradient(0, y, 0, y + plank);

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

  function panel(parent, position, rotation, width, height, src, roomId) {
    const group = create("a-entity", {
      position,
      rotation
    }, parent);

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
        color: museum ? "#fff7e6" : "#ffffff",
        intensity: 0.7
      }
    }, parent);

    create("a-entity", {
      position: "-7 11 4",
      light: {
        type: "directional",
        color: "#fff4de",
        intensity: 0.65
      }
    }, parent);

    create("a-entity", {
      position: "8 10 -6",
      light: {
        type: "directional",
        color: "#e5f2f4",
        intensity: 0.4
      }
    }, parent);
  }

  function buildWelcome(parent, config, rooms) {
    box(parent, 0, -0.08, 0,
      config.width, 0.16, config.depth, "#e4e8e4");

    box(parent, 0, config.height + 0.08, 0,
      config.width, 0.16, config.depth, "#ffffff");

    box(parent, -config.width / 2, config.height / 2, 0,
      0.3, config.height, config.depth, "#ffffff");

    box(parent, config.width / 2, config.height / 2, 0,
      0.3, config.height, config.depth, "#ffffff");

    box(parent, 0, config.height / 2, -config.depth / 2,
      config.width, config.height, 0.3, "#ffffff");

    box(parent, 0, config.height / 2, config.depth / 2,
      config.width, config.height, 0.3, "#ffffff");

    // Dezente Sockelleisten.
    [-1, 1].forEach(sign => {
      box(parent, sign * (config.width / 2 - 0.18), 0.1, 0,
        0.06, 0.2, config.depth - 0.3, "#d9e1db");

      box(parent, 0, 0.1, sign * (config.depth / 2 - 0.18),
        config.width - 0.3, 0.2, 0.06, "#d9e1db");
    });

    // Flache Deckenleuchten.
    [-5, 0, 5].forEach(x => {
      [-4, 4].forEach(z => {
        box(parent, x, config.height - 0.04, z,
          2.4, 0.04, 0.75, "#ffffff", {shader: "flat"});

        box(parent, x, config.height - 0.01, z,
          2.5, 0.035, 0.85, "#d3ddd5");
      });
    });

    lighting(parent, false);

    const info = [
      textBoard([
        "Bedienung",
        "Links: laufen · Rechts: drehen",
        "Rechts vor + loslassen: Teleport",
        "Grip: greifen · 2 Hände: skalieren",
        "Trigger: auswählen / markieren",
        "A/X: letzter Reset · B/Y: alle"
      ]),
      textBoard([
        "Willkommen bei FKC-VR",
        "8 Räume für die Vorlesung",
        "2 Räume für das Praktikum",
        "Raumtafeln mit Trigger auswählen",
        "Noch ohne Mehrspieler-Synchronisierung",
        "Gemeinsamer Betrieb folgt später"
      ])
    ];

    const cards = rooms.map((room, index) => ({
      src: roomPreview(room, index),
      roomId: room.id
    }));

    cards.push(
      {src: info[0], roomId: null},
      {src: info[1], roomId: null}
    );

    const placements = [];

    // Vier Tafeln an der linken Wand.
    [-5.55, -1.85, 1.85, 5.55].forEach(z => {
      placements.push({
        position: {
          x: -config.width / 2 + 0.22,
          y: 2.65,
          z
        },
        rotation: "0 90 0"
      });
    });

    // Vier Tafeln an der Wand gegenüber dem Startpunkt.
    [-6, -2, 2, 6].forEach(x => {
      placements.push({
        position: {
          x,
          y: 2.65,
          z: -config.depth / 2 + 0.22
        },
        rotation: "0 0 0"
      });
    });

    // Vier Tafeln an der rechten Wand.
    [-5.55, -1.85, 1.85, 5.55].forEach(z => {
      placements.push({
        position: {
          x: config.width / 2 - 0.22,
          y: 2.65,
          z
        },
        rotation: "0 -90 0"
      });
    });

    cards.forEach((card, index) => {
      panel(
        parent,
        placements[index].position,
        placements[index].rotation,
        3,
        3 * 9 / 16,
        card.src,
        card.roomId
      );
    });

    // Willkommenstafel an der Wand hinter dem Startpunkt.
    panel(parent, {
      x: 0,
      y: 2.6,
      z: config.depth / 2 - 0.22
    }, "0 180 0", 4.5, 4.5 * 9 / 16, textBoard([
      "FKC-VR",
      "Virtuelle Festkörperchemie",
      "Wähle eine der zehn Raumtafeln",
      "am Computer oder mit dem VR-Laser"
    ]), null);

    return {
      spawn: config.spawn,
      isWalkable: makeWalkable(config, [])
    };
  }

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
      {position: {x: -c.width / 2, y: 0, z: 0}, rotation: "0 90 0", length: c.depth},
      {position: {x: c.width / 2, y: 0, z: 0}, rotation: "0 -90 0", length: c.depth},
      {position: {x: 0, y: 0, z: -c.depth / 2}, rotation: "0 0 0", length: c.width},
      {position: {x: 0, y: 0, z: c.depth / 2}, rotation: "0 180 0", length: c.width}
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

    box(group, 0, 0.08, 0, 0.035, 0.2, 0.035, "#343d38");

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
        lamp(parent, x, c.height - 0.83, z,
          0, x < 0 ? -55 : 55);
      });
    });

    [-6.6, 6.6].forEach(z => {
      box(parent, 0, c.height - 0.65, z,
        c.width - 5, 0.065, 0.07, "#343d38");

      [-11, -3.7, 3.7, 11].forEach(x => {
        lamp(parent, x, c.height - 0.83, z,
          z < 0 ? 55 : -55, 0);
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

    box(door, 0, 1.45, 0, 2.35, 2.9, 0.12, "#795238");

    [-0.58, 0.58].forEach(x => {
      [0.73, 2.08].forEach(y => {
        box(door, x, y, 0.073, 0.91, 1.06, 0.035, "#684530");

        gold(door, x, y - 0.54, 0.098, 0.96, 0.025, 0.018);
        gold(door, x, y + 0.54, 0.098, 0.96, 0.025, 0.018);
        gold(door, x - 0.47, y, 0.098, 0.025, 1.08, 0.018);
        gold(door, x + 0.47, y, 0.098, 0.025, 1.08, 0.018);
      });
    });

    [-1.27, 1.27].forEach(x => {
      box(door, x, 1.5, 0.04, 0.17, 3, 0.20, c.colors.cream);
      gold(door, x, 1.5, 0.15, 0.032, 2.98, 0.025);
    });

    box(door, 0, 3.03, 0.04, 2.72, 0.18, 0.2, c.colors.cream);
    box(door, 0, 3.17, 0.04, 2.9, 0.1, 0.27, c.colors.creamDark);

    // Diese Tafel ist in VR und am Desktop auswählbar.
    panel(door, {x: 0, y: 1.75, z: 0.17},
      "0 0 0", 1.8, 1.8 * 9 / 16, textBoard([
        "Zurück",
        "zum Begrüßungsraum",
        "Laser + Trigger"
      ], "#eee7d5"), "welcome");

    panel(door, {x: 0, y: 3.65, z: 0.10},
      "0 0 0", 2.8, 2.8 * 9 / 16, textBoard([
        c.title,
        "FKC-VR"
      ], "#eee7d5"), null);
  }

  function placement(station, c) {
    const inset = 0.205;

    if (station.wall === "left") return {
      poster: {x: -c.width / 2 + inset, y: c.posterY, z: station.along},
      model: {x: -c.width / 2 + c.modelDistance, y: c.modelY, z: station.along},
      rotation: "0 90 0"
    };

    if (station.wall === "right") return {
      poster: {x: c.width / 2 - inset, y: c.posterY, z: station.along},
      model: {x: c.width / 2 - c.modelDistance, y: c.modelY, z: station.along},
      rotation: "0 -90 0"
    };

    if (station.wall === "front") return {
      poster: {x: station.along, y: c.posterY, z: -c.depth / 2 + inset},
      model: {x: station.along, y: c.modelY, z: -c.depth / 2 + c.modelDistance},
      rotation: "0 0 0"
    };

    return {
      poster: {x: station.along, y: c.posterY, z: c.depth / 2 - inset},
      model: {x: station.along, y: c.modelY, z: c.depth / 2 - c.modelDistance},
      rotation: "0 180 0"
    };
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

  function pedestal(parent, station, p, c) {
    const group = create("a-entity", {
      position: {x: p.model.x, y: 0, z: p.model.z},
      rotation: p.rotation
    }, parent);

    gold(group, 0, 0.065, 0, 0.9, 0.13, 0.9, c.colors.goldDark);
    gold(group, 0, 0.145, 0, 0.85, 0.04, 0.85, c.colors.goldLight);

    box(group, 0, 0.50, 0, 0.76, 0.68, 0.76, c.colors.cream);

    [0, 90, 180, 270].forEach(angle => {
      const side = create("a-entity", {
        rotation: {x: 0, y: angle, z: 0}
      }, group);

      box(side, 0, 0.50, 0.385, 0.58, 0.47, 0.012, "#e4dcc8");

      gold(side, -0.3, 0.50, 0.398, 0.015, 0.49, 0.015);
      gold(side, 0.3, 0.50, 0.398, 0.015, 0.49, 0.015);
      gold(side, 0, 0.255, 0.398, 0.61, 0.015, 0.015);
      gold(side, 0, 0.745, 0.398, 0.61, 0.015, 0.015);
    });

    gold(group, 0, 0.855, 0, 0.84, 0.055, 0.84, c.colors.gold);

    box(group, 0, 0.9, 0, 0.9, 0.04, 0.9, "#33463e", {
      roughness: 0.4
    });

    create("a-plane", {
      position: "0 0.63 0.414",
      width: 0.54,
      height: 0.17,
      material: {
        shader: "flat",
        src: textBoard([station.title], "#75531e", "#f5e6bc")
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
      0.055, c.colors.goldDark);

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

    frameLayer(frame, c, 0.025, 0.045, 0.075, 0.065, c.colors.goldLight);
    frameLayer(frame, c, 0.075, 0.07, 0.095, 0.063, c.colors.gold);
    frameLayer(frame, c, 0.13, 0.04, 0.065, 0.04, c.colors.goldDark);
    frameLayer(frame, c, 0.165, 0.045, 0.075, 0.06, c.colors.goldLight);

    pedestal(parent, s, p, c);

    obstacles.push({
      x: p.model.x,
      z: p.model.z,
      width: 0.9,
      depth: 0.9
    });

    const root = create("a-entity", {
      id: c.id + "-model-" + (index + 1),
      class: "interactable",
      position: p.model
    }, parent);

    root.dataset.title = s.title;

    root.homePosition = new THREE.Vector3(
      p.model.x, p.model.y, p.model.z
    );

    root.modelReady = false;

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

      visual.setAttribute("gltf-model", "url(" + s.model + ")");
    } else {
      create("a-sphere", {
        class: "model-visual",
        radius: c.modelSize / 2,
        material: {
          color: "#79aa98",
          roughness: 0.4,
          metalness: 0.12
        }
      }, body);

      root.modelReady = true;
    }

    root.setAttribute("fkc-manipulable", "");
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
