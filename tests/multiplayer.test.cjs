"use strict";

const {once} = require("node:events");
const assert = require("node:assert/strict");
const {setTimeout: wait} = require("node:timers/promises");
const {createServer} = require("../server/multiplayer.cjs");
const {readFileSync} = require("node:fs");
const {join} = require("node:path");
const vm = require("node:vm");
const AvatarProfile = require("../js/avatar-profile.js");

async function testClientOptIn() {
  let inVR = false;
  const el = {is: () => inVR, addEventListener() {}};
  const ui = new Map();
  const requests = [];
  const F = {app: {currentId: "welcome"}, AvatarProfile};
  ui.set("multiplayer-name", {value: "  Laborfuchs  ", addEventListener() {}});
  for (const [key, values] of Object.entries(AvatarProfile.choices)) {
    ui.set("multiplayer-" + key, {value: values[0], options: values.map(value => ({value})), addEventListener() {}});
  }
  let component;
  vm.runInNewContext(readFileSync(join(__dirname, "../js/multiplayer.js"), "utf8"), {
    window: {FKCVR: F, location: {search: "?multiplayer=https%3A%2F%2Fexample.test"}},
    URL, URLSearchParams, AbortController, setTimeout, clearTimeout, setInterval: () => 1,
    async fetch(url, options) {
      const body = JSON.parse(options.body);
      requests.push({url: String(url), body});
      if (String(url).endsWith("/access")) return body.code === "test-code"
        ? {ok: true, json: async () => ({accessToken: "test-session"})} : {ok: false, status: 401};
      return {ok: true, json: async () => ({available: AvatarProfile.available([])})};
    }, document: {getElementById(id) {
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
  await client.checkAvailability();
  assert.equal(requests.length, 0, "Kein Zugriff vor Codeprüfung");
  client.codeInput.value = "falsch";
  await client.unlock();
  assert.equal(client.accessToken, undefined);
  assert.match(client.availability.textContent, /falsch/);
  client.codeInput.value = "test-code";
  await client.unlock();
  assert.equal(client.accessToken, "test-session");
  assert.equal(client.codeInput.value, "");
  assert.equal(client.endpoint, undefined, "Codeprüfung allein startet keine Präsenz");
  client.panel.open = true;
  await client.checkAvailability();
  assert.deepEqual(requests.at(-1).body, {room: "welcome", accessToken: "test-session"});
  inVR = true;
  client.availabilityKey = client.selectionKey();
  client.applyAvailability(AvatarProfile.available([{form: "classic", color: "#31749b", style: "hat"}]));
  assert.equal(client.inputs.form.options[0].disabled, true);
  assert.equal(client.inputs.form.value, "slim");
  let previews = 0;
  client.drawPreview = () => { previews++; };
  for (let i = 0; i < 20; i++) {
    const before = client.readProfile();
    client.roll();
    const after = client.readProfile();
    assert.notDeepEqual(after, before, "Erneutes Würfeln zeigt eine andere Kombination");
    assert.equal(after.name, before.name);
    assert.equal(after.form === "classic" || after.color === "#31749b" || after.style === "hat", false);
  }
  assert.equal(previews, 20);
  F.app.currentId = "team-a";
  const last = client.readProfile();
  client.roll();
  assert.deepEqual(client.readProfile(), last, "Keine alte Verfügbarkeit für einen anderen Raum verwenden");
  F.app.currentId = "welcome";
  client.applyAvailability({form: ["slim"], color: ["#ac406c"], style: ["monocle"]});
  assert.equal(client.dice.disabled, true, "Einzige verbleibende Kombination braucht keinen Würfel");
  assert.equal(client.button.disabled, false);
  client.applyAvailability({form: [], color: ["#ac406c"], style: ["monocle"]});
  assert.equal(client.dice.disabled, true);
  assert.equal(client.button.disabled, true);
  client.applyAvailability(AvatarProfile.available([]));
  client.toggle();
  assert.equal(client.endpoint, "https://example.test/presence");
  assert.equal(client.profile.name, "Laborfuchs");
  client.room = "welcome";
  const model = {id: "welcome-model-10", modelReady: true, fkcVariantId: "co-complex",
    fkcVariants: [{id: "co-complex"}, {id: "co-coordination"}]};
  ui.set(model.id, model);
  const switches = [];
  F.switchVariant = (...args) => switches.push(args);
  assert.equal(client.requestVariant(model, "co-coordination"), true);
  const variants = {self: "a", models: [{model: model.id, variant: "co-coordination"}]};
  client.receiveModels(variants);
  assert.equal(switches.length, 0, "Nicht vor Bestätigung der ausstehenden Wahl anwenden");
  client.variantRequests.clear();
  client.receiveModels(variants);
  client.receiveModels(variants);
  assert.deepEqual(switches, [[model, "co-coordination", true]], "Empfang startet genau einen lokalen Ladevorgang");
  F.Tutorial = {active: true};
  client.tick(1);
  assert.equal(client.room, null, "Tutorial ist vom Pilot getrennt");
  client.exit();
  assert.equal(client.endpoint, null);
  assert.equal(client.accessToken, null);
  assert.equal(requests.at(-1).body.endSession, true);
  assert.equal(client.status.textContent, "Einzelmodus");
}

async function test() {
  await testClientOptIn();
  const origin = "https://example.test";
  const code = "test-code";
  assert.throws(() => createServer(origin), /FKC_ACCESS_CODE/);
  const server = createServer(origin, code).listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const url = `http://127.0.0.1:${server.address().port}/presence`;
    const state = {room: "welcome", head: [0, 1.6, 6, 0, 0, 0, 1], left: null, right: null};
    const post = (data, from = origin, route = "presence") => fetch(url.replace(/presence$/, route), {method: "POST",
      headers: {Origin: from, "Content-Type": "application/json"}, body: JSON.stringify(data)});
    const getAccess = async () => {
      const response = await post({code}, origin, "access");
      assert.equal(response.status, 200);
      return (await response.json()).accessToken;
    };
    const clients = new Map();
    const ok = async data => {
      const accessToken = data.token ? clients.get(data.token) : await getAccess();
      const response = await post({...data, accessToken, endSession: data.leave});
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
      const result = await response.json();
      if (result.token) clients.set(result.token, accessToken);
      return result;
    };
    const preflight = await fetch(url, {method: "OPTIONS", headers: {Origin: origin}});
    assert.equal(preflight.status, 204);
    assert.equal((await fetch(url.replace(/presence$/, "health"))).status, 200);
    assert.equal((await post(state, "https://other.test")).status, 403);
    assert.equal((await post({code}, "https://other.test", "access")).status, 403);
    assert.equal((await post({}, origin, "access")).status, 401);
    assert.equal((await post({code: code.toUpperCase()}, origin, "access")).status, 401);
    assert.equal((await post(state)).status, 401);
    assert.equal((await post({...state, accessToken: "unbekannt"})).status, 401);
    assert.equal((await post({room: "welcome"}, origin, "availability")).status, 401);
    const accessToken = await getAccess();
    assert.equal((await post({...state, accessToken, head: [0, 0, 0, 0, 0, 0, 0]})).status, 400);
    assert.equal((await post({...state, accessToken, hands: "true"})).status, 400);
    assert.equal((await post({...state, accessToken, pointing: [0, 1, 6, 26, 1, 6]})).status, 400);
    const firstProfile = {form: "classic", color: "#ac406c", style: "hat"};
    const a = await ok({...state, profile: firstProfile});
    assert.equal((await post({...state, token: a.token, accessToken})).status, 403);
    const availability = await post({room: "welcome", accessToken}, origin, "availability");
    const {available} = await availability.json();
    for (const key of Object.keys(firstProfile)) assert.ok(!available[key].includes(firstProfile[key]));
    for (const key of Object.keys(firstProfile)) assert.equal((await post({...state, accessToken, profile: {[key]: firstProfile[key]}})).status, 409);
    const profile = {name: "Laborfuchs", form: "slim", color: "#31749b", style: "monocle"};
    const pointing = [1, 1.2, 6, 0, 1.4, 4];
    const annotations = [{model: "welcome-model-10", variant: "co-complex", mode: "pin", atoms: ["co-heavy-1"]},
      {model: "welcome-model-10", variant: "co-complex", mode: "angle", atoms: ["co-heavy-2", "co-heavy-1", "co-heavy-3"]}];
    const b = await ok({...state, head: [1, 1.6, 6, 0, 0, 0, 1], hands: true, pointing,
      annotations: [...annotations, {...annotations[0], model: "team-a-model-1"}], profile: {...profile, gender: "w", name: "  Laborfuchs\u202e "}});
    assert.deepEqual(a.peers, []);
    assert.equal(b.peers.length, 1);
    assert.equal(b.peers[0].token, undefined);
    assert.equal(b.peers[0].accessToken, undefined);
    assert.deepEqual(b.peers[0].head, state.head);
    assert.equal(b.peers[0].hands, false, "Ältere Clients behalten Controller");
    assert.equal(b.peers[0].pointing, null);
    const otherRoom = await ok({...state, room: "team-a", profile});
    assert.deepEqual(otherRoom.peers, []);
    await wait(80);
    const update = await ok({...state, token: a.token});
    assert.equal(update.token, a.token);
    assert.equal(update.peers[0].head[0], 1);
    assert.equal(update.peers[0].hands, true);
    assert.deepEqual(update.peers[0].pointing, pointing);
    assert.deepEqual(update.peers[0].annotations, annotations);
    await ok({...state, token: b.token, pointing: null, annotations: []});
    await wait(80);
    const cleared = (await ok({...state, token: a.token})).peers[0];
    assert.equal(cleared.pointing, null);
    assert.deepEqual(cleared.annotations, []);
    assert.deepEqual(update.peers[0].profile, profile);
    assert.deepEqual(FallbackProfile(), {name: "x".repeat(24), color: "", form: "", style: ""});
    await wait(80);
    const moved = await ok({...state, room: "welcome", token: otherRoom.token, profile});
    for (const key of Object.keys(firstProfile)) {
      assert.notEqual(moved.profile[key], profile[key]);
      assert.notEqual(moved.profile[key], firstProfile[key]);
    }
    await ok({token: moved.token, leave: true});
    await ok({token: b.token, leave: true});
    assert.equal((await post({...state, accessToken: clients.get(b.token)})).status, 401);
    await wait(80);
    const model = "welcome-model-10";
    const transform = [0, 1.48, 4, 0, 0, 0, 1, 0, 0, 0, 1, 1];
    const movedTransform = [1, 1.7, 4, 0, 0, 0, 1, 0, 0.6, 0, 0.8, 1.5];
    const command = (action, t = transform, name = model) => ({action, model: name, transform: t});
    const after = await ok({...state, token: a.token, modelCommand: command("grab")});
    assert.deepEqual(after.peers, []);
    assert.equal(after.models[0].owner, after.self);
    const second = await ok({...state, profile, modelCommand: command("grab", movedTransform)});
    assert.equal(second.models[0].owner, after.self, "Ein zweiter Grip übernimmt nicht");
    assert.deepEqual(second.models[0].transform, transform);
    await wait(80);
    const movedModel = await ok({...state, token: a.token, modelCommand: command("move", movedTransform)});
    assert.deepEqual(movedModel.models[0].transform, movedTransform);
    const rejectedMove = await ok({...state, token: second.token, modelCommand: command("move")});
    assert.deepEqual(rejectedMove.models[0].transform, movedTransform, "Nur der Besitzer kann bewegen");
    await wait(80);
    const invalid = await ok({...state, token: a.token, modelCommand: command("move", [...movedTransform.slice(0, 11), -1])});
    assert.deepEqual(invalid.models[0].transform, movedTransform);
    await wait(80);
    const released = await ok({...state, token: a.token, modelCommand: command("release", movedTransform)});
    assert.equal(released.models[0].owner, null);
    const handedOver = await ok({...state, token: second.token, modelCommand: command("grab")});
    assert.equal(handedOver.models[0].owner, second.self);
    assert.deepEqual(handedOver.models[0].transform, movedTransform, "Neuer Grip übernimmt aktuelle Position");
    await ok({token: second.token, leave: true});
    await wait(80);
    assert.equal((await ok({...state, token: a.token})).models[0].owner, null);
    assert.deepEqual((await ok({...state, room: "team-b"})).models, [], "Räume teilen keine Modelle");
    await wait(80);
    const variantCommand = {model, variant: "co-coordination"};
    const changed = await ok({...state, token: a.token, variantCommand});
    assert.equal(changed.models[0].variant, "co-coordination");
    assert.deepEqual(changed.models[0].transform, movedTransform, "Ansicht ändert nicht die Modellpose");
    const newcomer = await ok({...state, profile});
    assert.equal(newcomer.models[0].variant, "co-coordination", "Späterer Beitritt übernimmt die Ansicht");
    await wait(80);
    const unauthorizedVariant = await ok({...state, token: newcomer.token,
      variantCommand: {model, variant: "c60-cif"}});
    assert.equal(unauthorizedVariant.models[0].variant, "co-coordination");
    await wait(80);
    const activeGrip = await ok({...state, token: a.token, modelCommand: command("grab")});
    assert.equal(activeGrip.models[0].owner, a.self);
    const held = await ok({...state, token: newcomer.token, variantCommand: {model, variant: "co-cell"}});
    assert.equal(held.models[0].variant, "co-coordination", "Fremder Grip sperrt Ansichtswechsel");
    for (let i = 0; i < 18; i++) assert.equal((await post({code: "falsch"}, origin, "access")).status, 401);
    assert.equal((await post({code}, origin, "access")).status, 429);
    console.log("Multiplayer: echter lokaler HTTP-Test für Zutritt, Datenübertragung, Raumtrennung und Austritt bestanden.");
  } finally { server.close(); }
}

function FallbackProfile() {
  return require("../js/avatar-profile.js").normalize({name: "x".repeat(30), gender: "other", color: "red", style: "unknown"});
}

test().catch(error => { console.error(error); process.exitCode = 1; });