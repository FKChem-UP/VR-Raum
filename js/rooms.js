"use strict";

(function (F) {
  /*
   * ============================================================
   * ZENTRALE RAUMDATEN — GALERIE-2
   * ============================================================
   *
   * Modell- und Folienpfade beziehen sich auf index.html.
   * Groß-/Kleinschreibung der Dateinamen beachten.
   *
   * title:
   *   Kurzer Raumname für die bisherige Oberfläche.
   *
   * posterTitle:
   *   Vollständiger Titel auf der Raumtafel im Begrüßungsraum.
   */

  const museumColors = {
    wall: "#a7c1aa",
    cream: "#eee7d5",
    creamDark: "#d5ceba",
    gold: "#b38b39",
    goldLight: "#e2c777",
    goldDark: "#75531e"
  };

  const stationPositions = [
    {wall: "left", along: -8.1},
    {wall: "left", along: -2.7},
    {wall: "left", along: 2.7},
    {wall: "left", along: 8.1},

    {wall: "right", along: -8.1},
    {wall: "right", along: -2.7},
    {wall: "right", along: 2.7},
    {wall: "right", along: 8.1},

    {wall: "back", along: -11},
    {wall: "back", along: -3.7},
    {wall: "back", along: 3.7},
    {wall: "back", along: 11},

    {wall: "front", along: -11},
    {wall: "front", along: -5.4},
    {wall: "front", along: 5.4},
    {wall: "front", along: 11}
  ];

  function emptyStations() {
    return stationPositions.map((position, index) => ({
      wall: position.wall,
      along: position.along,
      title: "Station " + String(index + 1).padStart(2, "0"),
      slide: "",
      model: ""
    }));
  }

  function museumRoom(id, title, posterTitle) {
    return {
      id,
      title,
      posterTitle,
      kind: "museum",

      width: 32,
      depth: 22.67,
      height: 7,

      spawn: {x: 0, z: 6},

      posterWidth: 4.8,
      posterHeight: 2.7,
      posterY: 3.25,

      modelY: 1.35,
      modelDistance: 2.7,
      modelSize: 0.5,

      colors: Object.assign({}, museumColors),
      stations: emptyStations()
    };
  }

  /*
   * ============================================================
   * BEGRÜSSUNGSRAUM: WEISS-GOLDENE GALERIE
   * ============================================================
   *
   * exhibits:
   *   roomId = Ziel der Raumtafel
   *   title  = Beschriftung am Podest und Name im Modellmenü
   *   model  = späterer GLB-Pfad
   *
   * Ein leerer Modellpfad erzeugt eine neutrale Platzhalterkugel.
   * Vorschau-Modelle und Vorlesungsmodelle sind unabhängig.
   */

  F.welcomeRoom = {
    id: "welcome",
    title: "Begrüßungsraum",
    kind: "welcome",

    width: 18,
    depth: 16,
    height: 5.2,

    spawn: {x: 0, z: 5},

    posterWidth: 3,
    posterHeight: 1.6875,
    posterY: 2.95,

    modelY: 1.48,
    modelSize: 0.65,
    modelDistance: 1.85,

    colors: {
      wall: "#fffdf8",
      cream: "#fffdf9",
      creamDark: "#eee9de",
      gold: "#c5a052",
      goldLight: "#e4ca83",
      goldDark: "#8d6c2e"
    },

    exhibits: [
      {
        roomId: "vorlesung-1",
        title: "Fulleren",
        model: ""
      },
      {
        roomId: "vorlesung-2",
        title: "Eis",
        model: ""
      },
      {
        roomId: "vorlesung-3",
        title: "YBa2Cu3O7-x",
        model: ""
      },
      {
        roomId: "vorlesung-4",
        title: "tetragonal innenzentriertes Bravaisgitter",
        model: ""
      },
      {
        roomId: "vorlesung-5",
        title: "Platzhalter",
        model: ""
      },
      {
        roomId: "vorlesung-6",
        title: "Kubisch dichte Packung",
        model: ""
      },
      {
        roomId: "vorlesung-7",
        title: "Zinkblende ZnS",
        model: ""
      },
      {
        roomId: "vorlesung-8",
        title: "Schwefel S8",
        model: ""
      },
      {
        roomId: "team-a",
        title: "HKUST-1",
        model: ""
      },
      {
        roomId: "team-b",
        title: "Co-Komplex",
        model: ""
      }
    ]
  };

  F.rooms = [
    museumRoom(
      "vorlesung-1",
      "Vorlesung 1",
      "1. Vorlesung - Allgemeines zur Festkörperchemie"
    ),
    museumRoom(
      "vorlesung-2",
      "Vorlesung 2",
      "2. Vorlesung - Bindungsarten im Festkörper"
    ),
    museumRoom(
      "vorlesung-3",
      "Vorlesung 3",
      "3. Vorlesung - Synthese von Festkörper-Verbindungen"
    ),
    museumRoom(
      "vorlesung-4",
      "Vorlesung 4",
      "4. Vorlesung - Kristallographie und Symmetrie in Kristallen"
    ),
    museumRoom(
      "vorlesung-5",
      "Vorlesung 5",
      "5. Vorlesung - Röntgenstrukturanalyse"
    ),
    museumRoom(
      "vorlesung-6",
      "Vorlesung 6",
      "6. Vorlesung - Metallstrukturen"
    ),
    museumRoom(
      "vorlesung-7",
      "Vorlesung 7",
      "7. Vorlesung - Ionengitter"
    ),
    museumRoom(
      "vorlesung-8",
      "Vorlesung 8",
      "8. Vorlesung - Molekülstrukturen"
    ),
    museumRoom(
      "team-a",
      "Team A",
      "Praktikumsraum Team A"
    ),
    museumRoom(
      "team-b",
      "Team B",
      "Praktikumsraum Team B"
    )
  ];

  const room = id => F.rooms.find(item => item.id === id);

  /*
   * ============================================================
   * VORLESUNG 1: BISHERIGE MODELLE — UNVERÄNDERT
   * ============================================================
   */

  const v1 = room("vorlesung-1");

  Object.assign(v1.stations[0], {
    title: "Diamant",
    model: "assets/models/Diamant.glb",
    slide: ""
  });

  Object.assign(v1.stations[1], {
    title: "Graphit",
    model: "assets/models/Graphit.glb",
    slide: ""
  });

  Object.assign(v1.stations[4], {
    title: "Eis",
    model: "assets/models/Eis2.glb",
    slide: ""
  });

  Object.assign(v1.stations[5], {
    title: "MgCl2",
    model: "assets/models/MgCl2.glb",
    slide: ""
  });

  Object.assign(v1.stations[8], {
    title: "Imidazol",
    model: "assets/models/Imidazol.glb",
    slide: ""
  });

  Object.assign(v1.stations[11], {
    title: "BODIPY",
    model: "assets/models/BODIPY.glb",
    slide: ""
  });

  /*
   * Später ein Vorschau-Modell ergänzen:
   *
   * F.welcomeRoom.exhibits[0].model =
   *   "assets/models/Fulleren.glb";
   *
   * Dies ist nur ein Beispielpfad.
   * Die Datei muss tatsächlich vorhanden sein.
   */
})(window.FKCVR);
