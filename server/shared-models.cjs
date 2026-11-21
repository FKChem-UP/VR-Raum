"use strict";

const {rooms: configs, welcomeRoom} = require("../js/rooms.js");
const variants = new Map();
for (const config of [welcomeRoom, ...configs]) {
  const stations = config.stations || configs.map(room => config.exhibits.find(exhibit => exhibit.roomId === room.id));
  for (const [index, station] of stations.entries()) {
    if (station?.variants?.length) variants.set(`${config.id}-model-${index + 1}`, station.variants.map(variant => variant.id));
  }
}

function sharedModels() {
  const rooms = new Map();
  const validTransform = t => Array.isArray(t) && t.length === 12 && t.every(Number.isFinite) &&
    t.slice(0, 3).every(n => Math.abs(n) <= 100) && [3, 7].every(i => Math.abs(Math.hypot(...t.slice(i, i + 4)) - 1) < 0.01) &&
    t[11] >= 0.02 && t[11] <= 10;

  return function update(room, id, command, peers, variantCommand) {
    const active = new Map([...peers.values()].map(peer => [peer.id, peer.room]));
    for (const [key, models] of rooms) {
      if (![...active.values()].includes(key)) { rooms.delete(key); continue; }
      for (const model of models.values()) if (active.get(model.owner) !== key) model.owner = null;
    }
    if (!room) return [];
    if (!rooms.has(room)) rooms.set(room, new Map());
    const models = rooms.get(room);
    const name = command?.model;
    const prefix = room + "-model-";
    const valid = typeof name === "string" && name.startsWith(prefix) && /^(?:[1-9]|1[0-6])$/.test(name.slice(prefix.length));
    // Eine Person kann genau ein Modell kontrollieren; beide Grips bleiben möglich.
    for (const [key, model] of models) if (model.owner === id && (!valid || key !== name)) model.owner = null;
    if (valid && validTransform(command.transform)) {
      let model = models.get(name);
      if (command.action === "grab") {
        if (!model) { model = {model: name, owner: null}; models.set(name, model); }
        if (!model.owner) {
          model.owner = id;
          if (!model.transform) model.transform = command.transform;
        }
      } else if (model?.owner === id && ["move", "release"].includes(command.action)) {
        model.transform = command.transform;
        if (command.action === "release") model.owner = null;
      }
    }
    const target = variantCommand?.model;
    const options = variants.get(target);
    if (options?.includes(variantCommand.variant) && target.startsWith(prefix)) {
      let model = models.get(target);
      if (!model) { model = {model: target, owner: null}; models.set(target, model); }
      // Bei Kollision die gültige Ansicht an den anfragenden Client zurückgeben.
      if (!model.owner || model.owner === id) model.variant = variantCommand.variant;
      else if (!model.variant) model.variant = options[0];
    }
    return [...models.values()];
  };
}

module.exports = {sharedModels};