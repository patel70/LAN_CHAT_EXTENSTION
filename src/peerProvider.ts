import * as vscode from 'vscode';
import { PeerInfo } from './types';

export class PeerTreeItem extends vscode.TreeItem {
  constructor(public readonly peer: PeerInfo) {
    super(peer.username, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'peer';
    const lock = peer.sameRoom ? '$(lock)' : '$(unlock)';
    this.description = `${peer.address} ${lock}`;
    this.tooltip = peer.sameRoom
      ? `${peer.username} — same room, chatting live\n${peer.address}:${peer.wsPort}`
      : `${peer.username} — different room passphrase, messages are invisible to each other\n${peer.address}:${peer.wsPort}`;
    this.iconPath = new vscode.ThemeIcon(
      peer.connected ? 'circle-filled' : 'circle-outline',
      peer.sameRoom ? undefined : new vscode.ThemeColor('disabledForeground')
    );
  }
}

export class PeerTreeProvider implements vscode.TreeDataProvider<PeerTreeItem>, vscode.Disposable {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private peers = new Map<string, PeerInfo>();

  upsert(peer: PeerInfo): void {
    this.peers.set(peer.id, peer);
    this.refresh();
  }

  setConnected(id: string, connected: boolean): void {
    const peer = this.peers.get(id);
    if (peer && peer.connected !== connected) {
      peer.connected = connected;
      this.refresh();
    }
  }

  updateUsername(id: string, username: string): void {
    const peer = this.peers.get(id);
    if (peer && peer.username !== username) {
      peer.username = username;
      this.refresh();
    }
  }

  updateAvatar(id: string, avatar: string | undefined): void {
    const peer = this.peers.get(id);
    if (peer && peer.avatar !== avatar) {
      peer.avatar = avatar;
      this.refresh();
    }
  }

  updateRoomHash(newRoomHash: string): void {
    for (const peer of this.peers.values()) {
      peer.sameRoom = peer.roomHash === newRoomHash;
      if (!peer.sameRoom) {
        peer.connected = false;
      }
    }
    this.refresh();
  }

  pruneStale(timeoutMs: number): string[] {
    const now = Date.now();
    const prunedIds: string[] = [];
    for (const [id, peer] of this.peers) {
      if (now - peer.lastSeen > timeoutMs) {
        this.peers.delete(id);
        prunedIds.push(id);
      }
    }
    if (prunedIds.length > 0) {
      this.refresh();
    }
    return prunedIds;
  }

  get(id: string): PeerInfo | undefined {
    return this.peers.get(id);
  }

  all(): PeerInfo[] {
    return Array.from(this.peers.values()).sort((a, b) => a.username.localeCompare(b.username));
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: PeerTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): PeerTreeItem[] {
    return this.all().map((p) => new PeerTreeItem(p));
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}
