"use strict";

(function (F) {
  /*
   * ============================================================
   * APP — XR-FIX-2 + LASER-FIX-1
   * ============================================================
   *
   * Vollständiger Ersatz für js/app.js.
   *
   * Bestehende Navigation, Raumwechsel und AR-Unterstützung
   * bleiben erhalten.
   *
   * LASER-FIX-1:
   * - Den von vr-tools.js eingesetzten Laserzylinder auch nach
   *   Installation des XR-Controllerablaufs aktualisieren.
   * - Trefferpunkt leicht vor der Oberfläche darstellen.
   * - Trefferpunkt auf dem VR-Menü nach dessen Fläche zeichnen.
   * - tools.line, tools.hit und tools.source erhalten.
   *
   * Keine Änderungen am Raumaufbau oder an Demonstrationen.
   */

  const T = AFRAME.THREE;

  function immersive(scene) {
    if (!scene) return false;

    const xr = scene.renderer && scene.renderer.xr;

    return (
      scene.is("vr-mode") ||
      scene.is("ar-mode") ||
      !!(xr && xr.getSession())
    );
  }

  /*
   * Kopfpose in den lokalen Koordinaten des Rigs.
   *
   * In XR bevorzugen wir die WebXR-Viewerpose:
   * Sie enthält keinen bereits angewendeten Rig-Versatz.
   *
   * Als Rückfall dient die Kameraentity, ausdrücklich nicht
   * scene.camera, deren Rolle sich im XR-Rendering ändern kann.
   */
  function readLocalHead(scene, rig, position, quaternion) {
    const xr = scene.renderer && scene.renderer.xr;

    if (immersive(scene) && xr) {
      const referenceSpace = typeof xr.getReferenceSpace === "function"
        ? xr.getReferenceSpace()
        : null;

      let frame = scene.frame;

      if (!frame || typeof frame.getViewerPose !== "function") {
        frame = typeof xr.getFrame === "function"
          ? xr.getFrame()
          : null;
      }

      if (frame && referenceSpace) {
        try {
          const pose = frame.getViewerPose(referenceSpace);

          if (pose) {
            const p = pose.transform.position;
            const q = pose.transform.orientation;

            position.set(p.x, p.y, p.z);
            quaternion.set(q.x, q.y, q.z, q.w);

            if (
              Number.isFinite(position.x) &&
              Number.isFinite(position.y) &&
              Number.isFinite(position.z)
            ) {
              return true;
            }
          }
        } catch (error) {
          /*
           * Außerhalb eines gültigen XR-Frames ist das Lesen
           * der Viewerpose nicht immer erlaubt.
           */
        }
      }
    }

    const cameraEl = document.getElementById("camera");

    position.set(0, 1.6, 0);
    quaternion.identity();

    if (!cameraEl || !cameraEl.object3D) return false;

    const cameraObject = cameraEl.object3D;
    const rigQuaternion = new T.Quaternion();

    rig.updateWorldMatrix(true, true);
    cameraObject.updateWorldMatrix(true, false);

    cameraObject.getWorldPosition(position);
    rig.worldToLocal(position);

    cameraObject.getWorldQuaternion(quaternion);
    rig.getWorldQuaternion(rigQuaternion);

    quaternion.premultiply(rigQuaternion.invert());

    return false;
  }

  /*
   * Gemeinsame, zuverlässige Kopfkoordinaten für Navigation.
   */
  function readWorldHead(scene, rig, position, quaternion) {
    readLocalHead(scene, rig, position, quaternion);

    rig.updateWorldMatrix(true, false);

    position.applyMatrix4(rig.matrixWorld);

    const rigQuaternion = new T.Quaternion();
    rig.getWorldQuaternion(rigQuaternion);

    quaternion.premultiply(rigQuaternion);
  }

  /*
   * Navigation auf der vorhandenen Komponenteninstanz korrigieren.
   * Keine erneute Registrierung der ursprünglichen Komponente.
   */
  function installNavigationFix(scene, rigEl) {
    const navigation = rigEl.components["fkc-navigation"];

    if (!navigation || navigation.fkcXRFixInstalled) return;

    navigation.fkcXRFixInstalled = true;

    const oldTick = navigation.tick;
    const headPosition = new T.Vector3();
    const headQuaternion = new T.Quaternion();
    const worldStep = new T.Vector3();
    const localStep = new T.Vector3();
    const worldRigPosition = new T.Vector3();
    const targetRigPosition = new T.Vector3();

    function translateWorld(object, displacement) {
      object.updateWorldMatrix(true, false);
      object.getWorldPosition(worldRigPosition);

      targetRigPosition.copy(worldRigPosition).add(displacement);

      if (object.parent) {
        object.parent.updateWorldMatrix(true, false);
        object.parent.worldToLocal(targetRigPosition);
      }

      object.position.copy(targetRigPosition);
      object.updateWorldMatrix(true, true);
    }

    navigation.rotateAroundHead = function (angle) {
      const rig = this.el.object3D;

      readWorldHead(
        this.el.sceneEl,
        rig,
        headPosition,
        headQuaternion
      );

      /*
       * Das Projekt verwendet einen Rig direkt unter der Szene.
       * Drehung erfolgt um die tatsächliche Kopfposition,
       * nicht um den Ursprung des Rigs.
       */
      rig.updateWorldMatrix(true, true);
      rig.getWorldPosition(worldRigPosition);

      targetRigPosition.copy(worldRigPosition)
        .sub(headPosition)
        .applyAxisAngle(this.axis, angle)
        .add(headPosition);

      if (rig.parent) {
        rig.parent.updateWorldMatrix(true, false);
        rig.parent.worldToLocal(targetRigPosition);
      }

      rig.position.copy(targetRigPosition);
      rig.rotation.y += angle;
      rig.updateWorldMatrix(true, true);
    };

    navigation.move = function (x, y, speed, delta) {
      if (x === 0 && y === 0) return;

      const currentScene = this.el.sceneEl;
      const rig = this.el.object3D;

      readWorldHead(
        currentScene,
        rig,
        headPosition,
        headQuaternion
      );

      this.forward.set(0, 0, -1)
        .applyQuaternion(headQuaternion);

      this.forward.y = 0;

      if (this.forward.lengthSq() < 0.0001) {
        this.forward.set(0, 0, -1);
      } else {
        this.forward.normalize();
      }

      this.right.set(-this.forward.z, 0, this.forward.x);

      this.movement.copy(this.forward)
        .multiplyScalar(-y)
        .addScaledVector(this.right, x);

      if (this.movement.lengthSq() > 1) {
        this.movement.normalize();
      }

      const seconds = Math.min((delta || 0) / 1000, 0.05);

      this.movement.multiplyScalar(speed * seconds);

      /*
       * Die bestehenden begehbaren Flächen bleiben zuständig.
       * Auch in AR werden die virtuellen Raumgrenzen respektiert.
       */
      worldStep.set(0, 0, 0);

      if (F.validFloor(
        headPosition.x + this.movement.x,
        headPosition.z
      )) {
        worldStep.x = this.movement.x;
        headPosition.x += this.movement.x;
      }

      if (F.validFloor(
        headPosition.x,
        headPosition.z + this.movement.z
      )) {
        worldStep.z = this.movement.z;
      }

      if (worldStep.lengthSq() > 0) {
        localStep.copy(worldStep);
        translateWorld(rig, localStep);
      }
    };

    navigation.tick = function (time, delta) {
      /*
       * PC- und bisheriger VR-Ablauf bleiben erhalten.
       * Für AR ohne vr-mode ergänzen wir denselben Joystickablauf.
       */
      if (!immersive(scene) || scene.is("vr-mode")) {
        oldTick.call(this, time, delta);
        return;
      }

      if (F.Menu && F.Menu.opened) return;

      const seconds = Math.min((delta || 0) / 1000, 0.05);

      const left = F.readStick(F.getSource(scene, "left"));
      const right = F.readStick(F.getSource(scene, "right"));

      const turn = this.applyDeadzone(right.x);

      if (turn) {
        this.rotateAroundHead(
          -turn * T.MathUtils.degToRad(this.data.turnSpeed) * seconds
        );
      }

      this.move(
        this.applyDeadzone(left.x),
        this.applyDeadzone(left.y),
        this.data.speed,
        delta
      );
    };
  }

  /*
   * ============================================================
   * LASER-FIX-1 — SICHTBARE LASERGEOMETRIE
   * ============================================================
   *
   * vr-tools.js ersetzt tools.line durch einen Einheitszylinder.
   * Der XR-Controllerablauf unten ersetzt dessen tick-Wrapper.
   *
   * Deshalb aktualisieren wir die sichtbare Geometrie hier
   * ausdrücklich nach dem Controllerablauf.
   *
   * Die alte BufferGeometry wird weiterhin aktualisiert.
   * Sie ist zugleich der Rückfall, falls noch kein breiter
   * Laser installiert wurde.
   */
  function createLaserUpdater() {
    const axis = new T.Vector3(0, 1, 0);
    const start = new T.Vector3();
    const end = new T.Vector3();
    const direction = new T.Vector3();
    const parentScale = new T.Vector3();

    return function (tools) {
      const line = tools.line;

      if (!line || !line.visible) return;

      /*
       * Nur den von vr-tools.js eingesetzten Zylinder behandeln.
       * Die ursprüngliche THREE.Line benötigt keine Mesh-Skalierung.
       */
      if (
        !line.isMesh ||
        !line.geometry ||
        line.geometry.type !== "CylinderGeometry"
      ) return;

      start.copy(tools.origin);
      end.copy(tools.endpoint);

      /*
       * Ursprung und Endpunkt liegen in Weltkoordinaten.
       * Das Laser-Mesh liegt unter seiner eigenen Szenenentity.
       */
      const parent = line.parent;

      if (parent) {
        parent.updateWorldMatrix(true, false);
        parent.worldToLocal(start);
        parent.worldToLocal(end);
      }

      direction.copy(end).sub(start);
      const length = direction.length();

      if (!Number.isFinite(length) || length < 0.0001) {
        line.visible = false;
        return;
      }

      direction.multiplyScalar(1 / length);

      line.position.copy(start).add(end).multiplyScalar(0.5);
      line.quaternion.setFromUnitVectors(axis, direction);

      const configuredDiameter = F.Settings
        ? Number(F.Settings.laserDiameter)
        : 0.003;

      const diameter =
        Number.isFinite(configuredDiameter) && configuredDiameter > 0
          ? configuredDiameter
          : 0.003;

      /*
       * Im bestehenden Projekt ist die Laserentity unskaliert.
       * Eine gleichmäßige Elternskalierung wird ebenfalls
       * berücksichtigt, damit die Breite in Metern erhalten bleibt.
       */
      let scaleFactor = 1;

      if (parent) {
        parent.getWorldScale(parentScale);
        scaleFactor = Math.max(0.0001, Math.abs(parentScale.x));
      }

      const radius = diameter / (2 * scaleFactor);

      line.scale.set(radius, length, radius);

      /*
       * Der transparente Laser soll nicht selbst die Tiefe
       * anderer transparenter Objekte blockieren.
       * Der normale Tiefentest gegen die Raumgeometrie bleibt an.
       */
      if (line.material) {
        line.material.depthWrite = false;
      }

      line.frustumCulled = false;
      line.updateWorldMatrix(true, false);
    };
  }

  /*
   * ============================================================
   * LASER-FIX-1 — TREFFERPUNKT
   * ============================================================
   *
   * Trefferberechnung und Laserendpunkt bleiben unverändert.
   * Nur die sichtbare Kugel erhält einen Oberflächenversatz.
   *
   * Das Menü verwendet renderOrder 100 und depthTest false.
   * Ein Menütrefferpunkt wird deshalb danach gezeichnet.
   * Auf normalen Raumflächen bleibt der Tiefentest aktiv.
   */
  function installPointerFix(tools) {
    if (tools.fkcPointerFixInstalled) return;

    tools.fkcPointerFixInstalled = true;

    const previousUpdateHit = tools.updateHit;
    const pointerPosition = new T.Vector3();

    tools.updateHit = function () {
      previousUpdateHit.call(this);

      const pointer = this.pointer;
      const hit = this.hit;

      if (!pointer || !pointer.object3D || !hit) return;

      pointerPosition.copy(hit.point);

      if (hit.normal) {
        pointerPosition.addScaledVector(hit.normal, 0.012);
      } else {
        pointerPosition.addScaledVector(this.direction, -0.012);
      }

      const parent = pointer.object3D.parent;

      if (parent) {
        parent.updateWorldMatrix(true, false);
        parent.worldToLocal(pointerPosition);
      }

      pointer.object3D.position.copy(pointerPosition);

      const mesh = pointer.getObject3D("mesh");

      if (mesh) {
        const menuHit = !!(
          F.Menu &&
          F.Menu.opened &&
          hit.type === "action" &&
          hit.el &&
          hit.el.dataset.fkcMenu === "true"
        );

        mesh.frustumCulled = false;
        mesh.renderOrder = menuHit ? 110 : 1;

        const materials = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];

        materials.forEach(material => {
          if (!material) return;

          material.depthTest = !menuHit;
          material.depthWrite = false;
          material.toneMapped = false;
        });
      }

      pointer.object3D.updateWorldMatrix(true, false);
    };
  }

  /*
   * Die vorhandenen Controllerfunktionen weiterverwenden.
   * Nur die VR-exklusiven Einstiegspunkte ersetzen.
   */
  function installControllerFix(scene) {
    scene.querySelectorAll("[fkc-controller]").forEach(hand => {
      const tools = hand.components["fkc-controller"];

      if (!tools || tools.fkcXRFixInstalled) return;

      tools.fkcXRFixInstalled = true;

      const updateVisibleLaser = createLaserUpdater();

      installPointerFix(tools);

      tools.activate = function () {
        if (!immersive(this.el.sceneEl)) return;

        this.drawingAllowed = false;
        this.stroke = null;

        this.updateRay();
        this.updateHit();

        if (!this.hit) return;

        if (this.hit.type === "action") {
          if (this.hit.el.dataset.fkcMenu === "true") {
            if (F.Menu) F.Menu.click(this.hit);
          } else if (!(F.Menu && F.Menu.opened)) {
            const roomId = this.hit.el.dataset.roomId;

            if (roomId && F.app) {
              F.app.changeRoom(roomId);
            }
          }

          return;
        }

        if (F.Menu && F.Menu.opened) return;

        const grabber = this.el.components["fkc-grabber"];

        if (grabber && grabber.grabbed) return;

        this.drawingAllowed = true;
        this.el.sceneEl.lastSelectedTarget = this.hit.el;

        if (this.hit.type === "model") {
          F.selectModel(this.hit.el);
        }

        this.sampleDrawing();
      };

      tools.tick = function () {
        const currentScene = this.el.sceneEl;

        if (!immersive(currentScene)) {
          this.hide();
          return;
        }

        this.updateRay();

        if (!this.source) {
          this.disconnect();
          return;
        }

        this.pollButtons();

        /*
         * Eine Tastenaktion kann den Raum oder das Menü
         * verändert haben. Treffer deshalb neu bestimmen.
         */
        this.updateRay();
        this.updateHit();

        const grabber = this.el.components["fkc-grabber"];

        if (grabber && grabber.grabbed) {
          this.stroke = null;
          this.drawingAllowed = false;
          this.hide();
          return;
        }

        if (this.states.trigger && !(F.Menu && F.Menu.opened)) {
          this.sampleDrawing();
        }

        const color = F.Settings
          ? F.Settings.lasers[this.data.hand]
          : (this.data.hand === "left" ? "#32d8df" : "#ff9d38");

        this.material.color.set(color);
        this.line.visible = true;

        this.positions.set([
          this.origin.x,
          this.origin.y,
          this.origin.z,
          this.endpoint.x,
          this.endpoint.y,
          this.endpoint.z
        ]);

        this.geometry.attributes.position.needsUpdate = true;

        /*
         * Entscheidend: Nicht nur die alte Liniengeometrie,
         * sondern auch den tatsächlich sichtbaren Zylinder
         * positionieren, ausrichten und skalieren.
         */
        updateVisibleLaser(this);
      };
    });
  }

  /*
   * Wenn beim XR-Eintritt noch keine Viewerpose vorliegt,
   * die Platzierung im nächsten gültigen XR-Frame abschließen.
   * Keine Timer und keine wiederholte dauerhafte Zentrierung.
   */
  AFRAME.registerComponent("fkc-spawn-sync", {
    tick: function () {
      if (F.app && typeof F.app.finishPendingSpawn === "function") {
        F.app.finishPendingSpawn();
      }
    }
  });

  const app = {
    currentId: null,
    activeRoom: null,
    changing: false,
    pendingSpawn: null,

    init: function () {
      this.scene = F.getScene();
      this.rig = F.getRig();
      this.roomRoot = document.getElementById("room-root");

      this.headPosition = new T.Vector3();
      this.headQuaternion = new T.Quaternion();
      this.headForward = new T.Vector3();
      this.rotatedHead = new T.Vector3();

      installNavigationFix(this.scene, this.rig);
      installControllerFix(this.scene);

      this.scene.setAttribute("fkc-spawn-sync", "");

      console.info(
        "FKC-VR LASER-FIX-1 geladen: " +
        "Laserzylinder und Trefferpunktdarstellung korrigiert."
      );

      /*
       * Auch beim ersten Wechsel vom PC in XR die reale
       * Kopfposition berücksichtigen.
       */
      this.scene.addEventListener("enter-vr", () => {
        if (this.activeRoom) {
          this.positionAtSpawn(this.activeRoom.spawn);
        }
      });

      this.scene.addEventListener("exit-vr", () => {
        this.pendingSpawn = null;
      });

      this.bindInterface();
      this.bindDesktopPicking();
      this.changeRoom("welcome");
    },

    getConfig: function (id) {
      if (id === "welcome") return F.welcomeRoom;
      return F.rooms.find(room => room.id === id);
    },

    bindInterface: function () {
      const select = document.getElementById("room-select");

      F.rooms.forEach(room => {
        const option = document.createElement("option");
        option.value = room.id;
        option.textContent = room.title;
        select.appendChild(option);
      });

      document.getElementById("enter-room").onclick = () => {
        this.changeRoom(select.value);
      };

      document.getElementById("home").onclick = () => {
        this.changeRoom("welcome");
      };

      document.getElementById("reset-last").onclick = F.resetLast;

      document.getElementById("open-menu").onclick = () => {
        F.Menu.toggle(null);
      };

      document.getElementById("clear-markers").onclick = () => {
        if (window.confirm("Alle Zeichnungen in diesem Raum löschen?")) {
          F.clearMarkers();
        }
      };
    },

    bindDesktopPicking: function () {
      const canvas = this.scene.canvas;
      const raycaster = new T.Raycaster();
      const mouse = new T.Vector2();

      let pointerStart = null;

      canvas.addEventListener("pointerdown", event => {
        if (event.button !== 0 || immersive(this.scene)) return;

        pointerStart = {
          x: event.clientX,
          y: event.clientY
        };
      });

      canvas.addEventListener("pointerup", event => {
        if (!pointerStart || event.button !== 0) return;

        const start = pointerStart;
        pointerStart = null;

        if (immersive(this.scene)) return;

        if (Math.hypot(
          event.clientX - start.x,
          event.clientY - start.y
        ) > 6) return;

        const rect = canvas.getBoundingClientRect();

        mouse.set(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        this.scene.camera.updateWorldMatrix(true, false);
        raycaster.setFromCamera(mouse, this.scene.camera);
        raycaster.far = 30;

        const hit = F.findHit(raycaster, true);

        if (!hit) return;

        if (hit.type === "action") {
          if (hit.el.dataset.fkcMenu === "true") {
            F.Menu.click(hit);
          } else if (
            hit.el.dataset.roomId &&
            !(F.Menu && F.Menu.opened)
          ) {
            this.changeRoom(hit.el.dataset.roomId);
          }

          return;
        }

        if (F.Menu && F.Menu.opened) return;

        this.scene.lastSelectedTarget = hit.el;

        if (hit.type === "model") {
          F.selectModel(hit.el);
        }

        F.setStatus(
          hit.type === "model"
            ? "Ausgewählt: " + hit.el.dataset.title
            : "Zeichenfläche ausgewählt."
        );
      });

      canvas.addEventListener("pointercancel", () => {
        pointerStart = null;
      });
    },

    changeRoom: function (id) {
      if (this.changing || id === this.currentId) return;

      const config = this.getConfig(id);

      if (!config) {
        F.setStatus("Unbekannter Raum: " + id);
        return;
      }

      this.changing = true;
      this.pendingSpawn = null;

      try {
        F.beforeRoomChange();

        while (this.roomRoot.firstChild) {
          this.roomRoot.firstChild.remove();
        }

        this.activeRoom = null;

        const builtRoom = F.RoomBuilder.build(
          this.roomRoot,
          config,
          F.rooms
        );

        if (
          !builtRoom ||
          !builtRoom.spawn ||
          !Number.isFinite(builtRoom.spawn.x) ||
          !Number.isFinite(builtRoom.spawn.z)
        ) {
          throw new Error("Der Raum enthält keine gültige Startposition.");
        }

        this.activeRoom = builtRoom;
        this.currentId = id;

        this.positionAtSpawn(builtRoom.spawn);

        document.getElementById("current-room").textContent = config.title;
        document.getElementById("room-select").value = id;

        F.setStatus(
          window.isSecureContext
            ? config.title + " geöffnet. B/Y öffnet das Menü."
            : config.title + " geöffnet. WebXR benötigt HTTPS oder localhost."
        );

        document.title = "FKC-VR – " + config.title;
      } catch (error) {
        console.error("XR-FIX-2: Raumwechsel fehlgeschlagen:", error);

        /*
         * Erneuten Eintritt ermöglichen, wenn der Aufbau
         * oder die Platzierung fehlgeschlagen ist.
         */
        this.currentId = null;
        this.pendingSpawn = null;

        F.setStatus(
          "Raum konnte nicht aufgebaut werden. Browserkonsole prüfen."
        );
      } finally {
        this.changing = false;
      }
    },

    applySpawn: function (spawn, requireXRPose) {
      const rig = this.rig.object3D;
      const inXR = immersive(this.scene);

      if (!inXR) {
        const cameraEl = document.getElementById("camera");
        const look = cameraEl &&
          cameraEl.components["look-controls"];

        if (look) {
          if (look.yawObject) {
            look.yawObject.rotation.y = 0;
          }

          if (look.pitchObject) {
            look.pitchObject.rotation.x = 0;
          }
        }

        if (cameraEl) {
          cameraEl.object3D.rotation.set(0, 0, 0);
        }
      }

      const hasXRPose = readLocalHead(
        this.scene,
        rig,
        this.headPosition,
        this.headQuaternion
      );

      if (requireXRPose && !hasXRPose) return false;

      let yaw = 0;

      if (inXR) {
        this.headForward.set(0, 0, -1)
          .applyQuaternion(this.headQuaternion);

        /*
         * Horizontale Blickrichtung auf -Z ausrichten.
         * Bei nahezu senkrechtem Blick keine instabile
         * Winkelauswertung verwenden.
         */
        if (
          this.headForward.x * this.headForward.x +
          this.headForward.z * this.headForward.z > 0.0001
        ) {
          yaw = -Math.atan2(
            -this.headForward.x,
            -this.headForward.z
          );
        }
      }

      rig.rotation.set(0, yaw, 0);

      /*
       * Zuerst den lokalen Headsetversatz mit der NEUEN
       * Rig-Drehung transformieren, dann vom Spawn abziehen.
       */
      this.rotatedHead.copy(this.headPosition)
        .multiply(rig.scale)
        .applyQuaternion(rig.quaternion);

      rig.position.set(
        spawn.x - this.rotatedHead.x,
        0,
        spawn.z - this.rotatedHead.z
      );

      rig.updateWorldMatrix(true, true);

      if (F.invalidateHits) F.invalidateHits();

      return hasXRPose || !inXR;
    },

    positionAtSpawn: function (spawn) {
      if (
        !spawn ||
        !Number.isFinite(spawn.x) ||
        !Number.isFinite(spawn.z)
      ) {
        throw new Error("Ungültige Startposition.");
      }

      this.pendingSpawn = null;

      const completed = this.applySpawn(spawn, false);

      if (immersive(this.scene) && !completed) {
        /*
         * Sofortige Rückfallplatzierung ist bereits erfolgt.
         * Sobald Tracking verfügbar ist, einmal präzisieren.
         */
        this.pendingSpawn = {
          x: spawn.x,
          z: spawn.z,
          roomId: this.currentId,
          expires: performance.now() + 2000
        };
      }
    },

    finishPendingSpawn: function () {
      const pending = this.pendingSpawn;

      if (!pending) return;

      if (
        !immersive(this.scene) ||
        pending.roomId !== this.currentId ||
        performance.now() > pending.expires
      ) {
        this.pendingSpawn = null;
        return;
      }

      if (this.applySpawn(pending, true)) {
        this.pendingSpawn = null;
      }
    }
  };

  F.app = app;

  const scene = F.getScene();

  if (scene.hasLoaded) {
    app.init();
  } else {
    scene.addEventListener(
      "loaded",
      () => app.init(),
      {once: true}
    );
  }
})(window.FKCVR);
