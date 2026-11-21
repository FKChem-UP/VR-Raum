"use strict";

const http = require("node:http");
const {randomUUID} = require("node:crypto");
const {normalize, available, choices} = require("../js/avatar-profile.js");
const validRoom = room => typeof room === "string" && /^(welcome|vorlesung-[1-8]|team-[ab])$/.test(room);

function createServer(origin) {
  const peers = new Map();
  const reply = (res, status, data) => {
    res.writeHead(status, {"Content-Type": "application/json", "Cache-Control": "no-store"});
    res.end(JSON.stringify(data));
  };
  const pose = value => Array.isArray(value) && value.length === 7 && value.every(Number.isFinite) &&
    value.slice(0, 3).every(n => Math.abs(n) <= 100) && Math.abs(Math.hypot(...value.slice(3)) - 1) < 0.01;

  return http.createServer({requestTimeout: 5000, headersTimeout: 5000, maxHeaderSize: 8192}, async (req, res) => {
    if (req.url === "/health" && req.method === "GET") return reply(res, 200, {ok: true});
    if (!["/presence", "/availability"].includes(req.url) || req.headers.origin !== origin) return reply(res, 403, {error: "Nicht zugelassen"});
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    if (req.method === "OPTIONS") {
      res.writeHead(204, {"Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type"});
      return res.end();
    }
    if (req.method !== "POST") return reply(res, 405, {error: "POST erwartet"});
    let body = "", size = 0;
    try {
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 2048) { req.destroy(); return; }
        body += chunk;
      }
      const data = JSON.parse(body);
      if (!data || typeof data !== "object") return reply(res, 400, {error: "Ungültige Nachricht"});
      const now = Date.now();
      for (const [key, peer] of peers) if (now - peer.time > 5000) peers.delete(key);
      const free = (room, exclude) => available([...peers].filter(([key, peer]) =>
        key !== exclude && peer.room === room).map(([, peer]) => peer.profile));
      if (req.url === "/availability") {
        if (!validRoom(data.room)) return reply(res, 400, {error: "Ungültiger Raum"});
        return reply(res, 200, {available: free(data.room)});
      }
      let token = data.token;
      const prior = peers.get(token);
      if (data.leave === true) {
        if (prior) peers.delete(token);
        return reply(res, 200, {ok: true});
      }
      if (!validRoom(data.room) ||
          !pose(data.head) || ![data.left, data.right].every(p => p === null || pose(p)) ||
          (data.hands !== undefined && typeof data.hands !== "boolean")) {
        return reply(res, 400, {error: "Ungültige Raum- oder Positionsdaten"});
      }
      if (!prior) {
        if (peers.size >= 16) return reply(res, 503, {error: "Pilot voll"});
        token = randomUUID();
      } else if (now - prior.time < 60) return reply(res, 429, {error: "Zu viele Aktualisierungen"});
      let profile = prior?.room === data.room ? prior.profile : normalize(data.profile);
      if (prior?.room !== data.room) {
        const options = free(data.room, token);
        for (const key of Object.keys(choices)) {
          if (!options[key].length || (!prior && profile[key] && !options[key].includes(profile[key]))) {
            return reply(res, 409, {error: "Avatarwahl belegt oder Raum voll", available: options});
          }
          if (!options[key].includes(profile[key])) profile[key] = options[key][Math.floor(Math.random() * options[key].length)];
        }
      }
      peers.set(token, {id: prior?.id || randomUUID(), room: data.room, time: now,
        head: data.head, left: data.left, right: data.right, hands: data.hands === true, profile});
      const nearby = [...peers].filter(([key, peer]) => key !== token && peer.room === data.room)
        .map(([, {id, head, left, right, hands, profile}]) => ({id, head, left, right, hands, profile}));
      reply(res, 200, {token, profile, peers: nearby});
    } catch {
      if (!res.destroyed) reply(res, 400, {error: "Ungültige Nachricht"});
    }
  });
}

if (require.main === module) {
  const origin = process.env.FKC_ORIGIN;
  if (!origin || !/^https?:\/\/[^/]+$/.test(origin)) throw new Error("FKC_ORIGIN muss die Origin der VR-Seite sein.");
  createServer(origin).listen(Number(process.env.PORT || 8787), process.env.FKC_HOST || "127.0.0.1", () => {
    console.log("FKC-Multiplayer-Pilot gestartet (HTTP, für Pico hinter HTTPS betreiben).");
  });
}

module.exports = {createServer};