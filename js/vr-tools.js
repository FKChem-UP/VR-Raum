"use strict";

(function (F) {
  const V = THREE.Vector3;

  F.Settings = {
    lasers: {
      left: "#32d8df",
      right: "#ff9d38"
    },
    ink: "#ff3f92"
  };

  /*
   * Trefferlisten werden zwischengespeichert.
   * Zeichnungen selbst sind keine neuen Zeichen-/Greifflächen.
   */
  let hitTargets = [];
  let hitDirty = true;

  F.invalidateHits = function () {
    hitDirty = true;
  };

  function effectivelyVisible(object) {
    let current = object;

    while (current) {
      if (!current.visible) return false;
      current = current.parent;
    }

    return true;
  }

  function isDrawingObject(object) {
    let current = object;

    while (current) {
      if (current.userData && current.userData.fkcDrawing) return true;
      current = current.parent;
    }

    return false;
  }

  function rebuildHits() {
    hitTargets = [];
    const used = new Set();
    const scene = F.getScene();

    /*
     * Priorität:
     * Bedienflächen > Modelle > feste Zeichenflächen.
     */
    const selectors = [
      [".vr-action", "action"],
      [".model-visual", "model"],
      [".paintable", "surface"]
    ];

    selectors.forEach(([selector, type]) => {
      scene.querySelectorAll(selector).forEach(el => {
        const owner = type === "model" ? el.closest(".interactable") : el;

        if (!owner) return;

        el.object3D.updateWorldMatrix(true, true);

        el.object3D.traverse(object => {
          if (!object.isMesh || used.has(object) || isDrawingObject(object)) return;

          used.add(object);
          hitTargets.push({mesh: object, type, el: owner});
        });
      });
    });

    hitDirty = false;
  }

  F.findHit = function (raycaster, includeSurfaces) {
    if (hitDirty) rebuildHits();

    const menuOpen = F.Menu && F.Menu.opened;

    const targets = hitTargets.filter(target => {
      if (!target.el.isConnected || !effectivelyVisible(target.mesh)) return false;

      if (menuOpen) {
        return target.type === "action" &&
          target.el.dataset.fkcMenu === "true";
      }

      if (target.type === "model" && !target.el.modelReady) return false;

      return includeSurfaces || target.type === "action";
    });

    const lookup = new Map(targets.map(target => [target.mesh, target]));

    const hits = raycaster.intersectObjects(
      targets.map(target => target.mesh),
      false
    );

    if (!hits.length) return null;

    const hit = hits[0];
    const target = lookup.get(hit.object);

    const normal = hit.face
      ? hit.face.normal.clone().applyMatrix3(
        new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)
      ).normalize()
      : raycaster.ray.direction.clone().negate();

    /*
     * Normalen auch bei doppelseitigen Flächen zum Laser hin ausrichten.
     */
    if (normal.dot(raycaster.ray.direction) > 0) normal.negate();

    return {
      type: target.type,
      el: target.el,
      mesh: hit.object,
      point: hit.point.clone(),
      normal,
      uv: hit.uv ? hit.uv.clone() : null
    };
  };

  /*
   * ============================================================
   * ZEICHNEN
   *
   * Ein Strich ist ein kleines röhrenförmiges Mesh, nicht eine
   * separate Entity pro Liniensegment.
   *
   * Grenzen:
   * - maximal 300 Strichabschnitte pro Raum
   * - maximal 128 Messpunkte pro Abschnitt
   * Bei Erreichen der Abschnittsgrenze werden älteste Striche gelöscht.
   * ============================================================
   */
  const SIDES = 6;
  const CAPACITY = 128;
  const MAX_STROKES = 300;

  F.Draw = {
    strokes: [],

    remove: function (stroke) {
      if (!stroke || stroke.removed) return;

      stroke.removed = true;
      stroke.group.removeFromParent();
      stroke.geometry.dispose();
      stroke.dotGeometry.dispose();
      stroke.material.dispose();

      const index = this.strokes.indexOf(stroke);
      if (index >= 0) this.strokes.splice(index, 1);
    },

    clear: function (target) {
      this.strokes.slice().forEach(stroke => {
        if (!target || stroke.owner === target || target.contains(stroke.owner)) {
          this.remove(stroke);
        }
      });
    },

    createStroke: function (hit, parent, point, radius) {
      while (this.strokes.length >= MAX_STROKES) {
        this.remove(this.strokes[0]);
      }

      const group = new THREE.Group();
      group.userData.fkcDrawing = true;
      parent.add(group);

      const material = new THREE.MeshBasicMaterial({
        color: F.Settings.ink,
        side: THREE.DoubleSide
      });

      const dotGeometry = new THREE.SphereGeometry(radius * 2, 8, 6);
      const dot = new THREE.Mesh(dotGeometry, material);
      dot.position.copy(point);
      group.add(dot);

      const positions = new Float32Array(CAPACITY * SIDES * 3);
      const indices = new Uint16Array((CAPACITY - 1) * SIDES * 6);

      let index = 0;

      for (let ring = 1; ring < CAPACITY; ring++) {
        for (let side = 0; side < SIDES; side++) {
          const next = (side + 1) % SIDES;
          const a = (ring - 1) * SIDES + side;
          const b = (ring - 1) * SIDES + next;
          const c = ring * SIDES + side;
          const d = ring * SIDES + next;

          indices[index++] = a;
          indices[index++] = c;
          indices[index++] = b;
          indices[index++] = b;
          indices[index++] = c;
          indices[index++] = d;
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      geometry.setDrawRange(0, 0);

      const tube = new THREE.Mesh(geometry, material);
      tube.frustumCulled = false;
      group.add(tube);

      const stroke = {
        owner: hit.el,
        surfaceMesh: hit.mesh,
        parent,
        group,
        material,
        geometry,
        dotGeometry,
        positions,
        radius,
        count: 0,
        lastLocal: point.clone(),
        lastNormal: hit.normal.clone(),
        removed: false
      };

      this.strokes.push(stroke);
      this.addRing(stroke, point, new V(0, 1, 0));

      return stroke;
    },

    addRing: function (stroke, point, direction) {
      const axis = direction.clone().normalize();
      const helper = Math.abs(axis.y) < 0.9
        ? new V(0, 1, 0)
        : new V(1, 0, 0);

      const u = new V().crossVectors(axis, helper).normalize();
      const v = new V().crossVectors(axis, u).normalize();

      for (let side = 0; side < SIDES; side++) {
        const angle = side / SIDES * Math.PI * 2;
        const vertex = point.clone()
          .addScaledVector(u, Math.cos(angle) * stroke.radius)
          .addScaledVector(v, Math.sin(angle) * stroke.radius);

        const offset = (stroke.count * SIDES + side) * 3;

        stroke.positions[offset] = vertex.x;
        stroke.positions[offset + 1] = vertex.y;
        stroke.positions[offset + 2] = vertex.z;
      }

      stroke.count++;
      stroke.geometry.attributes.position.needsUpdate = true;
      stroke.geometry.setDrawRange(
        0,
        Math.max(0, stroke.count - 1) * SIDES * 6
      );
    },

    sample: function (stroke, hit) {
      const body = hit.type === "model"
        ? hit.el.querySelector(".manip-body")
        : hit.el;

      if (!body) return null;

      const parent = body.object3D;
      parent.updateWorldMatrix(true, true);

      const scale = parent.getWorldScale(new V());
      const factor = Math.max(0.0001, Math.abs(scale.x));

      /*
       * Kleiner Oberflächenabstand verhindert weitgehend Z-Flimmern.
       * Zeichnungen bleiben durch Tiefentest räumlich verdeckbar.
       */
      const worldPoint = hit.point.clone().addScaledVector(hit.normal, 0.004);
      const localPoint = parent.worldToLocal(worldPoint.clone());

      let sameStroke = stroke &&
        !stroke.removed &&
        stroke.owner === hit.el &&
        stroke.surfaceMesh === hit.mesh &&
        stroke.parent === parent &&
        stroke.count < CAPACITY;

      if (sameStroke) {
        const previousWorld = parent.localToWorld(stroke.lastLocal.clone());
        const distance = previousWorld.distanceTo(worldPoint);

        /*
         * Kleine Bewegungen ignorieren; große Sprünge nicht quer verbinden.
         */
        if (distance < 0.006) return stroke;

        if (distance > 0.18 || stroke.lastNormal.dot(hit.normal) < 0.4) {
          sameStroke = false;
        }
      }

      if (!sameStroke) {
        return this.createStroke(hit, parent, localPoint, 0.004 / factor);
      }

      const direction = localPoint.clone().sub(stroke.lastLocal);
      this.addRing(stroke, localPoint, direction);

      stroke.lastLocal.copy(localPoint);
      stroke.lastNormal.copy(hit.normal);

      return stroke;
    }
  };

  /*
   * ============================================================
   * MODELLVARIANTEN
   * ============================================================
   */
  F.switchVariant = function (root, variantId) {
    if (!root || !root.isConnected || !root.fkcVariants) return;

    const variant = root.fkcVariants.find(item => item.id === variantId);
    if (!variant || root.fkcVariantId === variantId) return;

    const body = root.querySelector(".manip-body");
    const oldVisuals = Array.from(body.querySelectorAll(".model-visual"));

    if (root.fkcPendingVisual) root.fkcPendingVisual.remove();

    const token = (root.fkcVariantToken || 0) + 1;
    root.fkcVariantToken = token;

    const pending = document.createElement("a-entity");
    pending.className = "pending-visual";
    pending.dataset.pendingVariant = "true";

    pending.setAttribute("fkc-normalize", {
      targetSize: root.fkcModelSize || 0.5,
      padding: 0.06
    });

    body.appendChild(pending);
    pending.object3D.visible = false;
    root.fkcPendingVisual = pending;

    F.setStatus("Darstellung wird geladen: " + variant.title);

    const isCurrent = () =>
      root.isConnected &&
      pending.isConnected &&
      root.fkcVariantToken === token;

    const fail = () => {
      if (!isCurrent()) return;

      pending.remove();
      root.fkcPendingVisual = null;

      F.setStatus(
        "Darstellung konnte nicht geladen werden. Bisheriges Modell bleibt erhalten."
      );

      if (F.Menu.opened) F.Menu.render();
    };

    pending.addEventListener("model-error", fail, {once: true});

    pending.addEventListener("model-loaded", () => {
      /*
       * Komponenten können ihre model-loaded-Listener in unterschiedlicher
       * Reihenfolge registrieren. Abschluss deshalb nach der Ereignisrunde.
       */
      queueMicrotask(() => {
        if (!isCurrent()) return;

        const normalize = pending.components["fkc-normalize"];
        if (!normalize || !normalize.result) {
          fail();
          return;
        }

        F.releaseModel(root);
        F.Draw.clear(root);

        oldVisuals.forEach(el => el.remove());

        pending.dataset.pendingVariant = "false";
        pending.className = "model-visual";
        pending.object3D.visible = true;

        F.applyModelBounds(pending);

        const hitbox = root.querySelector(".hitbox");
        hitbox.object3D.position.copy(normalize.result.center);

        root.fkcVariantId = variantId;
        root.fkcPendingVisual = null;

        F.invalidateHits();
        F.setStatus("Darstellung geöffnet: " + variant.title);

        if (F.Menu.opened) F.Menu.render();
      });
    }, {once: true});

    pending.setAttribute("gltf-model", "url(" + variant.model + ")");
  };

  /*
   * ============================================================
   * VR-MENÜ
   *
   * Ein Canvas als Menütextur; Treffer werden anhand der UV-Koordinaten
   * in Schaltflächen übersetzt. Keine zusätzlichen Bibliotheken.
   * ============================================================
   */
  const WIDTH = 1024;
  const HEIGHT = 1200;

  const palette = [
    ["Türkis", "#32d8df"],
    ["Orange", "#ff9d38"],
    ["Pink", "#ff3f92"],
    ["Blau", "#507dff"],
    ["Grün", "#45d77e"],
    ["Rot", "#ee5151"]
  ];

  F.Menu = {
    opened: false,
    page: "home",
    target: null,
    buttons: [],
    textOffset: 0,
    variantOffset: 0,

    init: function () {
      if (this.root) return;

      this.canvas = document.createElement("canvas");
      this.canvas.width = WIDTH;
      this.canvas.height = HEIGHT;
      this.ctx = this.canvas.getContext("2d");

      this.texture = new THREE.CanvasTexture(this.canvas);
      this.texture.minFilter = THREE.LinearFilter;
      this.texture.magFilter = THREE.LinearFilter;
      this.texture.generateMipmaps = false;

      this.geometry = new THREE.PlaneGeometry(1.28, 1.5);
      this.material = new THREE.MeshBasicMaterial({
        map: this.texture,
        side: THREE.DoubleSide,
        depthTest: false
      });

      const mesh = new THREE.Mesh(this.geometry, this.material);
      mesh.renderOrder = 100;
      mesh.frustumCulled = false;

      this.root = F.create("a-entity", {
        id: "fkc-menu",
        class: "vr-action",
        visible: false
      }, F.getScene());

      this.root.dataset.fkcMenu = "true";
      this.root.setObject3D("mesh", mesh);
      F.invalidateHits();
    },

    blockDrawing: function () {
      F.getScene().querySelectorAll("[fkc-controller]").forEach(hand => {
        const tools = hand.components["fkc-controller"];
        if (!tools) return;

        tools.stroke = null;
        tools.drawingAllowed = false;
      });
    },

    toggle: function (hand) {
      if (this.opened) this.close();
      else this.open(hand);
    },

    open: function (hand) {
      this.init();

      const scene = F.getScene();

      this.target = hand
        ? F.resolveTarget(hand)
        : scene.lastSelectedTarget;

      if (!this.target && scene.lastSelectedModel &&
          scene.lastSelectedModel.isConnected) {
        this.target = scene.lastSelectedModel;
      }

      /*
       * Auswahl zuerst merken, danach Hände lösen.
       */
      F.releaseHands();
      this.blockDrawing();

      const navigation = F.getNavigation();
      if (navigation) navigation.cancel();

      const camera = scene.camera;
      const position = camera.getWorldPosition(new V());
      const forward = camera.getWorldDirection(new V());
      forward.y = 0;

      if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1);
      forward.normalize();

      this.root.object3D.position.copy(position)
        .addScaledVector(forward, 1.65);

      this.root.object3D.quaternion.setFromUnitVectors(
        new V(0, 0, 1),
        forward.clone().negate()
      );

      this.root.object3D.updateWorldMatrix(true, true);
      this.root.object3D.visible = true;

      this.opened = true;
      this.page = "home";
      this.textOffset = 0;
      this.variantOffset = 0;
      this.render();

      F.invalidateHits();
    },

    close: function () {
      this.opened = false;
      if (this.root) this.root.object3D.visible = false;

      this.blockDrawing();

      const navigation = F.getNavigation();
      if (navigation) navigation.cancel();

      F.invalidateHits();
    },

    navigate: function (page) {
      this.page = page;
      this.textOffset = 0;
      this.variantOffset = 0;
      this.render();
    },

    click: function (hit) {
      if (!this.opened || !hit.uv) return;

      const x = hit.uv.x * WIDTH;
      const y = (1 - hit.uv.y) * HEIGHT;

      const button = this.buttons.find(item =>
        x >= item.x && x <= item.x + item.w &&
        y >= item.y && y <= item.y + item.h
      );

      if (button) button.action();
    },

    wrap: function (text, maxWidth) {
      const ctx = this.ctx;
      const lines = [];

      String(text || "").split("\n").forEach(paragraph => {
        if (!paragraph.trim()) {
          lines.push("");
          return;
        }

        let line = "";

        paragraph.split(/\s+/).forEach(word => {
          const candidate = line ? line + " " + word : word;

          if (line && ctx.measureText(candidate).width > maxWidth) {
            lines.push(line);
            line = word;
          } else {
            line = candidate;
          }
        });

        if (line) lines.push(line);
      });

      return lines;
    },

    render: function () {
      if (!this.root) return;

      const ctx = this.ctx;
      this.buttons = [];

      ctx.fillStyle = "#f4f7f5";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = "#263f33";
      ctx.font = "bold 48px Arial";
      ctx.fillText("FKC-VR · Menü", 55, 75);

      const target = this.target && this.target.isConnected
        ? this.target
        : null;

      const model = target && target.classList.contains("interactable")
        ? target
        : null;

      ctx.font = "27px Arial";

      const name = model
        ? model.dataset.title
        : target ? "Ausgewählte Zeichenfläche" : "Kein Modell ausgewählt";

      ctx.fillText(name, 55, 125, 910);

      let y = 175;

      const button = (label, action, color) => {
        const h = 72;
        const x = 55;
        const w = 914;

        ctx.fillStyle = color || "#dfe9e2";
        ctx.fillRect(x, y, w, h);

        ctx.strokeStyle = "#a9bcae";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = "#173527";
        ctx.font = "30px Arial";
        ctx.fillText(label, x + 22, y + 46, w - 44);

        this.buttons.push({x, y, w, h, action});
        y += 86;
      };

      const text = (value, maximumLines) => {
        ctx.fillStyle = "#30493b";
        ctx.font = "29px Arial";

        const lines = this.wrap(value, 910);
        const shown = maximumLines
          ? lines.slice(this.textOffset, this.textOffset + maximumLines)
          : lines;

        shown.forEach(line => {
          ctx.fillText(line, 55, y + 30, 914);
          y += 43;
        });

        y += 15;
        return lines;
      };

      if (this.page === "home") {
        button("Farben einstellen", () => this.navigate("colors"));
        button("Bedienhilfe anzeigen", () => this.navigate("help"));
        button("Informationen zum Modell", () => this.navigate("info"));
        button("Modelldarstellung wechseln", () => this.navigate("variants"));

        button("Ausgewähltes Objekt zurücksetzen", () => {
          F.resetTarget(target);
        });

        button("Alle Zeichnungen im Raum löschen", () => {
          F.clearMarkers();
        });

        button("Kompletten Raum zurücksetzen …", () => {
          this.navigate("confirm");
        });

        button("Menü schließen", () => this.close());
      }

      if (this.page === "colors") {
        button("Laserfarbe links", () => this.navigate("laser-left"));
        button("Laserfarbe rechts", () => this.navigate("laser-right"));
        button("Zeichenfarbe", () => this.navigate("ink"));
        button("Zurück", () => this.navigate("home"));
      }

      if (["laser-left", "laser-right", "ink"].includes(this.page)) {
        const page = this.page;

        text(
          page === "ink" ? "Zeichenfarbe wählen:"
            : page === "laser-left" ? "Laserfarbe links wählen:"
            : "Laserfarbe rechts wählen:"
        );

        palette.forEach(([name, color]) => {
          button(name, () => {
            if (page === "ink") F.Settings.ink = color;
            else F.Settings.lasers[page === "laser-left" ? "left" : "right"] = color;

            this.render();
          }, color);
        });

        button("Zurück", () => this.navigate("colors"));
      }

      if (this.page === "help") {
        text([
          "Linker Joystick: laufen.",
          "Rechter Joystick: kontinuierlich drehen.",
          "Grip: Modell greifen und halten.",
          "Eine Hand bewegt und dreht.",
          "Zwei Hände skalieren.",
          "Trigger kurz: Punkt oder Auswahl.",
          "Trigger halten + bewegen: Oberflächenstrich.",
          "A/X: gehaltenes oder anvisiertes Objekt zurücksetzen.",
          "B/Y: Menü öffnen oder schließen.",
          "Raumwahltafeln: Laser + Trigger.",
          "Im Menü pausiert die Joystickbewegung."
        ].join("\n"));

        button("Zurück", () => this.navigate("home"));
      }

      if (this.page === "info") {
        const value = model
          ? model.fkcInfo || "Für dieses Modell sind noch keine Zusatzinformationen hinterlegt."
          : "Vor dem Öffnen des Menüs ein Modell greifen oder mit dem Laser darauf zeigen.";

        const lines = text(value, 13);

        if (lines.length > 13) {
          button("Nächster Textabschnitt", () => {
            this.textOffset = this.textOffset + 13 < lines.length
              ? this.textOffset + 13
              : 0;
            this.render();
          });
        }

        button("Zurück", () => this.navigate("home"));
      }

      if (this.page === "variants") {
        const variants = model && model.fkcVariants;

        if (!variants || !variants.length) {
          text("Für dieses Modell sind noch keine weiteren Darstellungen hinterlegt.");
        } else {
          text(model.fkcPendingVisual
            ? "Eine neue Darstellung wird geladen …"
            : "Darstellung wählen:");

          variants.slice(this.variantOffset, this.variantOffset + 5)
            .forEach(variant => {
              const selected = variant.id === model.fkcVariantId ? "✓ " : "";

              button(selected + variant.title, () => {
                F.switchVariant(model, variant.id);
                this.render();
              });
            });

          if (variants.length > 5) {
            button("Weitere Darstellungen", () => {
              this.variantOffset = this.variantOffset + 5 < variants.length
                ? this.variantOffset + 5
                : 0;
              this.render();
            });
          }
        }

        button("Zurück", () => this.navigate("home"));
      }

      if (this.page === "confirm") {
        text(
          "Diesen Raum wirklich zurücksetzen?\n\n" +
          "Alle Modelle kehren in ihre Ausgangslage zurück. " +
          "Alle Zeichnungen auf Modellen, Postern und Raumflächen werden gelöscht.\n\n" +
          "Die gewählten Modelldarstellungen und deine Position bleiben erhalten."
        );

        button("Abbrechen", () => this.navigate("home"));

        button("Ja, Raum zurücksetzen", () => {
          F.resetRoomNow();
          this.navigate("home");
        }, "#f1c7c7");
      }

      ctx.fillStyle = "#607668";
      ctx.font = "23px Arial";
      ctx.fillText("Laser + Trigger · B/Y schließt das Menü", 55, 1160);

      this.texture.needsUpdate = true;
    }
  };

  /*
   * ============================================================
   * VORHANDENE RÄUME ERGÄNZEN
   * ============================================================
   */
  const originalBuild = F.RoomBuilder.build;

  function boardImage(lines) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 576;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f8faf8";
    ctx.fillRect(0, 0, 1024, 576);
    ctx.fillStyle = "#304c3d";
    ctx.textAlign = "center";

    lines.forEach((line, index) => {
      ctx.font = index === 0 ? "bold 56px Arial" : "30px Arial";
      ctx.fillText(line, 512, 95 + index * 72, 940);
    });

    return canvas.toDataURL("image/png");
  }

  F.RoomBuilder.build = function (parent, config, rooms) {
    /*
     * Die erste Varianten-Datei dient beim Raumaufbau als Startmodell.
     * Der bisherige Builder kann deshalb unverändert bleiben.
     */
    const buildConfig = Object.assign({}, config);

    if (config.stations) {
      buildConfig.stations = config.stations.map(station => {
        const copy = Object.assign({}, station);
        const variants = Array.isArray(station.variants)
          ? station.variants.filter(item => item && item.model)
          : [];

        if (variants.length) copy.model = variants[0].model;
        return copy;
      });
    }

    const result = originalBuild.call(F.RoomBuilder, parent, buildConfig, rooms);

    /*
     * Feste Geometrieflächen werden bemalbar.
     * Unsichtbare Hitboxen und Modelle werden nicht doppelt registriert.
     */
    parent.querySelectorAll("[geometry]").forEach(el => {
      if (el.closest(".interactable")) return;
      if (el.classList.contains("vr-action")) return;

      el.classList.add("paintable");
    });

    if (config.stations) {
      config.stations.forEach((station, index) => {
        const root = document.getElementById(
          config.id + "-model-" + (index + 1)
        );

        if (!root) return;

        root.fkcInfo = station.info || "";
        root.fkcModelSize = config.modelSize || 0.5;
        root.fkcVariantAlignment = station.variantAlignment || "shared";

        const variants = Array.isArray(station.variants)
          ? station.variants.filter(item => item && item.model)
          : [];

        if (variants.length) {
          root.fkcVariants = variants.map((variant, number) => ({
            id: variant.id || "variant-" + (number + 1),
            title: variant.title || "Darstellung " + (number + 1),
            model: variant.model
          }));

          root.fkcVariantId = root.fkcVariants[0].id;
        }
      });
    }

    /*
     * Bedienungstafel aktualisieren, ohne den Museum-Builder zu ersetzen.
     * Im vorhandenen Begrüßungsraum ist die elfte Haupttafel die Hilfe.
     */
    if (config.kind === "welcome") {
      const boards = Array.from(parent.querySelectorAll("a-plane"))
        .filter(el => !el.classList.contains("vr-action"));

      const help = boards[0];

      if (help) {
        help.setAttribute("material", "src", boardImage([
          "Bedienung",
          "Links: laufen · Rechts: weich drehen",
          "Grip: greifen · 2 Hände: skalieren",
          "Trigger halten: auf Oberflächen zeichnen",
          "A/X: Objekt zurücksetzen",
          "B/Y: Menü / Hilfe / Darstellungen"
        ]));
      }
    }

    F.invalidateHits();

    return result;
  };

  const scene = F.getScene();

  /*
   * Neue GLB-Meshes oder Primitive können nach dem Raumaufbau erscheinen.
   */
  scene.addEventListener("object3dset", F.invalidateHits);
  scene.addEventListener("model-loaded", F.invalidateHits);
  scene.addEventListener("model-error", F.invalidateHits);
})(window.FKCVR);
