"use strict";

(function (F) {
  const app = {
    currentId: null,
    activeRoom: null,
    changing: false,

    init: function () {
      this.scene = F.getScene();
      this.rig = F.getRig();
      this.roomRoot = document.getElementById("room-root");

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
      document.getElementById("reset-all").onclick = F.resetAll;
      document.getElementById("clear-markers").onclick = F.clearMarkers;
    },

    bindDesktopPicking: function () {
      const canvas = this.scene.canvas;
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();

      let pointerStart = null;

      canvas.addEventListener("pointerdown", event => {
        if (event.button !== 0) return;

        pointerStart = {
          x: event.clientX,
          y: event.clientY
        };
      });

      canvas.addEventListener("pointerup", event => {
        if (!pointerStart || event.button !== 0) return;
        if (this.scene.is("vr-mode")) return;

        const distance = Math.hypot(
          event.clientX - pointerStart.x,
          event.clientY - pointerStart.y
        );

        pointerStart = null;

        // Ziehen zum Umschauen soll keine Raumwahl auslösen.
        if (distance > 6) return;

        const rect = canvas.getBoundingClientRect();

        mouse.set(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        this.scene.camera.updateWorldMatrix(true, false);

        raycaster.setFromCamera(mouse, this.scene.camera);
        raycaster.far = 30;

        const hit = F.findHit(raycaster, false);

        if (hit && hit.el.dataset.roomId) {
          this.changeRoom(hit.el.dataset.roomId);
        }
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

      try {
        F.beforeRoomChange();

        /*
         * Entfernt den bisherigen Raum.
         * Kamera, Controller und VR-Sitzung bleiben bestehen.
         */
        while (this.roomRoot.firstChild) {
          this.roomRoot.firstChild.remove();
        }

        this.activeRoom = null;

        this.activeRoom = F.RoomBuilder.build(
          this.roomRoot,
          config,
          F.rooms
        );

        this.currentId = id;
        this.positionAtSpawn(this.activeRoom.spawn);

        document.getElementById("current-room").textContent =
          config.title;

        document.getElementById("room-select").value = id;

        if (!window.isSecureContext) {
          F.setStatus(
            config.title + " geöffnet. WebXR benötigt HTTPS oder localhost."
          );
        } else {
          F.setStatus(
            config.title +
            " geöffnet. Raumwahl per Laser + Trigger oder Auswahlliste."
          );
        }

        document.title = "FKC-VR – " + config.title;
      } catch (error) {
        console.error("Raumwechsel fehlgeschlagen:", error);

        F.setStatus(
          "Raum konnte nicht aufgebaut werden. Browserkonsole prüfen."
        );
      } finally {
        this.changing = false;
      }
    },

    positionAtSpawn: function (spawn) {
      const rig = this.rig.object3D;
      const camera = this.scene.camera;
      const localHead = new THREE.Vector3();

      /*
       * Reale Kopfverschiebung relativ zum Rig erhalten.
       * Nach dem Raumwechsel liegt die Kopfposition in X/Z
       * am vorgesehenen Startpunkt.
       */
      if (camera) {
        rig.updateWorldMatrix(true, true);
        camera.getWorldPosition(localHead);
        rig.worldToLocal(localHead);
      }

      rig.rotation.set(0, 0, 0);

      rig.position.set(
        spawn.x - localHead.x,
        0,
        spawn.z - localHead.z
      );

      rig.updateWorldMatrix(true, true);

      /*
       * Desktopblick zurücksetzen.
       * In VR bleibt die reale Kopfhaltung maßgeblich.
       */
      if (!this.scene.is("vr-mode")) {
        const cameraEl = document.getElementById("camera");
        const look = cameraEl.components["look-controls"];

        if (look) {
          if (look.yawObject) look.yawObject.rotation.y = 0;
          if (look.pitchObject) look.pitchObject.rotation.x = 0;
        }

        cameraEl.object3D.rotation.set(0, 0, 0);
      }
    }
  };

  F.app = app;

  const scene = F.getScene();

  if (scene.hasLoaded) {
    app.init();
  } else {
    scene.addEventListener("loaded", () => app.init(), {once: true});
  }
})(window.FKCVR);
