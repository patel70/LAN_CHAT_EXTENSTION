import * as dgram from 'dgram';
import * as os from 'os';
import { EventEmitter } from 'events';
import { AnnouncePacket, SelfIdentity } from './types';

function broadcastAddresses(): string[] {
  const out = new Set<string>(['255.255.255.255']);
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const info of ifaces[name] || []) {
      if (info.family !== 'IPv4' || info.internal) {
        continue;
      }
      const ipParts = info.address.split('.').map(Number);
      const maskParts = info.netmask.split('.').map(Number);
      if (ipParts.length !== 4 || maskParts.length !== 4) {
        continue;
      }
      const bcastParts = ipParts.map((p, i) => (p & maskParts[i]) | (~maskParts[i] & 0xff));
      out.add(bcastParts.join('.'));
    }
  }
  return Array.from(out);
}

export interface DiscoveredAnnounce {
  packet: AnnouncePacket;
  address: string;
}

/**
 * Broadcasts "I'm here" over UDP on the LAN and listens for the same from
 * everyone else. This is the whole "server" this extension needs — no
 * central host, no sign-up, just whoever's on the same Wi-Fi/switch.
 */
export class DiscoveryManager extends EventEmitter {
  private socket: dgram.Socket | undefined;
  private announceTimer: NodeJS.Timeout | undefined;
  private initialTimeout: NodeJS.Timeout | undefined;
  private restartTimeout: NodeJS.Timeout | undefined;
  private isListening = false;
  private stopped = false;
  private lastIfaceSignature = '';
  private ifaceWatchTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly port: number,
    private readonly announceIntervalMs: number,
    private readonly getAnnouncePacket: () => AnnouncePacket
  ) {
    super();
  }

  start(): void {
    this.stopped = false;
    this.bindSocket();

    if (!this.announceTimer) {
      this.announceTimer = setInterval(() => this.sendAnnounce(), this.announceIntervalMs);
    }
    // Fire one immediately instead of waiting a full interval.
    this.initialTimeout = setTimeout(() => this.sendAnnounce(), 250);

    // Detect NIC changes (cable unplugged/replugged, switching Wi-Fi <-> Ethernet,
    // adapter re-enabled, new DHCP lease, etc.) so we can immediately re-announce
    // and let peers rediscover each other instead of waiting out a stale socket.
    this.lastIfaceSignature = this.computeIfaceSignature();
    if (!this.ifaceWatchTimer) {
      this.ifaceWatchTimer = setInterval(() => this.checkIfaceChange(), 2000);
    }
  }

  private bindSocket(): void {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.socket = socket;
    this.isListening = false;

    socket.on('error', (err) => {
      this.emit('error', err);
      // The socket is now unusable (e.g. the network adapter went down or the
      // interface it was bound to disappeared). Tear it down and rebind on a
      // short delay instead of silently going dark for the rest of the session.
      this.isListening = false;
      try {
        socket.close();
      } catch {
        // already closed
      }
      this.scheduleRestart();
    });

    socket.on('close', () => {
      this.isListening = false;
      if (!this.stopped) {
        this.scheduleRestart();
      }
    });

    socket.on('message', (msg, rinfo) => {
      try {
        const packet = JSON.parse(msg.toString('utf8')) as AnnouncePacket;
        if (packet && packet.type === 'announce' && packet.id) {
          this.emit('announce', { packet, address: rinfo.address } as DiscoveredAnnounce);
        }
      } catch {
        // Not one of ours (or malformed) — ignore silently, LANs are noisy.
      }
    });

    socket.on('listening', () => {
      this.isListening = true;
      try {
        socket.setBroadcast(true);
      } catch {
        // If broadcast setting fails, socket will still attempt best-effort
      }
    });

    try {
      socket.bind(this.port);
    } catch {
      this.scheduleRestart();
    }
  }

  private scheduleRestart(): void {
    if (this.stopped || this.restartTimeout) {
      return;
    }
    this.restartTimeout = setTimeout(() => {
      this.restartTimeout = undefined;
      if (!this.stopped) {
        this.bindSocket();
      }
    }, 2000);
  }

  private computeIfaceSignature(): string {
    const ifaces = os.networkInterfaces();
    const parts: string[] = [];
    for (const name of Object.keys(ifaces).sort()) {
      for (const info of ifaces[name] || []) {
        if (info.family === 'IPv4' && !info.internal) {
          parts.push(`${name}:${info.address}/${info.netmask}`);
        }
      }
    }
    return parts.sort().join(',');
  }

  private checkIfaceChange(): void {
    const sig = this.computeIfaceSignature();
    if (sig !== this.lastIfaceSignature) {
      this.lastIfaceSignature = sig;
      // New IP/adapter — announce right away on the new interface and let the
      // next heartbeat cycle re-establish any mesh links that dropped.
      this.sendAnnounce();
      if (!this.isListening) {
        this.scheduleRestart();
      }
    }
  }

  triggerAnnounce(): void {
    this.sendAnnounce();
  }

  private sendAnnounce(): void {
    if (!this.socket || !this.isListening) {
      return;
    }
    try {
      const packet = this.getAnnouncePacket();
      const payload = Buffer.from(JSON.stringify(packet), 'utf8');
      for (const addr of broadcastAddresses()) {
        try {
          this.socket.send(payload, this.port, addr, () => {
            // Best-effort; some interfaces (e.g. VPN virtual adapters) may refuse
            // broadcast and that's fine, other interfaces will carry it.
          });
        } catch {
          // Ignore synchronous send errors on disabled / virtual interfaces
        }
      }
    } catch {
      // Best-effort
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.initialTimeout) {
      clearTimeout(this.initialTimeout);
      this.initialTimeout = undefined;
    }
    if (this.announceTimer) {
      clearInterval(this.announceTimer);
      this.announceTimer = undefined;
    }
    if (this.ifaceWatchTimer) {
      clearInterval(this.ifaceWatchTimer);
      this.ifaceWatchTimer = undefined;
    }
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = undefined;
    }
    this.isListening = false;
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // Socket may already be closed
      }
      this.socket = undefined;
    }
  }
}
