"use strict";

const {once} = require("node:events");
const assert = require("node:assert/strict");
const {setTimeout: wait} = require("node:timers/promises");
const {createServer} = require("../server/multiplayer.cjs");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const vm = require("node:vm");

function testClientOptIn() {
  const el = {is: () => true, addEventListener() {}};
  const ui = new Map();
  const F = {app: {currentId: "welcome"}};
  let component;
  vm.runInNewContext(readFileSync(join(__dirname, "../js/multiplayer.js"), "utf8"), {
    window: {FKCVR: F, location: {search: "?multiplayer=https%3A%2F%2Fexample.test"}},
    URL, URLSearchParams, document: {getElementById(id) {
      if (!ui.has(id)) ui.set(id, {addEventListener() {}});
      return ui.get(id);
    }},
    AFRAME: {THREE: {Vector3: class {}, Quaternion: class {}}, registerComponent(_name, definition) { component = definition; }}
  });
  const client = {...component, el};
  client.init();
  assert.equal(client.urlInput.value, "https://example.test");
  assert.equal(client.endpoint, undefined, "URL-Parameter ist keine Einwilligung zum Beitritt");
  client.tick(0);
  client.toggle();
  assert.equal(client.endpoint, "https://example.test/presence");
  client.room = "welcome";
  F.Tutorial = {active: true};
  client.tick(1);
  assert.equal(client.room, null, "Tutorial ist vom Pilot getrennt");
  client.exit();
  assert.equal(client.endpoint, null);
  assert.equal(client.status.textContent, "Einzelmodus");
}

async function test() {
  testClientOptIn();
  const origin = "https://example.test";
  const server = createServer(origin).listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const url = `http://127.0.0.1:${server.address().port}/presence`;
    const state = {room: "welcome", head: [0, 1.6, 6, 0, 0, 0, 1], left: null, right: null};
    const post = (data, from = origin) => fetch(url, {method: "POST",
      headers: {Origin: from, "Content-Type": "application/json"}, body: JSON.stringify(data)});
    const ok = async data => {
      const response = await post(data);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
      return response.json();
    };
    const preflight = await fetch(url, {method: "OPTIONS", headers: {Origin: origin}});
    assert.equal(preflight.status, 204);
    assert.equal((await post(state, "https://other.test")).status, 403);
    assert.equal((await post({...state, head: [0, 0, 0, 0, 0, 0, 0]})).status, 400);
    const a = await ok(state);
    const b = await ok({...state, head: [1, 1.6, 6, 0, 0, 0, 1]});
    assert.deepEqual(a.peers, []);
    assert.equal(b.peers.length, 1);
    assert.equal(b.peers[0].token, undefined);
    assert.deepEqual(b.peers[0].head, state.head);
    const otherRoom = await ok({...state, room: "team-a"});
    assert.deepEqual(otherRoom.peers, []);
    await wait(80);
    const update = await ok({...state, token: a.token});
    assert.equal(update.token, a.token);
    assert.equal(update.peers[0].head[0], 1);
    await ok({token: b.token, leave: true});
    await wait(80);
    const after = await ok({...state, token: a.token});
    assert.deepEqual(after.peers, []);
    console.log("Multiplayer: echter lokaler HTTP-Test für Zutritt, Datenübertragung, Raumtrennung und Austritt bestanden.");
  } finally { server.close(); }
}

test().catch(error => { console.error(error); process.exitCode = 1; });