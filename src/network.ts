import { EventEmitter } from 'events';
import WebSocket, { WebSocketServer } from 'ws';
import { ChatMessage, GroupInfo, PeerInfo, SelfIdentity, WirePayload } from './types';
import { decryptPayload, encryptPayload } from './crypto';

const RECONNECT_COOLDOWN_MS = 2500;
const HEARTBEAT_INTERVAL_MS = 7000;

interface Link {
  socket: WebSocket;
  direction: 'inbound' | 'outbound';
  peerId?: string;
  username?: string;
  color?: string;
  avatar?: string;
  helloSent?: boolean;
  isAlive: boolean;
}

/**
 * Owns this machine's side of the LAN mesh: one WebSocket server that peers
 * dial into, plus outbound connections we open ourselves. Every pair of
 * peers ends up with exactly one socket between them (the peer with the
 * lexicographically larger id always dials out), so an N-peer room is a
 * full mesh with N*(N-1)/2 sockets, no relay/hub required.
 */
export class NetworkManager extends EventEmitter {
  private server: WebSocketServer | undefined;
  private readonly connections = new Map<string, Link>();
  private readonly lastAttempt = new Map<string, number>();
  private pingInterval: NodeJS.Timeout | undefined;
  public boundPort = 0;

  constructor(
    private readonly self: SelfIdentity,
    private roomKey: Buffer,
    private readonly portRangeStart: number
  ) {
    super();
  }

  setRoomKey(key: Buffer): void {
    this.roomKey = key;
  }

  async start(): Promise<number> {
    const port = await this.listenOnFirstFreePort(this.portRangeStart, this.portRangeStart + 200);
    this.boundPort = port;
    return port;
  }

  private listenOnFirstFreePort(from: number, to: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const tryPort = (port: number) => {
        if (port > to) {
          reject(new Error('No free port found for LAN Code Chat'));
          return;
        }
        const server = new WebSocketServer({ port });
        server.once('error', (err: NodeJS.ErrnoException) => {
          server.removeAllListeners();
          try {
            server.close();
          } catch {}
          if (err.code === 'EADDRINUSE') {
            tryPort(port + 1);
          } else {
            reject(err);
          }
        });
        server.once('listening', () => {
          this.server = server;
          this.attachServerHandlers(server);
          resolve(port);
        });
      };
      tryPort(from);
    });
  }

  private attachServerHandlers(server: WebSocketServer): void {
    server.on('connection', (socket) => {
      const link: Link = {
        socket,
        direction: 'inbound',
        helloSent: false,
        isAlive: true
      };
      this.wireSocket(socket, link);
    });
    server.on('error', (err) => this.emit('error', err));
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    this.pingInterval = setInterval(() => {
      for (const [peerId, link] of Array.from(this.connections.entries())) {
        if (!link.isAlive) {
          try {
            link.socket.terminate();
          } catch {}
          this.dropLink(link);
          continue;
        }
        link.isAlive = false;
        try {
          link.socket.ping();
        } catch {
          this.dropLink(link);
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Called whenever discovery hears from a same-room peer. Idempotent.
   *
   * Both sides attempt to dial each other (instead of only the
   * lexicographically-larger id dialing out). This matters on real LANs:
   * a one-directional-only rule means a single blocked direction (e.g. one
   * machine's firewall refuses inbound connections while outbound is fine)
   * permanently prevents that pair from ever linking, even though the
   * *other* direction would have worked. Letting both sides try means only
   * one direction needs to succeed. The `hello` handshake below already
   * resolves the resulting race (both sockets open) by keeping one and
   * closing the redundant one, so dialing from both ends is safe.
   */
  connectToPeer(peer: PeerInfo): void {
    if (peer.id === this.self.id) {
      return;
    }
    const existing = this.connections.get(peer.id);
    if (existing) {
      if (existing.socket.readyState === WebSocket.OPEN) {
        return;
      }
      // If socket is closed/closing, remove it so we can reconnect cleanly
      this.connections.delete(peer.id);
    }
    const last = this.lastAttempt.get(peer.id) ?? 0;
    if (Date.now() - last < RECONNECT_COOLDOWN_MS) {
      return;
    }
    this.lastAttempt.set(peer.id, Date.now());

    try {
      const socket = new WebSocket(`ws://${peer.address}:${peer.wsPort}`);
      const link: Link = {
        socket,
        direction: 'outbound',
        peerId: peer.id,
        username: peer.username,
        color: peer.color,
        helloSent: false,
        isAlive: true
      };
      socket.once('open', () => this.sendHello(link));
      this.wireSocket(socket, link);
    } catch {
      // Best-effort dial
    }
  }

  private wireSocket(socket: WebSocket, link: Link): void {
    socket.on('pong', () => {
      link.isAlive = true;
    });
    socket.on('message', (data) => {
      link.isAlive = true;
      this.handleWireMessage(link, data.toString('utf8'));
    });
    socket.on('close', () => this.dropLink(link));
    socket.on('error', () => this.dropLink(link));
  }

  private dropLink(link: Link): void {
    if (link.peerId && this.connections.get(link.peerId)?.socket === link.socket) {
      this.connections.delete(link.peerId);
      this.emit('peerDisconnected', link.peerId);
    }
  }

  private sendHello(link: Link): void {
    if (link.socket.readyState === WebSocket.OPEN) {
      link.helloSent = true;
      this.sendWire(link.socket, {
        kind: 'hello',
        id: this.self.id,
        username: this.self.username,
        color: this.self.color,
        avatar: this.self.avatar
      });
    }
  }

  private sendWire(socket: WebSocket, payload: WirePayload): void {
    try {
      socket.send(encryptPayload(payload, this.roomKey));
    } catch {
      // Socket likely closing; safe to drop.
    }
  }

  private handleWireMessage(link: Link, raw: string): void {
    let payload: WirePayload;
    try {
      payload = decryptPayload<WirePayload>(raw, this.roomKey);
    } catch {
      // Wrong room passphrase (hash collision) or corrupt frame — ignore.
      return;
    }

    if (!payload || typeof payload !== 'object' || !('kind' in payload)) {
      return;
    }

    switch (payload.kind) {
      case 'hello': {
        const wasAlreadyConnected = link.peerId && this.connections.get(link.peerId)?.socket === link.socket;
        link.peerId = payload.id;
        link.username = payload.username;
        link.color = payload.color;
        link.avatar = payload.avatar;

        const existing = this.connections.get(payload.id);
        if (existing && existing.socket !== link.socket) {
          if (existing.socket.readyState === WebSocket.OPEN) {
            // Race: both sides dialed. Keep existing open socket, close this redundant one.
            try {
              link.socket.close();
            } catch {}
            return;
          }
          // Existing is dead or closing; clean it up
          try {
            existing.socket.terminate();
          } catch {}
          this.connections.delete(payload.id);
        }

        this.connections.set(payload.id, link);

        // ONLY reply with hello if this was an inbound link and we haven't sent hello yet.
        // Prevents infinite ping-pong loop!
        if (link.direction === 'inbound' && !link.helloSent) {
          this.sendHello(link);
        }

        if (!wasAlreadyConnected) {
          this.emit('peerConnected', {
            id: payload.id,
            username: payload.username,
            color: payload.color,
            avatar: payload.avatar
          });
        }
        break;
      }
      case 'chat':
        this.emit('message', payload.msg as ChatMessage);
        break;
      case 'typing':
        this.emit('typing', { id: payload.id, username: payload.username });
        break;
      case 'profileUpdate':
        if (link.peerId === payload.id) {
          link.username = payload.username;
          link.avatar = payload.avatar;
        }
        this.emit('peerProfileUpdated', {
          id: payload.id,
          username: payload.username,
          avatar: payload.avatar
        });
        break;
      case 'groupUpdate':
        this.emit('groupUpdate', {
          group: payload.group,
          actorName: payload.actorName,
          action: payload.action
        });
        break;
      case 'nameChange':
        if (link.peerId === payload.id) {
          link.username = payload.username;
        }
        this.emit('peerNameChanged', { id: payload.id, username: payload.username });
        break;
      case 'ack':
        this.emit('ack', { msgId: payload.msgId, by: payload.by, status: payload.status });
        break;
      case 'reaction':
        this.emit('reaction', { msgId: payload.msgId, emoji: payload.emoji, by: payload.by, action: payload.action });
        break;
      case 'bye':
        this.dropLink(link);
        break;
    }
  }

  broadcastMessage(msg: ChatMessage, memberIds?: string[]): { delivered: boolean; recipientCount: number } {
    if (msg.toId) {
      const link = this.connections.get(msg.toId);
      if (link && link.socket.readyState === WebSocket.OPEN) {
        this.sendWire(link.socket, { kind: 'chat', msg });
        return { delivered: true, recipientCount: 1 };
      }
      return { delivered: false, recipientCount: 0 };
    }
    const memberSet = memberIds && memberIds.length > 0 ? new Set(memberIds) : null;
    let count = 0;
    for (const [peerId, link] of this.connections.entries()) {
      if (memberSet && !memberSet.has(peerId)) {
        continue;
      }
      if (link.socket.readyState === WebSocket.OPEN) {
        this.sendWire(link.socket, { kind: 'chat', msg });
        count++;
      }
    }
    return { delivered: count > 0, recipientCount: count };
  }

  sendAck(toId: string, msgId: string, status: 'delivered' | 'read'): void {
    const link = this.connections.get(toId);
    if (link && link.socket.readyState === WebSocket.OPEN) {
      this.sendWire(link.socket, { kind: 'ack', msgId, by: this.self.id, status });
    }
  }

  sendReaction(msgId: string, emoji: string, action: 'set' | 'clear', recipientIds: string[]): void {
    for (const peerId of recipientIds) {
      const link = this.connections.get(peerId);
      if (link && link.socket.readyState === WebSocket.OPEN) {
        this.sendWire(link.socket, { kind: 'reaction', msgId, emoji, by: this.self.id, action });
      }
    }
  }

  sendGroupUpdate(group: GroupInfo, actorName: string, action: 'created' | 'memberAdded' | 'memberRemoved'): void {
    for (const link of this.connections.values()) {
      if (link.socket.readyState === WebSocket.OPEN) {
        this.sendWire(link.socket, { kind: 'groupUpdate', group, actorName, action });
      }
    }
  }

  sendTyping(): void {
    for (const link of this.connections.values()) {
      if (link.socket.readyState === WebSocket.OPEN) {
        this.sendWire(link.socket, { kind: 'typing', id: this.self.id, username: this.self.username });
      }
    }
  }

  sendNameChange(username: string): void {
    this.self.username = username;
    for (const link of this.connections.values()) {
      if (link.socket.readyState === WebSocket.OPEN) {
        this.sendWire(link.socket, { kind: 'nameChange', id: this.self.id, username });
      }
    }
  }

  sendProfileUpdate(username: string, avatar?: string): void {
    this.self.username = username;
    this.self.avatar = avatar;
    for (const link of this.connections.values()) {
      if (link.socket.readyState === WebSocket.OPEN) {
        this.sendWire(link.socket, { kind: 'profileUpdate', id: this.self.id, username, avatar });
      }
    }
  }

  disconnectAll(): void {
    for (const link of this.connections.values()) {
      if (link.socket.readyState === WebSocket.OPEN) {
        this.sendWire(link.socket, { kind: 'bye', id: this.self.id });
      }
      try {
        link.socket.close();
      } catch {}
    }
    this.connections.clear();
  }

  disconnectPeer(peerId: string): void {
    const link = this.connections.get(peerId);
    if (link) {
      if (link.socket.readyState === WebSocket.OPEN) {
        this.sendWire(link.socket, { kind: 'bye', id: this.self.id });
      }
      try {
        link.socket.close();
      } catch {}
      this.connections.delete(peerId);
      this.emit('peerDisconnected', peerId);
    }
  }

  connectedPeerIds(): string[] {
    return Array.from(this.connections.keys());
  }

  stop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
    this.disconnectAll();
    if (this.server) {
      try {
        this.server.close();
      } catch {}
      this.server = undefined;
    }
  }
}
