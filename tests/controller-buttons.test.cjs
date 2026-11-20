"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const components = {};
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/vr-controls.js"), "utf8"), {
  window, THREE: {}, AFRAME: {registerComponent: (name, component) => { components[name] = component; }}
});

const poll = components["fkc-controller"].pollButtons;
for (const hand of ["left", "right"]) {
  const actions = [];
  const buttons = Array.from({length: 6}, () => ({pressed: false}));
  const tools = {source: {gamepad: {mapping: "xr-standard", buttons}}, data: {hand}, el: {components: {}}, states: {},
    resetAction: () => actions.push("reset"), menuAction: () => actions.push("menu"), helpAction: () => actions.push("help")};
  const press = index => {
    buttons[index].pressed = true;
    poll.call(tools);
    poll.call(tools);
    buttons[index].pressed = false;
    poll.call(tools);
  };
  press(3);
  press(4);
  press(5);
  press(5);
  assert.deepEqual(actions, hand === "left" ? ["menu", "menu"] : ["reset", "help", "help"]);
}
console.log("Controllerbelegung geprüft: Y Menü, B Hilfe, A Reset, X und Stick-Klick frei.");