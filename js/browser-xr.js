"use strict";

(function (F) {
  /*
   * ============================================================
   * BROWSER UND XR — BROWSER-XR-1
   * ============================================================
   *
   * Laden nach room-themes.js, aber vor app.js.
   *
   * Bestehende Dateien und Wrapper bleiben erhalten.
   * Voraussetzung für den Eintrittshinweis:
   * room-builder.js GALERIE-5.
   */

  const T = AFRAME.THREE;
  const scene = F.getScene();

  /*
   * ============================================================
   * GRÖSSERE VORLESUNGSBESCHREIBUNGEN
   * ============================================================
   */

  const descriptions = {
    "vorlesung-1":
      "Vermittelt grundlegende Begriffe und Einteilungen der " +
      "Festkörperchemie sowie die Unterschiede zwischen " +
      "kristallinen und amorphen Festkörpern.",

    "vorlesung-2":
      "Behandelt die Bindungsarten in Festkörpern: ionische, " +
      "kovalente und metallische Bindungen sowie " +
      "intermolekulare Wechselwirkungen.",

    "vorlesung-3":
      "Stellt klassische Festkörperreaktionen, Reaktionen in " +
      "Schmelzen und Solvothermalsynthesen sowie weitere " +
      "Verfahren zur Herstellung von Einkristallen, Keramiken, " +
      "amorphen Pulvern, dünnen Schichten und Fasern vor.",

    "vorlesung-4":
      "Führt von den sieben Kristallsystemen über die 14 " +
      "Bravaisgitter zu den 230 Raumgruppen und erklärt, " +
      "wie sich die Symmetrie von Kristallstrukturen " +
      "beschreiben lässt.",

    "vorlesung-5":
      "Erläutert die Erzeugung von Röntgenstrahlung, den Aufbau " +
      "eines Einkristalldiffraktometers und die Bestimmung von " +
      "Kristallstrukturen durch Röntgenbeugung am Einkristall.",

    "vorlesung-6":
      "Erklärt Metallstrukturen anhand von Kugelpackungen und " +
      "ihren Hohlräumen und behandelt physikalische " +
      "Eigenschaften, Polymorphie, Legierungen und " +
      "intermetallische Phasen.",

    "vorlesung-7":
      "Erklärt den Aufbau von Ionenkristallen, die Bedeutung " +
      "von Radienverhältnissen und Koordinationspolyedern " +
      "sowie wichtige Strukturtypen: NaCl, ZnS, CsCl, " +
      "CaF₂ und Perowskit.",

    "vorlesung-8":
      "Behandelt molekulare Kristalle, etwa aus S₈- und " +
      "P₄-Molekülen, intermolekulare Wechselwirkungen wie " +
      "van-der-Waals-Kräfte und Wasserstoffbrücken sowie den " +
      "Übergang zwischen ionischer und kovalenter Bindung " +
      "in Festkörpern."
  };

  const posterCache = new Map();

  /*
   * Hier wird ausschließlich an Leerzeichen umgebrochen.
   * Keine willkürliche Zeichenzerlegung.
   *
   * Lange Einzelwörter bleiben vollständig und werden bei
   * der Schriftgrößenanpassung berücksichtigt.
   */
  function wrap(ctx, value, width) {
    const lines = [];

    String(value || "")
      .replace(/\u00AD/g, "")
      .split("\n")
      .forEach(paragraph => {
        const words = paragraph.split(/\s+/).filter(Boolean);

        if (!words.length) {
          lines.push("");
          return;
        }

        let line = "";

        words.forEach(word => {
          const candidate = line ? line + " " + word : word;

          if (line && ctx.measureText(candidate).width > width) {
            lines.push(line);
            line = word;
          } else {
            line = candidate;
          }
        });

        if (line) lines.push(line);
      });

    return lines;
  }

  function fitted(ctx, value, x, y, width, height, options) {
    const o = Object.assign({
      size: 56,
      weight: "normal",
      lineHeight: 1.16,
      color: "#34332f"
    }, options || {});

    let size = o.size;
    let lines = [];

    while (size > 1) {
      ctx.font = o.weight + " " + size + "px Arial, sans-serif";
      lines = wrap(ctx, value, width);

      if (
        lines.every(line => ctx.measureText(line).width <= width) &&
        lines.length * size * o.lineHeight <= height
      ) break;

      size--;
    }

    const step = size * o.lineHeight;
    const top = y + height / 2 - (lines.length - 1) * step / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();

    ctx.font = o.weight + " " + size + "px Arial, sans-serif";
    ctx.fillStyle = o.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    lines.forEach((line, index) => {
      ctx.fillText(line, x + width / 2, top + index * step);
    });

    ctx.restore();
  }

  function lecturePoster(room) {
    const title = room.posterTitle || room.title;

    const description = room.posterDescription !== undefined
      ? room.posterDescription
      : descriptions[room.id];

    if (!description) return null;

    const key = JSON.stringify([title, description]);

    if (posterCache.has(key)) return posterCache.get(key);

    const canvas = document.createElement("canvas");
    canvas.width = 1536;
    canvas.height = 864;

    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = "#fffdf8";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "#c5a052";
    ctx.lineWidth = 8;
    ctx.strokeRect(30, 30, w - 60, h - 60);

    ctx.strokeStyle = "#e3ce99";
    ctx.lineWidth = 3;
    ctx.strokeRect(46, 46, w - 92, h - 92);

    const match = title.match(
      /^(\d+\.\s*Vorlesung)\s*[-–]\s*(.+)$/i
    );

    if (match) {
      fitted(
        ctx, match[1],
        105, 66, w - 210, 88,
        {size: 70, weight: "bold", color: "#222222"}
      );

      fitted(
        ctx, match[2],
        105, 158, w - 210, 164,
        {size: 64, weight: "bold", color: "#222222"}
      );
    } else {
      fitted(
        ctx, title,
        105, 76, w - 210, 246,
        {size: 70, weight: "bold", color: "#222222"}
      );
    }

    ctx.strokeStyle = "#c5a052";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(310, 342);
    ctx.lineTo(w - 310, 342);
    ctx.stroke();

    /*
     * Mehr nutzbare Fläche als im bisherigen Poster:
     * Beschreibung beginnt früher und bekommt mehr Höhe.
     */
    fitted(
      ctx, description,
      110, 364, w - 220, 426,
      {
        size: 56,
        weight: "normal",
        lineHeight: 1.16,
        color: "#454035"
      }
    );

    const src = canvas.toDataURL("image/png");
    posterCache.set(key, src);

    return src;
  }

  function updateWelcomePosters(parent, config) {
    if (config.kind !== "welcome") return;

    parent.querySelectorAll(".vr-action[data-room-id]")
      .forEach(screen => {
        const room = F.rooms.find(
          item => item.id === screen.dataset.roomId
        );

        if (!room) return;

        const src = lecturePoster(room);

        if (src) {
          screen.setAttribute("material", "src", src);
        }
      });
  }

  /*
   * ============================================================
   * DEZENTER EINTRITTSHINWEIS
   * ============================================================
   */

  function updateEntryHint(component) {
    if (
      !component ||
      component.fkcPlainHintInstalled ||
      !component.mesh
    ) return;

    component.fkcPlainHintInstalled = true;

    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 192;

    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    /*
     * Nur der Hintergrund ist halbtransparent.
     * Die weiße Schrift bleibt vollständig deckend.
     */
    ctx.fillStyle = "rgba(35, 39, 43, 0.65)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 68px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
      "Mit Trigger betreten",
      canvas.width / 2,
      canvas.height / 2
    );

    const texture = new T.CanvasTexture(canvas);

    if ("colorSpace" in texture && T.SRGBColorSpace) {
      texture.colorSpace = T.SRGBColorSpace;
    } else if (T.sRGBEncoding) {
      texture.encoding = T.sRGBEncoding;
    }

    if (component.texture) component.texture.dispose();

    component.texture = texture;
    component.material.map = texture;
    component.material.transparent = true;
    component.material.opacity = 1;
    component.material.depthWrite = false;
    component.material.needsUpdate = true;
  }

  scene.addEventListener("componentinitialized", event => {
    if (
      event.detail &&
      event.detail.name === "fkc-gallery-entry-hint"
    ) {
      updateEntryHint(
        event.target.components["fkc-gallery-entry-hint"]
      );
    }
  });

  /*
   * ============================================================
   * VORHANDENES MENÜ ALS BROWSER-SCHALTFLÄCHEN
   * ============================================================
   */

  function immersive() {
    return scene.is("vr-mode") || scene.is("ar-mode");
  }

  function syncDesktopMenu() {
    const section = document.getElementById("desktop-menu");
    const list = document.getElementById("desktop-menu-buttons");
    const message = document.getElementById("desktop-menu-message");
    const preview = document.getElementById("desktop-menu-preview");
    const toggle = document.getElementById("open-menu");

    if (!section || !list || !F.Menu) return;

    const show = F.Menu.opened && !immersive();

    section.hidden = !show;

    if (toggle) {
      toggle.setAttribute("aria-expanded", String(show));
      toggle.textContent = show
        ? "Menü schließen"
        : "Menü & Einstellungen";
    }

    if (!show) return;

    /*
     * Im Browser ist das DOM-Menü sichtbar.
     * Die zusätzliche räumliche Menüfläche wird ausgeblendet.
     *
     * opened bleibt bestehen: vorhandene Aktionen,
     * Demo-Pausen und Navigationssperren bleiben konsistent.
     */
    if (F.Menu.root) {
      F.Menu.root.object3D.visible = false;
    }

    message.textContent = F.Menu.message || "";

    list.replaceChildren();

    const actions = F.Menu.buttons.slice();

    actions.forEach(item => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = item.label;

      button.addEventListener("click", () => {
        if (!F.Menu.opened || immersive()) return;

        F.Menu.cancelClick();

        try {
          item.action();
        } catch (error) {
          console.error("Browser-Menüaktion fehlgeschlagen:", error);
          F.Menu.message = "Aktion fehlgeschlagen.";
        }

        if (F.Menu.opened) F.Menu.render();
        else syncDesktopMenu();
      });

      list.appendChild(button);
    });

    if (preview && F.Menu.canvas) {
      preview.src = F.Menu.canvas.toDataURL("image/png");
    }
  }

  const previousRender = F.Menu.render;

  F.Menu.render = function () {
    previousRender.call(this);
    syncDesktopMenu();
  };

  const previousClose = F.Menu.close;

  F.Menu.close = function () {
    previousClose.call(this);
    syncDesktopMenu();
  };

  /*
   * ============================================================
   * MODELLWERKZEUGE IM BROWSER
   * ============================================================
   */

  function selectedModel() {
    const root = scene.lastSelectedModel;

    if (
      !root ||
      !root.isConnected ||
      !root.modelReady ||
      !root.classList.contains("interactable")
    ) return null;

    return root;
  }

  function modelBody(root) {
    const body = root && root.querySelector(".manip-body");
    return body ? body.object3D : null;
  }

  function refreshModelControls() {
    const root = selectedModel();
    const body = modelBody(root);

    const controls = document.getElementById("desktop-model-controls");
    const name = document.getElementById("desktop-model-name");
    const slider = document.getElementById("model-scale");
    const value = document.getElementById("model-scale-value");
    const info = document.getElementById("model-info");

    if (!controls || !name || !slider || !value) return;

    controls.disabled = !body;
    if (info) info.disabled = !root;

    name.textContent = root
      ? "Ausgewählt: " + (root.dataset.title || "Modell")
      : "Klicke im Raum auf ein Modell.";

    if (!body) {
      slider.value = "0";
      value.textContent = "100 %";
      return;
    }

    const scale = Math.max(0.0001, Math.abs(body.scale.x));

    /*
     * Logarithmischer Regler:
     * gleichmäßige Bedienung von 10 % bis 1000 %.
     */
    slider.value = String(
      Math.max(
        Number(slider.min),
        Math.min(Number(slider.max), Math.log(scale))
      )
    );

    value.textContent = Math.round(scale * 100) + " %";
  }

  function rotateModel(axis, degrees) {
    if (immersive()) return;

    const root = selectedModel();
    const body = modelBody(root);

    if (!body) return;

    F.releaseModel(root);

    const rotation = new T.Quaternion().setFromAxisAngle(
      axis,
      T.MathUtils.degToRad(degrees)
    );

    body.quaternion.premultiply(rotation);
    root.object3D.updateWorldMatrix(true, true);

    refreshModelControls();
  }

  function scaleModel(scale) {
    if (immersive()) return;

    const root = selectedModel();
    const body = modelBody(root);

    if (!body) return;

    F.releaseModel(root);

    body.scale.setScalar(Math.max(0.1, Math.min(10, scale)));
    root.object3D.updateWorldMatrix(true, true);

    refreshModelControls();
  }

  function multiplyScale(factor) {
    const body = modelBody(selectedModel());
    if (body) scaleModel(body.scale.x * factor);
  }

  function bindButton(id, action) {
    const button = document.getElementById(id);
    if (button) button.addEventListener("click", action);
  }

  function bindDesktopControls() {
    bindButton("model-turn-left", () => {
      rotateModel(new T.Vector3(0, 1, 0), 15);
    });

    bindButton("model-turn-right", () => {
      rotateModel(new T.Vector3(0, 1, 0), -15);
    });

    bindButton("model-tilt-up", () => {
      rotateModel(new T.Vector3(1, 0, 0), -15);
    });

    bindButton("model-tilt-down", () => {
      rotateModel(new T.Vector3(1, 0, 0), 15);
    });

    bindButton("model-smaller", () => multiplyScale(1 / 1.15));
    bindButton("model-larger", () => multiplyScale(1.15));

    const slider = document.getElementById("model-scale");

    if (slider) {
      slider.addEventListener("input", () => {
        scaleModel(Math.exp(Number(slider.value)));
      });
    }

    bindButton("model-info", () => {
      const root = selectedModel();
      if (!root) return;

      scene.lastSelectedTarget = root;

      if (!F.Menu.opened) F.Menu.open(null);

      F.Menu.target = root;
      F.Menu.navigate("info");
    });

    bindButton("desktop-menu-close", () => F.Menu.close());

    /*
     * Vorhandene Auswahl und Resetfunktionen bleiben zuständig.
     * Die Anzeige wird anschließend automatisch aktualisiert.
     */
    refreshModelControls();
  }

  /*
   * ============================================================
   * AR: UMGEBUNG AUSBLENDEN, LEHRINHALTE ERHALTEN
   * ============================================================
   */

  const AR = {
    active: false,
    hiddenOriginals: new Map(),
    hiddenThemeMeshes: new Map(),
    background: null,
    clearAlpha: 1,

    begin: function () {
      if (this.active) return;

      this.active = true;

      const background = scene.getAttribute("background");

      this.background = background
        ? Object.assign({}, background)
        : null;

      if (scene.renderer) {
        this.clearAlpha = scene.renderer.getClearAlpha();
        scene.renderer.setClearAlpha(0);
      }

      if (F.Comfort) F.Comfort.reset();

      this.update();
    },

    update: function () {
      if (!this.active) return;

      /*
       * Der Hintergrund muss auch dann transparent bleiben,
       * wenn ein Raumdesign seine Hintergrundfarbe aktualisiert.
       */
      scene.object3D.background = null;

      if (scene.renderer) scene.renderer.setClearAlpha(0);
      if (F.Comfort) F.Comfort.reset();

      const state = F.RoomThemes && F.RoomThemes.state;

      if (!state) return;

      /*
       * room-themes.js hat die ursprüngliche Raumhülle bereits
       * von Lehrinhalten getrennt.
       *
       * Echte Lichtentities bleiben aktiv.
       */
      state.originals.forEach(entry => {
        const el = entry.el;

        if (!el || !el.isConnected || el.hasAttribute("light")) return;

        if (!this.hiddenOriginals.has(el)) {
          this.hiddenOriginals.set(el, el.object3D.visible);
        }

        el.object3D.visible = false;
      });

      /*
       * Die neue Designumgebung enthält sowohl Geometrie
       * als auch Lehrbeleuchtung.
       *
       * Nur Geometrie ausblenden, nicht die gesamte Gruppe:
       * so bleibt ihre Beleuchtung für die Modelle erhalten.
       */
      if (state.layer && state.layer.isConnected) {
        state.layer.object3D.traverse(object => {
          if (!object.isMesh && !object.isLine && !object.isPoints) return;

          if (!this.hiddenThemeMeshes.has(object)) {
            this.hiddenThemeMeshes.set(object, object.visible);
          }

          object.visible = false;
        });
      }
    },

    end: function () {
      if (!this.active) return;

      this.active = false;

      const state = F.RoomThemes && F.RoomThemes.state;

      this.hiddenOriginals.forEach((visible, el) => {
        if (!el.isConnected) return;

        const entry = state && state.originals.find(
          item => item.el === el
        );

        /*
         * Den aktuellen Designzustand wiederherstellen,
         * nicht einen veralteten Zustand vor einem Designwechsel.
         */
        el.object3D.visible = entry
          ? state.theme === "original" && entry.visible
          : visible;
      });

      this.hiddenThemeMeshes.forEach((visible, object) => {
        object.visible = visible;
      });

      this.hiddenOriginals.clear();
      this.hiddenThemeMeshes.clear();

      if (scene.renderer) {
        scene.renderer.setClearAlpha(this.clearAlpha);
      }

      const currentBackground = scene.getAttribute("background");
      const restore = currentBackground || this.background;

      if (restore) {
        scene.setAttribute("background", Object.assign({}, restore));

        /*
         * Hintergrund erneut anwenden, auch wenn sich der
         * Attributwert während AR nicht geändert hat.
         */
        const component = scene.components.background;

        if (component && typeof component.update === "function") {
          component.update({});
        }
      }

      if (F.invalidateHits) F.invalidateHits();
    }
  };

  /*
   * ============================================================
   * AUSDRÜCKLICHER VR-/AR-START
   * ============================================================
   */

  const support = {
    vr: false,
    ar: false,
    checked: false,
    starting: false
  };

  function availabilityMessage(message) {
    const label = document.getElementById("xr-availability");
    if (label) label.textContent = message;
  }

  function refreshStartButtons() {
    const ready = !!(
      scene.hasLoaded &&
      scene.renderer &&
      !support.starting &&
      !immersive()
    );

    const vr = document.getElementById("start-vr");
    const ar = document.getElementById("start-ar");

    if (vr) vr.disabled = !ready || !support.vr;
    if (ar) ar.disabled = !ready || !support.ar;
  }

  async function checkSupport() {
    support.vr = false;
    support.ar = false;

    if (!window.isSecureContext) {
      availabilityMessage(
        "VR und AR benötigen HTTPS oder localhost. " +
        "Die Browseransicht bleibt nutzbar."
      );

      support.checked = true;
      refreshStartButtons();
      return;
    }

    if (!navigator.xr) {
      availabilityMessage(
        "Dieser Browser bietet kein WebXR an. " +
        "Du kannst die Räume mit Maus und Tastatur erkunden."
      );

      support.checked = true;
      refreshStartButtons();
      return;
    }

    try {
      const results = await Promise.allSettled([
        navigator.xr.isSessionSupported("immersive-vr"),
        navigator.xr.isSessionSupported("immersive-ar")
      ]);

      support.vr =
        results[0].status === "fulfilled" && results[0].value === true;

      support.ar =
        results[1].status === "fulfilled" && results[1].value === true;

      results.forEach(result => {
        if (result.status === "rejected") {
          console.warn("WebXR-Unterstützungstest:", result.reason);
        }
      });

      const vrText = support.vr ? "VR verfügbar" : "VR nicht verfügbar";
      const arText = support.ar ? "AR verfügbar" : "AR nicht verfügbar";

      availabilityMessage(
        vrText + " · " + arText +
        ". Ohne Brille bleibt die Browseransicht nutzbar."
      );
    } catch (error) {
      console.error("WebXR-Unterstützung konnte nicht geprüft werden:", error);

      availabilityMessage(
        "VR-/AR-Unterstützung konnte nicht geprüft werden. " +
        "Die Browseransicht bleibt nutzbar."
      );
    }

    support.checked = true;
    refreshStartButtons();
  }

  async function startXR(useAR) {
    if (
      support.starting ||
      !scene.hasLoaded ||
      !scene.renderer
    ) return;

    const xr = scene.renderer.xr;

    if (xr && xr.getSession()) {
      availabilityMessage(
        "Es läuft bereits eine XR-Sitzung. Bitte zuerst verlassen."
      );
      return;
    }

    if (useAR ? !support.ar : !support.vr) {
      availabilityMessage(
        useAR
          ? "Dieser Browser meldet keine WebXR-AR-Unterstützung."
          : "Dieser Browser meldet keine WebXR-VR-Unterstützung."
      );
      return;
    }

    support.starting = true;
    refreshStartButtons();

    F.Menu.close();

    try {
      if (useAR) {
        /*
         * enterAR nutzen, falls die A-Frame-Version die Methode
         * anbietet. Sonst den AR-Parameter von enterVR verwenden.
         */
        if (typeof scene.enterAR === "function") {
          await scene.enterAR();
        } else {
          await scene.enterVR(true);
        }
      } else {
        await scene.enterVR();
      }
    } catch (error) {
      console.error(
        useAR ? "AR-Start fehlgeschlagen:" : "VR-Start fehlgeschlagen:",
        error
      );

      if (!scene.is("ar-mode")) AR.end();

      const reason = error && error.message
        ? error.message
        : String(error);

      availabilityMessage(
        (useAR ? "AR" : "VR") +
        " konnte nicht gestartet werden: " + reason
      );

      F.setStatus(
        (useAR ? "AR" : "VR") +
        "-Start fehlgeschlagen. Browser und Berechtigungen prüfen."
      );
    } finally {
      support.starting = false;
      refreshStartButtons();
    }
  }

  /*
   * ============================================================
   * BUILDER-WRAPPER
   * ============================================================
   */

  const previousBuild = F.RoomBuilder.build;

  F.RoomBuilder.build = function (parent, config, rooms) {
    const result = previousBuild.call(this, parent, config, rooms);

    updateWelcomePosters(parent, config);

    parent.querySelectorAll("[fkc-gallery-entry-hint]")
      .forEach(el => {
        updateEntryHint(el.components["fkc-gallery-entry-hint"]);
      });

    if (AR.active) AR.update();

    return result;
  };

  /*
   * ============================================================
   * LAUFZEIT UND OBERFLÄCHE
   * ============================================================
   */

  AFRAME.registerComponent("fkc-browser-xr", {
    init: function () {
      this.lastRefresh = -Infinity;
    },

    tick: function (time) {
      const arMode = scene.is("ar-mode");

      if (arMode) {
        AR.begin();
        AR.update();
      } else if (AR.active) {
        AR.end();
      }

      /*
       * Die vorhandene fkc-session-Komponente blendet das Panel
       * in VR aus. Diese Ergänzung deckt auch AR ausdrücklich ab.
       */
      const panel = document.getElementById("panel");

      if (panel) panel.classList.toggle("in-vr", immersive());

      if (time - this.lastRefresh >= 150) {
        this.lastRefresh = time;

        refreshModelControls();
        refreshStartButtons();
      }
    },

    remove: function () {
      AR.end();
    }
  });

  function initializeInterface() {
    bindDesktopControls();

    bindButton("start-vr", () => startXR(false));
    bindButton("start-ar", () => startXR(true));

    checkSupport();
    syncDesktopMenu();

    /*
     * Sicherheitsreserve, falls die Szene bereits vor dieser
     * Ergänzung aufgebaut wurde.
     */
    const parent = document.getElementById("room-root");

    if (parent && F.app && F.app.currentId === "welcome") {
      updateWelcomePosters(parent, F.welcomeRoom);
    }
  }

  scene.addEventListener("loaded", refreshStartButtons);

  scene.addEventListener("enter-vr", () => {
    syncDesktopMenu();
    refreshStartButtons();
  });

  scene.addEventListener("exit-vr", () => {
    AR.end();
    syncDesktopMenu();
    refreshStartButtons();
    refreshModelControls();
  });

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeInterface,
      {once: true}
    );
  } else {
    initializeInterface();
  }
})(window.FKCVR);
