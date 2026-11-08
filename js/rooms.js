"use strict";

(function (F) {
  /*
   * ============================================================
   * ZENTRALE RAUMDATEN
   * ============================================================
   *
   * title: sichtbarer Name, frei änderbar
   * id: interne Kennung, möglichst unverändert lassen
   *
   * Modellpfade und Folienpfade beziehen sich auf index.html.
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

  function museumRoom(id, title) {
    return {
      id,
      title,
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

  F.welcomeRoom = {
    id: "welcome",
    title: "Begrüßungsraum",
    kind: "welcome",

    width: 18,
    depth: 16,
    height: 5.2,

    spawn: {x: 0, z: 5}
  };

  F.rooms = [
    museumRoom("vorlesung-1", "Vorlesung 1"),
    museumRoom("vorlesung-2", "Vorlesung 2"),
    museumRoom("vorlesung-3", "Vorlesung 3"),
    museumRoom("vorlesung-4", "Vorlesung 4"),
    museumRoom("vorlesung-5", "Vorlesung 5"),
    museumRoom("vorlesung-6", "Vorlesung 6"),
    museumRoom("vorlesung-7", "Vorlesung 7"),
    museumRoom("vorlesung-8", "Vorlesung 8"),
    museumRoom("team-a", "Team A"),
    museumRoom("team-b", "Team B")
  ];

  const room = id => F.rooms.find(item => item.id === id);

  /*
   * ============================================================
   * VORLESUNG 1: BISHERIGE MODELLE
   * ============================================================
   *
   * Die Stationsnummer im Array beginnt bei 0:
   * stations[0] = erste Station
   * stations[4] = fünfte Station
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
   * ============================================================
   * HIER SPÄTER WEITERE RÄUME ANPASSEN
   * ============================================================
   *
   * Beispiele – zunächst auskommentiert.
   *
   * Namen ändern:
   *
   * room("vorlesung-2").title = "Kristallstrukturen";
   *
   * Wandfarbe ändern:
   *
   * room("team-a").colors.wall = "#b9cadc";
   *
   * Modell und Folie einer Station ändern:
   *
   * Object.assign(room("vorlesung-2").stations[0], {
   *   title: "Natriumchlorid",
   *   model: "assets/models/NaCl.glb",
   *   slide: "assets/slides/vorlesung-2/NaCl.jpg"
   * });
   *
   * Nur eine Folie für Diamant ergänzen:
   *
   * v1.stations[0].slide =
   *   "assets/slides/vorlesung-1/Diamant_Folie.jpg";
   */
})(window.FKCVR);
