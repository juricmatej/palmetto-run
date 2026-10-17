// Cloudflare Worker: serves the game from dist/ and runs the multiplayer lobby.
// Players connect to /ws. The Lobby Durable Object relays each player's presence
// (position, vehicle, shots, ...) to everyone else. Game rules stay in the clients;
// the server only forwards small JSON objects. ?room= picks the object, so each code
// is its own city with the same rules and limits.
import { DurableObject } from 'cloudflare:workers';

const MAX_PLAYERS = 32;
const MAX_MESSAGE = 8192; // bytes; the game sends well under this

export class Lobby extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.state = new Map(); // peer id -> latest presence
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    if (this.ctx.getWebSockets().length >= MAX_PLAYERS) return new Response('The lobby is full', { status: 503 });
    const { 0: client, 1: server } = new WebSocketPair();
    const peer = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ peer });
    const peers = [];
    for (const ws of this.ctx.getWebSockets()) {
      const other = ws.deserializeAttachment()?.peer;
      if (other && other !== peer && this.state.has(other)) peers.push({ peer: other, d: this.state.get(other) });
    }
    server.send(JSON.stringify({ t: 'hello', peer, peers }));
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, message) {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE) return;
    let m;
    try { m = JSON.parse(message); } catch { return; }
    if (!m || m.t !== 'p' || !m.d || typeof m.d !== 'object' || Array.isArray(m.d)) return;
    const peer = ws.deserializeAttachment()?.peer;
    if (!peer) return;
    this.state.set(peer, m.d);
    this.broadcast(ws, JSON.stringify({ t: 'p', peer, d: m.d }));
  }

  webSocketClose(ws, code) { this.leave(ws); try { ws.close(code, 'bye'); } catch {} }
  webSocketError(ws) { this.leave(ws); }

  leave(ws) {
    const peer = ws.deserializeAttachment()?.peer;
    if (!peer) return;
    this.state.delete(peer);
    this.broadcast(ws, JSON.stringify({ t: 'leave', peer }));
  }

  broadcast(from, text) {
    for (const ws of this.ctx.getWebSockets()) if (ws !== from) { try { ws.send(text); } catch {} }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      const raw = (url.searchParams.get('room') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
      const room = raw || 'main';
      return env.LOBBY.get(env.LOBBY.idFromName(room)).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
