"use strict";

const http = require("node:http");
const {randomUUID} = require("node:crypto");

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
    if (req.url !== "/presence" || req.headers.origin !== origin) return reply(res, 403, {error: "Nicht zugelassen"});
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
      let token = data.token;
      const prior = peers.get(token);
      if (data.leave === true) {
        if (prior) peers.delete(token);
        return reply(res, 200, {ok: true});
      }
      if (typeof data.room !== "string" || !/^(welcome|vorlesung-[1-8]|team-[ab])$/.test(data.room) ||
          !pose(data.head) || ![data.left, data.right].every(p => p === null || pose(p))) {
        return reply(res, 400, {error: "Ungültige Raum- oder Positionsdaten"});
      }
      if (!prior) {
        if (peers.size >= 16) return reply(res, 503, {error: "Pilot voll"});
        token = randomUUID();
      } else if (now - prior.time < 60) return reply(res, 429, {error: "Zu viele Aktualisierungen"});
      peers.set(token, {id: prior?.id || randomUUID(), room: data.room, time: now,
        head: data.head, left: data.left, right: data.right});
      const nearby = [...peers].filter(([key, peer]) => key !== token && peer.room === data.room)
        .map(([, {id, head, left, right}]) => ({id, head, left, right}));
      reply(res, 200, {token, peers: nearby});
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