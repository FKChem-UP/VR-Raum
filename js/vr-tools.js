"use strict";

(function (F) {
  const V = THREE.Vector3;

  /*
   * ============================================================
   * EINSTELLUNGEN
   * ============================================================
   *
   * Eine Farbe pro Hand: Laserfarbe = Malfarbe.
   *
   * strokeRadius: Radius des Malstrichs in Metern.
   * laserDiameter: Durchmesser des Lasers in Metern.
   *
   * Komforteinstellungen gelten für die VR-Joysticks.
   * Desktopsteuerung bleibt unverändert.
   *
   * Einstellungen bleiben beim Raumwechsel erhalten.
   * Nach Neuladen der Seite gelten wieder die Standardwerte.
   */
  F.Settings = {
    lasers: {
      left: "#32d8df",
      right: "#ff9d38"
    },

    strokeRadius: 0.004,
    laserDiameter: 0.003,

    comfort: {
      walkSpeed: 3,
      turnMode: "continuous",
      vignette: "off"
    }
  };

  const palette = [
    ["Türkis", "#32d8df"],
    ["Orange", "#ff9d38"],
    ["Pink", "#ff3f92"],
    ["Blau", "#507dff"],
    ["Grün", "#45d77e"],
    ["Rot", "#ee5151"]
  ];

  const strokeSizes = [
    ["Fein: 4 mm", 0.002],
    ["Normal: 8 mm", 0.004],
    ["Mittel: 12 mm", 0.006],
    ["Breit: 20 mm", 0.010],
    ["Sehr breit: 32 mm", 0.016]
  ];

  const laserSizes = [
    ["Fein: 1 mm", 0.001],
    ["Normal: 3 mm", 0.003],
    ["Breit: 6 mm", 0.006]
  ];

  function colorName(color) {
    const entry = palette.find(item => item[1] === color);
    return entry ? entry[0] : color;
  }

  function diameterMm() {
    return Math.round(F.Settings.strokeRadius * 2000);
  }

  function laserDiameterMm() {
    return Math.round(F.Settings.laserDiameter * 1000);
  }

  function turnModeName() {
    const mode = F.Settings.comfort.turnMode;

    if (mode === "snap") return "30°-Schritte";
    if (mode === "off") return "Aus";

    return "Kontinuierlich";
  }

  function vignetteName() {
    const mode = F.Settings.comfort.vignette;

    if (mode === "light") return "Leicht";
    if (mode === "strong") return "Stark";

    return "Aus";
  }

  function walkSpeedName() {
    return F.Settings.comfort.walkSpeed === 1.5
      ? "Langsam: 1,5 m/s"
      : "Normal: 3 m/s";
  }

  /*
   * ============================================================
   * TREFFERPRÜFUNG
   * ============================================================
   */
  let hitTargets = [];
  let hitDirty = true;

  F.invalidateHits = function () {
    hitDirty = true;
  };

  function effectivelyVisible(object) {
    for (let current = object; current; current = current.parent) {
      if (!current.visible) return false;
    }

    return true;
  }

  function isDrawingObject(object) {
    for (let current = object; current; current = current.parent) {
      if (current.userData && current.userData.fkcDrawing) {
        return true;
      }
    }

    return false;
  }

  function rebuildHits() {
    hitTargets = [];

    const scene = F.getScene();
    if (!scene) return;

    const used = new Set();

    [
      [".vr-action", "action"],
      [".model-visual", "model"],
      [".paintable", "surface"]
    ].forEach(([selector, type]) => {
      scene.querySelectorAll(selector).forEach(el => {
        const owner = type === "model"
          ? el.closest(".interactable")
          : el;

        if (!owner) return;

        el.object3D.traverse(object => {
          if (
            !object.isMesh ||
            used.has(object) ||
            isDrawingObject(object)
          ) return;

          used.add(object);

          hitTargets.push({
            mesh: object,
            type,
            el: owner
          });
        });
      });
    });

    hitDirty = false;
  }

  F.findHit = function (raycaster, includeSurfaces) {
    if (hitDirty) rebuildHits();

    const menuOpen = F.Menu && F.Menu.opened;

    const targets = hitTargets.filter(target => {
      if (
        !target.el.isConnected ||
        !effectivelyVisible(target.mesh)
      ) return false;

      if (menuOpen) {
        return (
          target.type === "action" &&
          target.el.dataset.fkcMenu === "true"
        );
      }

      if (
        target.type === "model" &&
        !target.el.modelReady
      ) return false;

      return includeSurfaces || target.type === "action";
    });

    targets.forEach(target => {
      target.mesh.updateWorldMatrix(true, false);
    });

    const lookup = new Map(
      targets.map(target => [target.mesh, target])
    );

    const hits = raycaster.intersectObjects(
      targets.map(target => target.mesh),
      false
    );

    if (!hits.length) return null;

    const hit = hits[0];
    const target = lookup.get(hit.object);

    const normal = hit.face
      ? hit.face.normal.clone().applyMatrix3(
          new THREE.Matrix3().getNormalMatrix(
            hit.object.matrixWorld
          )
        ).normalize()
      : raycaster.ray.direction.clone().negate();

    if (normal.dot(raycaster.ray.direction) > 0) {
      normal.negate();
    }

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
   * ZEICHENFLÄCHEN
   * ============================================================
   */
  const PAINT_SELECTOR = [
    "[geometry]",
    "a-box",
    "a-plane",
    "a-sphere",
    "a-cylinder",
    "a-cone",
    "a-circle",
    "a-ring",
    "a-torus",
    "a-triangle"
  ].join(",");

  function markPaintable(el) {
    const roomRoot = document.getElementById("room-root");

    if (
      !el ||
      !el.matches ||
      !roomRoot ||
      !roomRoot.contains(el) ||
      !el.matches(PAINT_SELECTOR)
    ) return;

    if (el.closest(".interactable")) return;
    if (el.closest(".vr-action")) return;

    el.classList.add("paintable");
  }

  function markRoomSurfaces(parent) {
    parent.querySelectorAll(PAINT_SELECTOR).forEach(markPaintable);
    F.invalidateHits();
  }

  /*
   * ============================================================
   * ZEICHNEN
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

      if (index >= 0) {
        this.strokes.splice(index, 1);
      }
    },

    clear: function (target) {
      this.strokes.slice().forEach(stroke => {
        if (
          !target ||
          stroke.owner === target ||
          target.contains(stroke.owner)
        ) {
          this.remove(stroke);
        }
      });
    },

    createStroke: function (
      hit, parent, point, radius, color, worldRadius
    ) {
      while (this.strokes.length >= MAX_STROKES) {
        this.remove(this.strokes[0]);
      }

      const group = new THREE.Group();
      group.userData.fkcDrawing = true;
      parent.add(group);

      const material = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide
      });

      // Einzelpunkte bleiben größer als die Linie.
      const dotGeometry = new THREE.SphereGeometry(
        radius * 2, 8, 6
      );

      const dot = new THREE.Mesh(dotGeometry, material);
      dot.position.copy(point);
      group.add(dot);

      const positions = new Float32Array(
        CAPACITY * SIDES * 3
      );

      const indices = new Uint16Array(
        (CAPACITY - 1) * SIDES * 6
      );

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

      geometry.setIndex(
        new THREE.BufferAttribute(indices, 1)
      );

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
        worldRadius,
        color,
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
          .addScaledVector(
            u, Math.cos(angle) * stroke.radius
          )
          .addScaledVector(
            v, Math.sin(angle) * stroke.radius
          );

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

    sample: function (stroke, hit, hand) {
      const body = hit.type === "model"
        ? hit.el.querySelector(".manip-body")
        : hit.el;

      if (!body) return null;

      const color =
        F.Settings.lasers[hand] || F.Settings.lasers.right;

      const worldRadius = F.Settings.strokeRadius;
      const parent = body.object3D;

      parent.updateWorldMatrix(true, true);

      const scale = parent.getWorldScale(new V());
      const factor = Math.max(0.0001, Math.abs(scale.x));
      const surfaceOffset = Math.max(0.004, worldRadius);

      const worldPoint = hit.point.clone()
        .addScaledVector(hit.normal, surfaceOffset);

      const localPoint = parent.worldToLocal(
        worldPoint.clone()
      );

      let sameStroke = !!(
        stroke &&
        !stroke.removed &&
        stroke.owner === hit.el &&
        stroke.surfaceMesh === hit.mesh &&
        stroke.parent === parent &&
        stroke.color === color &&
        stroke.worldRadius === worldRadius &&
        stroke.count < CAPACITY
      );

      if (sameStroke) {
        const previousWorld = parent.localToWorld(
          stroke.lastLocal.clone()
        );

        const distance = previousWorld.distanceTo(worldPoint);

        if (distance < 0.006) return stroke;

        if (
          distance > 0.18 ||
          stroke.lastNormal.dot(hit.normal) < 0.4
        ) {
          sameStroke = false;
        }
      }

      if (!sameStroke) {
        return this.createStroke(
          hit,
          parent,
          localPoint,
          worldRadius / factor,
          color,
          worldRadius
        );
      }

      const direction = localPoint.clone()
        .sub(stroke.lastLocal);

      this.addRing(stroke, localPoint, direction);

      stroke.lastLocal.copy(localPoint);
      stroke.lastNormal.copy(hit.normal);

      return stroke;
    }
  };

  /*
   * ============================================================
   * LASER MIT EINSTELLBARER BREITE
   * ============================================================
   *
   * WebGL-Linien sind auf vielen Geräten immer nur etwa einen
   * Pixel breit. Deshalb wird die sichtbare Linie durch einen
   * schlanken Zylinder ersetzt.
   *
   * Trefferprüfung, Ursprung, Endpunkt, Controlleraktionen und
   * Pointer bleiben aus der vorhandenen Steuerung erhalten.
   */
  function connectHandLaser(el) {
    const tools = el.components &&
      el.components["fkc-controller"];

    if (!tools || tools.fkcWideLaserInstalled) return;

    tools.fkcWideLaserInstalled = true;

    const oldTick = tools.tick;
    const oldRemove = tools.remove;

    const cylinderGeometry = new THREE.CylinderGeometry(
      1, 1, 1, 8, 1, true
    );

    const laserMaterial = new THREE.MeshBasicMaterial({
      color: F.Settings.lasers[tools.data.hand] ||
        F.Settings.lasers.right,
      transparent: true,
      opacity: 0.95,
      toneMapped: false
    });

    const laserMesh = new THREE.Mesh(
      cylinderGeometry,
      laserMaterial
    );

    laserMesh.frustumCulled = false;
    laserMesh.visible = false;

    /*
     * Die alte BufferGeometry bleibt erhalten:
     * der bestehende Controller aktualisiert sie weiterhin.
     *
     * Sichtbar ist ausschließlich der neue Zylinder.
     * Beim Entfernen werden beide Geometrien freigegeben.
     */
    const oldMaterial = tools.material;

    tools.material = laserMaterial;
    tools.line = laserMesh;
    tools.lineEntity.setObject3D("laser", laserMesh);

    oldMaterial.dispose();

    const axis = new V(0, 1, 0);
    const direction = new V();

    tools.tick = function (time, delta) {
      oldTick.call(this, time, delta);

      if (!this.line.visible) return;

      direction.copy(this.endpoint).sub(this.origin);
      const length = direction.length();

      if (length < 0.0001) {
        this.line.visible = false;
        return;
      }

      direction.multiplyScalar(1 / length);

      this.line.position.copy(this.origin)
        .add(this.endpoint)
        .multiplyScalar(0.5);

      this.line.quaternion.setFromUnitVectors(
        axis,
        direction
      );

      const radius = F.Settings.laserDiameter / 2;

      this.line.scale.set(radius, length, radius);
      this.line.updateMatrixWorld(true);
    };

    tools.remove = function () {
      cylinderGeometry.dispose();
      oldRemove.call(this);
    };
  }

  /*
   * Handzuordnung für das Zeichnen ergänzen.
   */
  function connectHandDrawing(el) {
    const tools = el.components &&
      el.components["fkc-controller"];

    if (!tools || tools.fkcHandDrawingInstalled) return;

    tools.fkcHandDrawingInstalled = true;

    tools.sampleDrawing = function () {
      if (!this.drawingAllowed || !F.Draw) return;

      if (!this.hit || this.hit.type === "action") {
        this.stroke = null;
        return;
      }

      this.stroke = F.Draw.sample(
        this.stroke,
        this.hit,
        this.data.hand
      );
    };
  }

  function connectHandTools(el) {
    connectHandDrawing(el);
    connectHandLaser(el);
  }

  function connectAllHands() {
    const scene = F.getScene();
    if (!scene) return;

    scene.querySelectorAll("[fkc-controller]")
      .forEach(connectHandTools);
  }

  /*
   * ============================================================
   * KOMFORTVIGNETTE
   * ============================================================
   *
   * Bildschirmfüllende, transparente Abdunklung.
   *
   * Die Darstellung erfolgt getrennt für die beiden XR-Augen.
   * Die Projektionsdaten des gerade gerenderten Auges bestimmen
   * den freien Bereich in Blickrichtung.
   *
   * Es wird NICHT das tatsächliche Kamera-FOV verändert.
   * Stattdessen werden die äußeren Bildbereiche abgedunkelt.
   *
   * Keine DOM-Fläche und kein Raycastziel.
   */
  F.Comfort = {
    amount: 0,
    mesh: null,
    geometry: null,
    material: null,

    init: function () {
      if (this.mesh) return;

      const scene = F.getScene();
      if (!scene) return;

      this.geometry = new THREE.PlaneGeometry(2, 2);

      this.material = new THREE.ShaderMaterial({
        uniforms: {
          amount: {value: 0},
          innerRadius: {value: 0.78},
          outerRadius: {value: 1.28},
          eyeProjection: {
            value: new THREE.Vector4(1, 1, 0, 0)
          }
        },

        vertexShader: `
          varying vec2 vScreenPosition;

          void main() {
            vScreenPosition = position.xy;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }
        `,

        fragmentShader: `
          precision mediump float;

          varying vec2 vScreenPosition;

          uniform float amount;
          uniform float innerRadius;
          uniform float outerRadius;
          uniform vec4 eyeProjection;

          void main() {
            vec2 scale = max(
              abs(eyeProjection.xy),
              vec2(0.0001)
            );

            vec2 tangentDirection =
              (vScreenPosition + eyeProjection.zw) / scale;

            float radius = length(tangentDirection);

            float edge = smoothstep(
              innerRadius,
              outerRadius,
              radius
            );

            float alpha = edge * amount * 0.96;

            if (alpha < 0.001) discard;

            gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
          }
        `,

        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false
      });

      this.mesh = new THREE.Mesh(
        this.geometry,
        this.material
      );

      this.mesh.name = "fkc-comfort-vignette";
      this.mesh.frustumCulled = false;
      this.mesh.visible = false;

      /*
       * Nach der Raumdarstellung, aber vor dem VR-Menü.
       * Das Menü selbst wird mit renderOrder 100 gezeichnet.
       */
      this.mesh.renderOrder = 90;

      this.mesh.onBeforeRender = (
        renderer, renderScene, camera
      ) => {
        if (!camera || !camera.projectionMatrix) return;

        const p = camera.projectionMatrix.elements;

        this.material.uniforms.eyeProjection.value.set(
          p[0],
          p[5],
          p[8],
          p[9]
        );

        /*
         * Auch bei zwei Augen mit demselben Material müssen
         * die Projektionsuniforms pro Auge neu übertragen werden.
         */
        this.material.uniformsNeedUpdate = true;
      };

      scene.object3D.add(this.mesh);
    },

    update: function (active, delta) {
      const scene = F.getScene();

      if (
        !scene ||
        !scene.is("vr-mode") ||
        (F.Menu && F.Menu.opened) ||
        F.Settings.comfort.vignette === "off"
      ) {
        this.reset();
        return;
      }

      const seconds = Math.min(
        Math.max((delta || 0) / 1000, 0),
        0.05
      );

      const target = active ? 1 : 0;
      const duration = active ? 0.15 : 0.25;

      if (this.amount < target) {
        this.amount = Math.min(
          target,
          this.amount + seconds / duration
        );
      } else {
        this.amount = Math.max(
          target,
          this.amount - seconds / duration
        );
      }

      if (this.amount <= 0) {
        if (this.mesh) this.mesh.visible = false;
        return;
      }

      this.init();
      if (!this.mesh) return;

      const strong =
        F.Settings.comfort.vignette === "strong";

      /*
       * Radien in Tangentenkoordinaten:
       * leicht: freies Zentrum ungefähr bis 38°;
       * stark: freies Zentrum ungefähr bis 26°.
       *
       * Übergänge sind weich, keine harte schwarze Kante.
       */
      this.material.uniforms.innerRadius.value =
        strong ? 0.49 : 0.78;

      this.material.uniforms.outerRadius.value =
        strong ? 0.84 : 1.28;

      this.material.uniforms.amount.value = this.amount;
      this.mesh.visible = true;
    },

    reset: function () {
      this.amount = 0;

      if (this.material) {
        this.material.uniforms.amount.value = 0;
      }

      if (this.mesh) {
        this.mesh.visible = false;
      }
    },

    dispose: function () {
      this.reset();

      if (this.mesh) this.mesh.removeFromParent();
      if (this.geometry) this.geometry.dispose();
      if (this.material) this.material.dispose();

      this.mesh = null;
      this.geometry = null;
      this.material = null;
    }
  };

  /*
   * ============================================================
   * VR-NAVIGATION ERGÄNZEN
   * ============================================================
   *
   * Die vorhandene Navigationskomponente wird nach ihrer
   * Initialisierung ergänzt.
   *
   * Weiterverwendet werden:
   * - Bewegung entlang der Blickrichtung;
   * - Raumgrenzen;
   * - Drehung um die Kopfposition;
   * - Desktopsteuerung;
   * - bestehende Lifecycle-Listener.
   *
   * Keine Teleportsteuerung.
   */
  function connectNavigation() {
    const navigation = F.getNavigation();

    if (
      !navigation ||
      navigation.fkcComfortInstalled
    ) return;

    navigation.fkcComfortInstalled = true;

    const oldTick = navigation.tick;
    const oldCancel = navigation.cancel;
    const oldRemove = navigation.remove;

    const beforeMove = new V();
    const afterMove = new V();

    const state = {
      blocked: false,
      snapReady: true,
      pendingAngle: 0,
      pendingDelay: 0,
      snapHold: 0
    };

    navigation.cancel = function () {
      oldCancel.call(this);

      /*
       * Nach Menü-/Raumwechsel oder Einstellungsänderungen
       * erst weiterlaufen, wenn beide Sticks neutral waren.
       */
      state.blocked = true;
      state.snapReady = false;
      state.pendingAngle = 0;
      state.pendingDelay = 0;
      state.snapHold = 0;

      F.Comfort.reset();
    };

    /*
     * Die bestehende Komponente hatte die alte cancel-Funktion
     * bereits als Eventlistener eingetragen.
     * Diese Listener werden auf die erweiterte Funktion umgestellt.
     */
    window.removeEventListener("blur", oldCancel);

    navigation.el.sceneEl.removeEventListener(
      "enter-vr", oldCancel
    );

    navigation.el.sceneEl.removeEventListener(
      "exit-vr", oldCancel
    );

    window.addEventListener("blur", navigation.cancel);

    navigation.el.sceneEl.addEventListener(
      "enter-vr", navigation.cancel
    );

    navigation.el.sceneEl.addEventListener(
      "exit-vr", navigation.cancel
    );

    navigation.tick = function (time, delta) {
      const scene = this.el.sceneEl;

      if (F.Menu && F.Menu.opened) {
        F.Comfort.reset();
        return;
      }

      /*
       * Außerhalb von VR bleibt die bisherige
       * Tastatursteuerung unverändert.
       */
      if (!scene.is("vr-mode")) {
        F.Comfort.reset();
        oldTick.call(this, time, delta);
        return;
      }

      const seconds = Math.min(
        Math.max((delta || 0) / 1000, 0),
        0.05
      );

      const left = F.readStick(
        F.getSource(scene, "left")
      );

      const right = F.readStick(
        F.getSource(scene, "right")
      );

      const neutralLimit = this.data.deadzone;

      const leftNeutral =
        Math.abs(left.x) <= neutralLimit &&
        Math.abs(left.y) <= neutralLimit;

      const rightNeutral =
        Math.abs(right.x) <= neutralLimit &&
        Math.abs(right.y) <= neutralLimit;

      if (state.blocked) {
        if (leftNeutral && rightNeutral) {
          state.blocked = false;
          state.snapReady = true;
        }

        F.Comfort.update(false, delta);
        return;
      }

      const settings = F.Settings.comfort;

      const moveX = this.applyDeadzone(left.x);
      const moveY = this.applyDeadzone(left.y);
      const turn = this.applyDeadzone(right.x);

      let rotated = false;

      state.snapHold = Math.max(
        0,
        state.snapHold - seconds
      );

      if (settings.turnMode === "continuous") {
        state.pendingAngle = 0;
        state.pendingDelay = 0;

        if (turn && seconds > 0) {
          this.rotateAroundHead(
            -turn *
            THREE.MathUtils.degToRad(this.data.turnSpeed) *
            seconds
          );

          rotated = true;
        }
      } else if (settings.turnMode === "snap") {
        /*
         * Erst nach Neutralstellung ist der nächste
         * Drehschritt möglich.
         */
        if (Math.abs(right.x) <= neutralLimit) {
          state.snapReady = true;
        }

        if (
          state.snapReady &&
          state.pendingAngle === 0 &&
          Math.abs(right.x) >= 0.60
        ) {
          state.snapReady = false;

          const angle =
            -Math.sign(right.x) *
            THREE.MathUtils.degToRad(30);

          if (settings.vignette === "off") {
            this.rotateAroundHead(angle);
            rotated = true;
          } else {
            /*
             * Kurzer Vorlauf: Vignette beginnt vor dem
             * eigentlichen Drehschritt.
             */
            state.pendingAngle = angle;
            state.pendingDelay = 0.10;
            state.snapHold = 0.28;
          }
        }

        if (state.pendingAngle !== 0) {
          state.pendingDelay -= seconds;

          if (state.pendingDelay <= 0) {
            this.rotateAroundHead(state.pendingAngle);

            state.pendingAngle = 0;
            state.pendingDelay = 0;
            state.snapHold = 0.18;

            rotated = true;
          }
        }
      } else {
        // Drehung per Joystick ausgeschaltet.
        state.pendingAngle = 0;
        state.pendingDelay = 0;
        state.snapHold = 0;
      }

      /*
       * Die Vignette reagiert auf tatsächliche Bewegung.
       * Gegen eine Wand zu drücken löst sie nicht dauerhaft aus.
       */
      this.el.object3D.getWorldPosition(beforeMove);

      this.move(
        moveX,
        moveY,
        settings.walkSpeed,
        delta
      );

      this.el.object3D.getWorldPosition(afterMove);

      const moved =
        beforeMove.distanceToSquared(afterMove) > 0.00000001;

      const preparingSnap = state.pendingAngle !== 0;
      const holdingSnap = state.snapHold > 0;

      F.Comfort.update(
        moved || rotated || preparingSnap || holdingSnap,
        delta
      );
    };

    navigation.remove = function () {
      /*
       * Die bestehende remove-Funktion entfernt die Listener
       * über this.cancel, also die neue Funktion.
       */
      oldRemove.call(this);
      F.Comfort.dispose();
    };
  }

  function changeComfort(key, value, message) {
    F.Settings.comfort[key] = value;

    connectNavigation();

    const navigation = F.getNavigation();
    if (navigation) navigation.cancel();

    F.Menu.blockDrawing();

    F.setStatus(message);
    F.Menu.notify(message);
  }

  /*
   * ============================================================
   * MODELLVARIANTEN
   * ============================================================
   */
  F.switchVariant = function (root, variantId) {
    if (
      !root ||
      !root.isConnected ||
      !root.fkcVariants
    ) return;

    const variant = root.fkcVariants.find(
      item => item.id === variantId
    );

    if (!variant) return;

    if (root.fkcVariantId === variantId) {
      F.Menu.notify(
        "Diese Darstellung ist bereits ausgewählt."
      );

      return;
    }

    const body = root.querySelector(".manip-body");

    const oldVisuals = Array.from(
      body.querySelectorAll(".model-visual")
    );

    if (root.fkcPendingVisual) {
      root.fkcPendingVisual.remove();
    }

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

    F.setStatus(
      "Darstellung wird geladen: " + variant.title
    );

    F.Menu.notify(
      "Wird geladen: " + variant.title
    );

    const isCurrent = () => (
      root.isConnected &&
      pending.isConnected &&
      root.fkcVariantToken === token
    );

    const fail = () => {
      if (!isCurrent()) return;

      pending.remove();
      root.fkcPendingVisual = null;

      const message =
        "Laden fehlgeschlagen. Bisheriges Modell bleibt erhalten.";

      F.setStatus(message);

      if (F.Menu.opened) {
        F.Menu.notify(message);
      }
    };

    pending.addEventListener(
      "model-error", fail, {once: true}
    );

    pending.addEventListener("model-loaded", () => {
      queueMicrotask(() => {
        if (!isCurrent()) return;

        const normalize =
          pending.components["fkc-normalize"];

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

        hitbox.object3D.position.copy(
          normalize.result.center
        );

        root.fkcVariantId = variantId;
        root.fkcPendingVisual = null;

        F.invalidateHits();

        F.setStatus(
          "Darstellung geöffnet: " + variant.title
        );

        if (F.Menu.opened) {
          F.Menu.notify(
            "Darstellung: " + variant.title
          );
        }
      });
    }, {once: true});

    pending.setAttribute(
      "gltf-model",
      "url(" + variant.model + ")"
    );
  };

  /*
   * ============================================================
   * VR-MENÜ
   * ============================================================
   */
  const WIDTH = 1024;
  const HEIGHT = 1200;

  function darken(color) {
    const c = new THREE.Color(color);
    c.multiplyScalar(0.72);

    return "#" + c.getHexString();
  }

  function readableText(color) {
    const c = new THREE.Color(color);

    const brightness =
      c.r * 0.2126 +
      c.g * 0.7152 +
      c.b * 0.0722;

    return brightness < 0.30
      ? "#ffffff"
      : "#173527";
  }

  F.Menu = {
    opened: false,
    page: "home",
    target: null,
    buttons: [],
    textOffset: 0,
    variantOffset: 0,
    pressedIndex: -1,
    busy: false,
    clickTimer: null,
    message: "",

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

      const mesh = new THREE.Mesh(
        this.geometry,
        this.material
      );

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
      const scene = F.getScene();
      if (!scene) return;

      scene.querySelectorAll("[fkc-controller]")
        .forEach(hand => {
          const tools = hand.components["fkc-controller"];
          if (!tools) return;

          tools.stroke = null;
          tools.drawingAllowed = false;
        });
    },

    notify: function (message) {
      this.message = message;

      if (this.opened) {
        this.render();
      }
    },

    cancelClick: function () {
      if (this.clickTimer !== null) {
        clearTimeout(this.clickTimer);
      }

      this.clickTimer = null;
      this.busy = false;
      this.pressedIndex = -1;
    },

    toggle: function (hand) {
      if (this.opened) this.close();
      else this.open(hand);
    },

    open: function (hand) {
      this.init();
      this.cancelClick();

      connectNavigation();

      const scene = F.getScene();

      this.target = hand
        ? F.resolveTarget(hand)
        : scene.lastSelectedTarget;

      if (
        !this.target &&
        scene.lastSelectedModel &&
        scene.lastSelectedModel.isConnected
      ) {
        this.target = scene.lastSelectedModel;
      }

      F.releaseHands();
      this.blockDrawing();

      const navigation = F.getNavigation();
      if (navigation) navigation.cancel();

      F.Comfort.reset();

      const camera = scene.camera;
      if (!camera) return;

      const position = camera.getWorldPosition(new V());
      const forward = camera.getWorldDirection(new V());

      forward.y = 0;

      if (forward.lengthSq() < 0.0001) {
        forward.set(0, 0, -1);
      }

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
      this.message = "";

      this.render();
      F.invalidateHits();
    },

    close: function () {
      this.cancelClick();
      this.opened = false;

      if (this.root) {
        this.root.object3D.visible = false;
      }

      this.blockDrawing();

      const navigation = F.getNavigation();
      if (navigation) navigation.cancel();

      F.Comfort.reset();
      F.invalidateHits();
    },

    navigate: function (page) {
      this.page = page;
      this.textOffset = 0;
      this.variantOffset = 0;
      this.message = "";

      this.render();
    },

    click: function (hit) {
      if (
        !this.opened ||
        !hit.uv ||
        this.busy
      ) return;

      const x = hit.uv.x * WIDTH;
      const y = (1 - hit.uv.y) * HEIGHT;

      const index = this.buttons.findIndex(item => (
        x >= item.x &&
        x <= item.x + item.w &&
        y >= item.y &&
        y <= item.y + item.h
      ));

      if (index < 0) return;

      const clicked = this.buttons[index];

      this.busy = true;
      this.pressedIndex = index;
      this.message = "Ausgewählt: " + clicked.label;

      this.render();

      // Druckrückmeldung vor Ausführung sichtbar machen.
      this.clickTimer = setTimeout(() => {
        this.clickTimer = null;
        this.busy = false;
        this.pressedIndex = -1;

        if (!this.opened) return;

        try {
          clicked.action();
        } catch (error) {
          console.error(
            "Menüaktion fehlgeschlagen:",
            error
          );

          this.message = "Aktion fehlgeschlagen.";
        }

        if (this.opened) {
          this.render();
        }
      }, 180);
    },

    wrap: function (text, maxWidth) {
      const lines = [];

      String(text || "").split("\n")
        .forEach(paragraph => {
          if (!paragraph.trim()) {
            lines.push("");
            return;
          }

          let line = "";

          paragraph.split(/\s+/).forEach(word => {
            const candidate = line
              ? line + " " + word
              : word;

            if (
              line &&
              this.ctx.measureText(candidate).width > maxWidth
            ) {
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

      const target =
        this.target && this.target.isConnected
          ? this.target
          : null;

      const model =
        target &&
        target.classList.contains("interactable")
          ? target
          : null;

      const name = model
        ? model.dataset.title
        : target
          ? "Ausgewählte Zeichenfläche"
          : "Kein Modell ausgewählt";

      ctx.font = "27px Arial";
      ctx.fillText(name, 55, 125, 910);

      let y = 175;

      const button = (
        label, action, color, selected
      ) => {
        const h = 72;
        const x = 55;
        const w = 914;

        const index = this.buttons.length;
        const pressed = index === this.pressedIndex;

        const baseColor = color || "#dfe9e2";
        const fill = pressed
          ? darken(baseColor)
          : baseColor;

        const offset = pressed ? 5 : 0;

        ctx.fillStyle = "#a9bcae";
        ctx.fillRect(x, y + 5, w, h);

        ctx.fillStyle = fill;
        ctx.fillRect(x, y + offset, w, h);

        ctx.strokeStyle = selected
          ? "#173527"
          : "#a9bcae";

        ctx.lineWidth = selected ? 6 : 2;
        ctx.strokeRect(x, y + offset, w, h);

        ctx.fillStyle = readableText(fill);
        ctx.font = selected
          ? "bold 30px Arial"
          : "30px Arial";

        ctx.fillText(
          (selected ? "✓ " : "") + label,
          x + 22,
          y + 46 + offset,
          w - 44
        );

        this.buttons.push({
          x, y, w, h, label, action
        });

        y += 86;
      };

      const text = (value, maximumLines) => {
        ctx.fillStyle = "#30493b";
        ctx.font = "29px Arial";

        const lines = this.wrap(value, 910);

        const shown = maximumLines
          ? lines.slice(
              this.textOffset,
              this.textOffset + maximumLines
            )
          : lines;

        shown.forEach(line => {
          ctx.fillText(line, 55, y + 30, 914);
          y += 43;
        });

        y += 15;

        return lines;
      };

      /*
       * HAUPTMENÜ
       *
       * Zehn Buttons passen oberhalb der Bestätigungszeile.
       */
      if (this.page === "home") {
        button(
          "Strichstärke & Laser – Größen ändern",
          () => this.navigate("stroke-size"),
          "#cddff3"
        );

        button(
          "Laser- und Malfarben einstellen",
          () => this.navigate("colors")
        );

        button(
          "Bewegung & Komfort",
          () => this.navigate("comfort"),
          "#d8d4f2"
        );

        button(
          "Bedienhilfe anzeigen",
          () => this.navigate("help")
        );

        button(
          "Informationen zum Modell",
          () => this.navigate("info")
        );

        button(
          "Modelldarstellung wechseln",
          () => this.navigate("variants")
        );

        button(
          "Ausgewähltes Objekt zurücksetzen",
          () => {
            if (!target) {
              this.notify("Kein Objekt ausgewählt.");
              return;
            }

            F.resetTarget(target);

            this.notify(
              "Ausgewähltes Objekt zurückgesetzt."
            );
          }
        );

        button(
          "Alle Zeichnungen im Raum löschen",
          () => {
            F.clearMarkers();

            this.notify(
              "Alle Zeichnungen wurden gelöscht."
            );
          }
        );

        button(
          "Kompletten Raum zurücksetzen …",
          () => this.navigate("confirm")
        );

        button(
          "Menü schließen",
          () => this.close()
        );
      }

      /*
       * FARBEN
       */
      if (this.page === "colors") {
        text(
          "Eine Farbe pro Hand:\n" +
          "Der Laser zeichnet immer in seiner eigenen Farbe."
        );

        button(
          "Linke Farbe: " +
            colorName(F.Settings.lasers.left),
          () => this.navigate("color-left"),
          F.Settings.lasers.left
        );

        button(
          "Rechte Farbe: " +
            colorName(F.Settings.lasers.right),
          () => this.navigate("color-right"),
          F.Settings.lasers.right
        );

        button(
          "Zurück",
          () => this.navigate("home")
        );
      }

      if (
        this.page === "color-left" ||
        this.page === "color-right"
      ) {
        const hand = this.page === "color-left"
          ? "left"
          : "right";

        const description = hand === "left"
          ? "Links"
          : "Rechts";

        text(
          description + ": Laser- und Malfarbe wählen"
        );

        palette.forEach(([name, color]) => {
          button(
            name,
            () => {
              F.Settings.lasers[hand] = color;
              this.blockDrawing();

              const message =
                description + ": " + name +
                " – Laser und Zeichnen";

              F.setStatus(message);
              this.notify(message);
            },
            color,
            F.Settings.lasers[hand] === color
          );
        });

        button(
          "Zurück",
          () => this.navigate("colors")
        );
      }

      /*
       * GEMEINSAMES MENÜ FÜR MALSTRICH UND LASER
       */
      if (this.page === "stroke-size") {
        text(
          "Größen für beide Hände einstellen.\n" +
          "Laserbreite und Malstrichstärke sind unabhängig."
        );

        button(
          "Malstrich: " + diameterMm() +
            " mm – ändern",
          () => this.navigate("paint-size"),
          "#cddff3"
        );

        button(
          "Laser: " + laserDiameterMm() +
            " mm – ändern",
          () => this.navigate("laser-size"),
          "#d2e9ec"
        );

        button(
          "Zurück",
          () => this.navigate("home")
        );
      }

      if (this.page === "paint-size") {
        text(
          "Malstrichdurchmesser für beide Hände wählen.\n" +
          "Vorhandene Zeichnungen bleiben unverändert."
        );

        strokeSizes.forEach(([label, radius]) => {
          button(
            label,
            () => {
              F.Settings.strokeRadius = radius;
              this.blockDrawing();

              const message =
                "Malstrich: " + diameterMm() +
                " mm – beide Hände";

              F.setStatus(message);
              this.notify(message);
            },
            null,
            F.Settings.strokeRadius === radius
          );
        });

        button(
          "Zurück",
          () => this.navigate("stroke-size")
        );
      }

      if (this.page === "laser-size") {
        text(
          "Laserbreite für beide Hände wählen.\n" +
          "Die Änderung ist sofort sichtbar.\n" +
          "Die Malstrichstärke bleibt unverändert."
        );

        laserSizes.forEach(([label, diameter]) => {
          button(
            label,
            () => {
              F.Settings.laserDiameter = diameter;

              const message =
                "Laserbreite: " + laserDiameterMm() +
                " mm – beide Hände";

              F.setStatus(message);
              this.notify(message);
            },
            null,
            F.Settings.laserDiameter === diameter
          );
        });

        button(
          "Zurück",
          () => this.navigate("stroke-size")
        );
      }

      /*
       * BEWEGUNG UND KOMFORT
       */
      if (this.page === "comfort") {
        text(
          "Komforteinstellungen für die VR-Joysticks.\n" +
          "Kopfbewegungen bleiben uneingeschränkt."
        );

        button(
          "Laufen: " + walkSpeedName(),
          () => this.navigate("walk-speed")
        );

        button(
          "Drehung: " + turnModeName(),
          () => this.navigate("turn-mode")
        );

        button(
          "Komfortvignette: " + vignetteName(),
          () => this.navigate("vignette"),
          "#d8d4f2"
        );

        text(
          "Nach dem Schließen beide Joysticks kurz loslassen.\n" +
          "Bei Unwohlsein bitte die VR-Brille absetzen."
        );

        button(
          "Zurück",
          () => this.navigate("home")
        );
      }

      if (this.page === "walk-speed") {
        text(
          "Laufgeschwindigkeit wählen.\n" +
          "Die Einstellung gilt nur für VR."
        );

        button(
          "Langsam: 1,5 m/s",
          () => changeComfort(
            "walkSpeed",
            1.5,
            "Laufen: langsam – 1,5 m/s"
          ),
          null,
          F.Settings.comfort.walkSpeed === 1.5
        );

        button(
          "Normal: 3 m/s",
          () => changeComfort(
            "walkSpeed",
            3,
            "Laufen: normal – 3 m/s"
          ),
          null,
          F.Settings.comfort.walkSpeed === 3
        );

        button(
          "Zurück",
          () => this.navigate("comfort")
        );
      }

      if (this.page === "turn-mode") {
        text(
          "Drehung mit dem rechten Joystick wählen.\n" +
          "Bei Drehschritten: Stick danach neutral stellen.\n" +
          "Natürliches Umschauen bleibt immer möglich."
        );

        button(
          "Kontinuierlich: maximal 60°/s",
          () => changeComfort(
            "turnMode",
            "continuous",
            "Drehung: kontinuierlich"
          ),
          null,
          F.Settings.comfort.turnMode === "continuous"
        );

        button(
          "Schrittweise: 30° pro Auslösung",
          () => changeComfort(
            "turnMode",
            "snap",
            "Drehung: 30°-Schritte"
          ),
          null,
          F.Settings.comfort.turnMode === "snap"
        );

        button(
          "Joystick-Drehung ausschalten",
          () => changeComfort(
            "turnMode",
            "off",
            "Joystick-Drehung: aus"
          ),
          null,
          F.Settings.comfort.turnMode === "off"
        );

        button(
          "Zurück",
          () => this.navigate("comfort")
        );
      }

      if (this.page === "vignette") {
        text(
          "Beim Laufen und Joystick-Drehen werden die\n" +
          "Ränder des Sichtfelds vorübergehend abgedunkelt.\n" +
          "Die Mitte bleibt frei; Kopfbewegungen lösen\n" +
          "keine Abdunklung aus."
        );

        button(
          "Aus: vollständiges Sichtfeld",
          () => changeComfort(
            "vignette",
            "off",
            "Komfortvignette: aus"
          ),
          null,
          F.Settings.comfort.vignette === "off"
        );

        button(
          "Leicht: größere freie Mitte",
          () => changeComfort(
            "vignette",
            "light",
            "Komfortvignette: leicht"
          ),
          null,
          F.Settings.comfort.vignette === "light"
        );

        button(
          "Stark: kleinere freie Mitte",
          () => changeComfort(
            "vignette",
            "strong",
            "Komfortvignette: stark"
          ),
          null,
          F.Settings.comfort.vignette === "strong"
        );

        text(
          "Kann Beschwerden mindern, verhindert sie aber nicht.\n" +
          "Bei Unwohlsein bitte die Brille absetzen."
        );

        button(
          "Zurück",
          () => this.navigate("comfort")
        );
      }

      /*
       * BEDIENHILFE
       */
      if (this.page === "help") {
        text([
          "Linker Joystick: laufen.",
          "Rechter Joystick: drehen, je nach Komforteinstellung.",
          "Grip: Modell in unmittelbarer Nähe greifen.",
          "Eine Hand bewegt und dreht, zwei Hände skalieren.",
          "Trigger kurz: Punkt oder Auswahl.",
          "Trigger halten + bewegen: Oberflächenstrich.",
          "Laserfarbe ist immer auch die Malfarbe.",
          "Strichstärke & Laser: erster Hauptmenübutton.",
          "Bewegung & Komfort: dritter Hauptmenübutton.",
          "Wände, Poster, Boden und Modelle sind bemalbar.",
          "A/X: gehaltenes oder anvisiertes Objekt zurücksetzen.",
          "B/Y: Menü öffnen oder schließen.",
          "Raumwahltafeln: Laser + Trigger.",
          "Nach dem Menü: beide Sticks kurz neutral stellen."
        ].join("\n"));

        button(
          "Zurück",
          () => this.navigate("home")
        );
      }

      /*
       * MODELLINFORMATIONEN
       */
      if (this.page === "info") {
        const value = model
          ? model.fkcInfo ||
            "Für dieses Modell sind noch keine " +
            "Zusatzinformationen hinterlegt."
          : "Vor dem Öffnen des Menüs ein Modell greifen " +
            "oder mit dem Laser darauf zeigen.";

        const lines = text(value, 13);

        if (lines.length > 13) {
          button(
            "Nächster Textabschnitt",
            () => {
              this.textOffset =
                this.textOffset + 13 < lines.length
                  ? this.textOffset + 13
                  : 0;

              this.message = "Textabschnitt gewechselt.";
            }
          );
        }

        button(
          "Zurück",
          () => this.navigate("home")
        );
      }

      /*
       * MODELLVARIANTEN
       */
      if (this.page === "variants") {
        const variants = model && model.fkcVariants;

        if (!variants || !variants.length) {
          text(
            "Für dieses Modell sind noch keine weiteren " +
            "Darstellungen hinterlegt."
          );
        } else {
          text(
            model.fkcPendingVisual
              ? "Eine neue Darstellung wird geladen …"
              : "Darstellung wählen:"
          );

          variants.slice(
            this.variantOffset,
            this.variantOffset + 5
          ).forEach(variant => {
            button(
              variant.title,
              () => F.switchVariant(model, variant.id),
              null,
              variant.id === model.fkcVariantId
            );
          });

          if (variants.length > 5) {
            button(
              "Weitere Darstellungen",
              () => {
                this.variantOffset =
                  this.variantOffset + 5 < variants.length
                    ? this.variantOffset + 5
                    : 0;

                this.message =
                  "Weitere Darstellungen angezeigt.";
              }
            );
          }
        }

        button(
          "Zurück",
          () => this.navigate("home")
        );
      }

      /*
       * BESTÄTIGUNG RAUMRESET
       */
      if (this.page === "confirm") {
        text(
          "Diesen Raum wirklich zurücksetzen?\n\n" +
          "Alle Modelle kehren in ihre Ausgangslage zurück. " +
          "Alle Zeichnungen auf Modellen, Postern und " +
          "Raumflächen werden gelöscht.\n\n" +
          "Die gewählten Modelldarstellungen und deine " +
          "Position bleiben erhalten."
        );

        button(
          "Abbrechen",
          () => this.navigate("home")
        );

        button(
          "Ja, Raum zurücksetzen",
          () => {
            F.resetRoomNow();
            this.navigate("home");
            this.notify("Raum wurde zurückgesetzt.");
          },
          "#f1c7c7"
        );
      }

      /*
       * BESTÄTIGUNGSZEILE UND VERSIONSHINWEIS
       */
      ctx.fillStyle = this.message
        ? "#dcefe2"
        : "#edf2ee";

      ctx.fillRect(35, 1078, 954, 53);

      ctx.fillStyle = "#244d35";
      ctx.font = "bold 25px Arial";

      ctx.fillText(
        this.message ||
          "Buttons mit Laser + Trigger auswählen",
        55,
        1113,
        910
      );

      ctx.fillStyle = "#607668";
      ctx.font = "23px Arial";

      ctx.fillText(
        "B/Y schließt · Eine Farbe pro Hand · Version Komfort-1",
        55,
        1160,
        914
      );

      this.texture.needsUpdate = true;
    }
  };

  /*
   * ============================================================
   * RAUMAUFBAU ERGÄNZEN
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
      ctx.font = index === 0
        ? "bold 56px Arial"
        : "30px Arial";

      ctx.fillText(
        line,
        512,
        95 + index * 72,
        940
      );
    });

    return canvas.toDataURL("image/png");
  }

  F.RoomBuilder.build = function (
    parent, config, rooms
  ) {
    const buildConfig = Object.assign({}, config);

    if (config.stations) {
      buildConfig.stations = config.stations.map(station => {
        const copy = Object.assign({}, station);

        const variants = Array.isArray(station.variants)
          ? station.variants.filter(
              item => item && item.model
            )
          : [];

        if (variants.length) {
          copy.model = variants[0].model;
        }

        return copy;
      });
    }

    const result = originalBuild.call(
      F.RoomBuilder,
      parent,
      buildConfig,
      rooms
    );

    markRoomSurfaces(parent);
    connectAllHands();
    connectNavigation();

    if (config.stations) {
      config.stations.forEach((station, index) => {
        const root = document.getElementById(
          config.id + "-model-" + (index + 1)
        );

        if (!root) return;

        root.fkcInfo = station.info || "";
        root.fkcModelSize = config.modelSize || 0.5;

        root.fkcVariantAlignment =
          station.variantAlignment || "shared";

        const variants = Array.isArray(station.variants)
          ? station.variants.filter(
              item => item && item.model
            )
          : [];

        if (variants.length) {
          root.fkcVariants = variants.map(
            (variant, number) => ({
              id: variant.id ||
                "variant-" + (number + 1),

              title: variant.title ||
                "Darstellung " + (number + 1),

              model: variant.model
            })
          );

          root.fkcVariantId =
            root.fkcVariants[0].id;
        }
      });
    }

    /*
     * Bestehende Zuordnung der Bedienungstafel:
     * erste nicht bedienbare a-plane im Begrüßungsraum.
     */
    if (config.kind === "welcome") {
      const help = Array.from(
        parent.querySelectorAll("a-plane")
      ).find(
        el => !el.classList.contains("vr-action")
      );

      if (help) {
        help.setAttribute(
          "material",
          "src",
          boardImage([
            "Bedienung",
            "Links: laufen · Rechts: drehen",
            "Grip: greifen · 2 Hände: skalieren",
            "Trigger: Oberflächen bemalen",
            "Laserfarbe = Malfarbe",
            "B/Y: Menü · Größen & Komfort"
          ])
        );
      }
    }

    F.invalidateHits();

    return result;
  };

  /*
   * ============================================================
   * SPÄTE INITIALISIERUNG
   * ============================================================
   */
  const scene = F.getScene();

  scene.addEventListener(
    "componentinitialized",
    event => {
      const name = event.detail && event.detail.name;

      if (name === "geometry") {
        markPaintable(event.target);
        F.invalidateHits();
      }

      if (name === "fkc-controller") {
        connectHandTools(event.target);
      }

      if (name === "fkc-navigation") {
        connectNavigation();
      }
    }
  );

  scene.addEventListener("object3dset", event => {
    markPaintable(event.target);
    F.invalidateHits();
  });

  scene.addEventListener(
    "model-loaded",
    F.invalidateHits
  );

  scene.addEventListener(
    "model-error",
    F.invalidateHits
  );

  function finishInitialization() {
    connectAllHands();
    connectNavigation();

    const roomRoot =
      document.getElementById("room-root");

    if (roomRoot) {
      markRoomSurfaces(roomRoot);
    }
  }

  if (scene.hasLoaded) {
    finishInitialization();
  } else {
    scene.addEventListener(
      "loaded",
      finishInitialization,
      {once: true}
    );
  }
})(window.FKCVR);
