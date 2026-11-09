"use strict";

(function () {
  const report = {
    support: {},
    errors: [],
    modelEvents: [],
    lastImmersive: null
  };

  let output = null;

  function describe(error) {
    if (!error) return "Unbekannter Fehler";
    return error.stack || error.message || String(error);
  }

  function rememberError(text) {
    const previous = report.errors[report.errors.length - 1];

    if (previous && previous.message === text) {
      previous.count++;
    } else {
      report.errors.push({
        time: new Date().toISOString(),
        message: text,
        count: 1
      });
    }

    if (report.errors.length > 25) report.errors.shift();
    render();
  }

  window.addEventListener("error", function (event) {
    if (event.message) {
      rememberError(
        event.message + "\n" +
        (event.filename || "") + ":" +
        (event.lineno || 0) + ":" +
        (event.colno || 0) + "\n" +
        describe(event.error)
      );
    } else {
      const target = event.target;
      const url = target && (target.src || target.href);

      if (url) rememberError("Ressource nicht geladen: " + url);
    }
  }, true);

  window.addEventListener("unhandledrejection", function (event) {
    rememberError("Unbehandelter Promise-Fehler:\n" + describe(event.reason));
  });

  function snapshot() {
    const scene = document.getElementById("scene");
    const F = window.FKCVR;
    const xr = scene && scene.renderer && scene.renderer.xr;
    const session = xr && xr.getSession();

    const result = {
      time: new Date().toISOString(),
      url: location.href,
      secureContext: window.isSecureContext,
      userAgent: navigator.userAgent,
      aframe: window.AFRAME ? window.AFRAME.version : "nicht geladen",
      sceneLoaded: !!(scene && scene.hasLoaded),
      vrMode: !!(scene && scene.is("vr-mode")),
      arMode: !!(scene && scene.is("ar-mode")),
      xrSessionActive: !!session,
      room: F && F.app ? F.app.currentId : null,
      walkableFunction:
        !!(F && F.app && F.app.activeRoom &&
           typeof F.app.activeRoom.isWalkable === "function"),
      menuOpen: !!(F && F.Menu && F.Menu.opened),
      components: {},
      inputSources: [],
      models: []
    };

    [
      ["scene", "fkc-xr-rays"],
      ["scene", "fkc-session"],
      ["rig", "fkc-navigation"],
      ["leftHand", "fkc-controller"],
      ["rightHand", "fkc-controller"],
      ["leftHand", "fkc-grabber"],
      ["rightHand", "fkc-grabber"]
    ].forEach(function (pair) {
      const el = document.getElementById(pair[0]);

      result.components[pair.join("/")] =
        !!(el && el.components && el.components[pair[1]]);
    });

    if (session) {
      result.inputSources = Array.from(session.inputSources).map(
        function (source) {
          const gp = source.gamepad;

          return {
            hand: source.handedness,
            rayMode: source.targetRayMode,
            profiles: Array.from(source.profiles),
            handTracking: !!source.hand,
            gamepad: !!gp,
            mapping: gp ? gp.mapping : null,
            axes: gp
              ? Array.from(gp.axes).map(v => Number(v.toFixed(3)))
              : [],
            buttons: gp
              ? Array.from(gp.buttons).map(function (button, index) {
                  return {
                    index,
                    pressed: button.pressed,
                    value: Number(button.value.toFixed(2))
                  };
                })
              : []
          };
        }
      );
    }

    if (scene) {
      scene.querySelectorAll(".interactable").forEach(function (root) {
        const visual = root.querySelector("[gltf-model]");
        const mesh = visual && visual.getObject3D("mesh");
        const normalize = visual &&
          visual.components["fkc-normalize"];

        let meshes = 0;

        if (mesh) {
          mesh.traverse(function (object) {
            if (object.isMesh) meshes++;
          });
        }

        result.models.push({
          id: root.id,
          title: root.dataset.title,
          ready: !!root.modelReady,
          gltf: visual ? visual.getAttribute("gltf-model") : null,
          meshLoaded: !!mesh,
          meshCount: meshes,
          normalized: !!(normalize && normalize.result),
          visualVisible: visual ? visual.object3D.visible : null,
          visualScale: visual
            ? visual.object3D.scale.toArray()
            : null,
          visualPosition: visual
            ? visual.object3D.position.toArray()
            : null
        });
      });
    }

    return result;
  }

  function render() {
    if (!output) return;

    try {
      output.value = JSON.stringify({
        support: report.support,
        current: snapshot(),
        lastImmersive: report.lastImmersive,
        modelEvents: report.modelEvents,
        errors: report.errors
      }, null, 2);
    } catch (error) {
      output.value = "Diagnosefehler:\n" + describe(error);
    }
  }

  async function checkSupport() {
    if (!navigator.xr) {
      report.support = {webxr: false};
    } else {
      report.support.webxr = true;

      for (const mode of ["immersive-vr", "immersive-ar"]) {
        try {
          report.support[mode] =
            await navigator.xr.isSessionSupported(mode);
        } catch (error) {
          report.support[mode] = describe(error);
        }
      }
    }

    const label = document.getElementById("xr-debug-support");

    label.textContent = report.support.webxr
      ? "Browser meldet: VR = " + report.support["immersive-vr"] +
        " | AR = " + report.support["immersive-ar"]
      : "WebXR ist in diesem Browser nicht verfügbar.";

    render();
  }

  function captureImmersive() {
    try {
      const scene = document.getElementById("scene");
      const xr = scene && scene.renderer && scene.renderer.xr;

      if (xr && xr.getSession()) {
        report.lastImmersive = snapshot();
      }
    } catch (error) {
      rememberError("XR-Diagnose:\n" + describe(error));
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    output = document.getElementById("xr-debug-output");
    const scene = document.getElementById("scene");

    document.getElementById("xr-debug-refresh").onclick = render;

    document.getElementById("xr-debug-enter").onclick = function () {
      if (!scene || !scene.hasLoaded || !scene.renderer) {
        rememberError("VR-Start: Szene ist noch nicht bereit.");
        return;
      }

      if (scene.renderer.xr.getSession()) {
        rememberError(
          "VR-Start: Es läuft bereits eine XR-Sitzung. " +
          "Bitte diese zuerst verlassen."
        );
        return;
      }

      try {
        Promise.resolve(scene.enterVR()).catch(function (error) {
          rememberError("VR-Start fehlgeschlagen:\n" + describe(error));
        });
      } catch (error) {
        rememberError("VR-Start fehlgeschlagen:\n" + describe(error));
      }
    };

    ["model-loaded", "model-error"].forEach(function (name) {
      scene.addEventListener(name, function (event) {
        const root = event.target.closest
          ? event.target.closest(".interactable")
          : null;

        report.modelEvents.push({
          event: name,
          title: root ? root.dataset.title : null,
          src: event.detail && event.detail.src
            ? String(event.detail.src)
            : null
        });

        if (report.modelEvents.length > 40) {
          report.modelEvents.shift();
        }

        setTimeout(render, 0);
      });
    });

    scene.addEventListener("enter-vr", function () {
      setTimeout(function () {
        captureImmersive();
        render();
      }, 1000);
    });

    scene.addEventListener("exit-vr", function () {
      setTimeout(render, 300);
    });

    setInterval(captureImmersive, 1000);

    checkSupport();
    render();
  });
})();
