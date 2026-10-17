import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  ChatMessage,
  CodeSnippet,
  FileAttachment,
  GifAttachment,
  GroupInfo,
  PeerInfo,
  ReplyPreview,
  SelfIdentity,
  StickerAttachment
} from './types';
import { StoredMessageRecord } from './history';

export interface SendPayload {
  text: string;
  code?: CodeSnippet;
  file?: FileAttachment;
  sticker?: StickerAttachment;
  gif?: GifAttachment;
  toId?: string;
  groupId?: string;
  replyTo?: ReplyPreview;
  forwarded?: boolean;
}

export interface ForwardTarget {
  toId?: string;
  groupId?: string;
}

export interface ChatPanelHost {
  self: SelfIdentity;
  getRoom(): string;
  getPeers(): PeerInfo[];
  getGroups(): GroupInfo[];
  getHistory(): StoredMessageRecord[];
  onSend(payload: SendPayload): void;
  onTyping(): void;
  onOpenFile(file: FileAttachment): Promise<void>;
  onSaveFile(file: FileAttachment): Promise<void>;
  onPickAndShareFile(toId?: string, groupId?: string): Promise<void>;
  onChangeRoom(): void;
  onChangeUsername(): void;
  onChangeAvatar(): Promise<void>;
  onSetAvatar(avatar: string): Promise<void>;
  onSetUsername(username: string): void;
  onCreateGroup(name: string, memberIds: string[]): Promise<void>;
  onAddGroupMember(groupId: string, memberId: string): Promise<void>;
  onClearHistory(): Promise<void>;
  onMessageSeen(msgId: string, fromId: string): void;
  onReact(msgId: string, emoji: string | null): void;
  onForward(msgId: string, targets: ForwardTarget[]): void;
}

function nonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

export class ChatPanel {
  private static current: ChatPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposed = false;
  private pendingDmTargetId: string | undefined;
  private host: ChatPanelHost;

  static createOrShow(context: vscode.ExtensionContext, host: ChatPanelHost): ChatPanel {
    if (ChatPanel.current && !ChatPanel.current.disposed) {
      ChatPanel.current.updateHost(host);
      ChatPanel.current.panel.reveal(vscode.ViewColumn.Beside);
      return ChatPanel.current;
    }
    const panel = vscode.window.createWebviewPanel(
      'lanCodeChat',
      'LAN Code Chat',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
      }
    );
    ChatPanel.current = new ChatPanel(panel, context, host);
    return ChatPanel.current;
  }

  static get instance(): ChatPanel | undefined {
    return ChatPanel.current && !ChatPanel.current.disposed ? ChatPanel.current : undefined;
  }

  get isVisible(): boolean {
    return !this.disposed && this.panel.visible;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    host: ChatPanelHost
  ) {
    this.panel = panel;
    this.host = host;
    this.panel.webview.html = this.renderHtml();

    this.panel.onDidDispose(() => {
      this.disposed = true;
      if (ChatPanel.current === this) {
        ChatPanel.current = undefined;
      }
    });

    this.panel.webview.onDidReceiveMessage((message) => this.onMessage(message));

    this.postMessageSafe({
      type: 'init',
      self: this.host.self,
      room: this.host.getRoom(),
      peers: this.host.getPeers(),
      groups: this.host.getGroups(),
      history: this.host.getHistory()
    });
  }

  updateHost(host: ChatPanelHost): void {
    this.host = host;
    this.postMessageSafe({
      type: 'init',
      self: host.self,
      room: host.getRoom(),
      peers: host.getPeers(),
      groups: host.getGroups(),
      history: host.getHistory()
    });
  }

  private postMessageSafe(message: unknown): void {
    if (!this.disposed) {
      try {
        this.panel.webview.postMessage(message);
      } catch {
        // webview may be disposing
      }
    }
  }

  private onMessage(message: any): void {
    if (!message || typeof message !== 'object') {
      return;
    }
    switch (message.command) {
      case 'send': {
        const targetId = message.toId && message.toId !== 'general' ? message.toId : this.pendingDmTargetId;
        this.host.onSend({
          text: message.text ?? '',
          code: message.code,
          file: message.file,
          sticker: message.sticker,
          gif: message.gif,
          toId: targetId,
          groupId: message.groupId,
          replyTo: message.replyTo
        });
        this.pendingDmTargetId = undefined;
        this.postMessageSafe({ type: 'dmTargetCleared' });
        break;
      }
      case 'messageSeen':
        if (typeof message.msgId === 'string' && typeof message.fromId === 'string') {
          this.host.onMessageSeen(message.msgId, message.fromId);
        }
        break;
      case 'react':
        if (typeof message.msgId === 'string') {
          this.host.onReact(message.msgId, typeof message.emoji === 'string' ? message.emoji : null);
        }
        break;
      case 'forward':
        if (typeof message.msgId === 'string' && Array.isArray(message.targets)) {
          this.host.onForward(message.msgId, message.targets);
        }
        break;
      case 'typing':
        this.host.onTyping();
        break;
      case 'setUsername':
        if (typeof message.username === 'string') {
          this.host.onSetUsername(message.username);
        }
        break;
      case 'createGroup':
        if (typeof message.name === 'string' && Array.isArray(message.members)) {
          this.host.onCreateGroup(message.name, message.members);
        }
        break;
      case 'addGroupMember':
        if (typeof message.groupId === 'string' && typeof message.memberId === 'string') {
          this.host.onAddGroupMember(message.groupId, message.memberId);
        }
        break;
      case 'changeAvatar':
        if (typeof message.avatar === 'string' && message.avatar) {
          this.host.onSetAvatar(message.avatar);
        } else {
          this.host.onChangeAvatar();
        }
        break;
      case 'clearHistory':
        this.host.onClearHistory();
        break;
      case 'openFile':
        if (message.file) {
          this.host.onOpenFile(message.file);
        }
        break;
      case 'saveFile':
        if (message.file) {
          this.host.onSaveFile(message.file);
        }
        break;
      case 'pickFile':
        this.host.onPickAndShareFile(message.toId ?? this.pendingDmTargetId, message.groupId);
        break;
      case 'changeRoom':
        this.host.onChangeRoom();
        break;
      case 'changeUsername':
        this.host.onChangeUsername();
        break;
      case 'insert':
        if (typeof message.code === 'string') {
          this.insertAtCursor(message.code, message.language);
        }
        break;
      case 'insertNewFile':
        if (typeof message.code === 'string') {
          this.openInNewFile(message.code, message.language);
        }
        break;
      case 'copy':
        vscode.env.clipboard.writeText(message.code ?? '');
        vscode.window.setStatusBarMessage('$(check) Snippet copied to clipboard', 2000);
        break;
      case 'ready':
        this.postMessageSafe({
          type: 'init',
          self: this.host.self,
          room: this.host.getRoom(),
          peers: this.host.getPeers(),
          groups: this.host.getGroups(),
          history: this.host.getHistory()
        });
        break;
      case 'refreshPeers':
        vscode.commands.executeCommand('lanCodeChat.refreshPeers');
        break;
      case 'cancelDm':
        this.pendingDmTargetId = undefined;
        this.postMessageSafe({ type: 'dmTargetCleared' });
        break;
    }
  }

  private async insertAtCursor(code: string, _language?: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('Open an editor first, then insert the snippet.');
      return;
    }
    try {
      await editor.edit((editBuilder) => {
        for (const selection of editor.selections) {
          editBuilder.insert(selection.active, code);
        }
      });
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to insert snippet: ${err?.message || err}`);
    }
  }

  private async openInNewFile(code: string, language?: string): Promise<void> {
    try {
      const doc = await vscode.workspace.openTextDocument({
        content: code,
        language: language || 'plaintext'
      });
      await vscode.window.showTextDocument(doc, vscode.ViewColumn.Active);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to open snippet in new file: ${err?.message || err}`);
    }
  }

  setDirectMessageTarget(peerId: string | undefined, peerName?: string): void {
    this.pendingDmTargetId = peerId;
    this.postMessageSafe({ type: 'dmTarget', peerId, peerName });
    if (!this.disposed) {
      this.panel.reveal(vscode.ViewColumn.Beside);
    }
  }

  attachCode(code: CodeSnippet): void {
    this.postMessageSafe({ type: 'attachCode', code });
    if (!this.disposed) {
      this.panel.reveal(vscode.ViewColumn.Beside);
    }
  }

  attachFile(file: FileAttachment): void {
    this.postMessageSafe({ type: 'attachFile', file });
    if (!this.disposed) {
      this.panel.reveal(vscode.ViewColumn.Beside);
    }
  }

  addMessage(msg: ChatMessage, isSelf: boolean, recipientIds?: string[]): void {
    this.postMessageSafe({ type: 'message', msg, isSelf, recipientIds });
  }

  setMessageAck(msgId: string, delivered: string[], read: string[], total: number): void {
    this.postMessageSafe({ type: 'ackUpdate', msgId, delivered, read, total });
  }

  setReactions(msgId: string, reactions: ChatMessage['reactions']): void {
    this.postMessageSafe({ type: 'reactionsUpdate', msgId, reactions });
  }

  addSystem(text: string): void {
    this.postMessageSafe({ type: 'system', text });
  }

  setPeers(peers: PeerInfo[]): void {
    this.postMessageSafe({ type: 'peersList', peers });
  }

  setGroups(groups: GroupInfo[]): void {
    this.postMessageSafe({ type: 'groupsList', groups });
  }

  setPeerCount(count: number): void {
    this.postMessageSafe({ type: 'peers', count });
  }

  showTyping(username: string, id?: string): void {
    this.postMessageSafe({ type: 'typing', username, id });
  }

  updateRoom(room: string): void {
    this.postMessageSafe({ type: 'room', room });
  }

  updateSelf(self: SelfIdentity): void {
    this.host.self = self;
    this.postMessageSafe({ type: 'selfUpdated', self });
  }

  clearHistoryView(): void {
    this.postMessageSafe({ type: 'historyCleared' });
  }

  private renderHtml(): string {
    const webview = this.panel.webview;
    const mediaUri = (file: string) =>
      webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', file)));
    const csp = nonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data: blob:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${csp}';" />
  <link rel="stylesheet" href="${mediaUri('main.css')}" />
  <title>LAN Code Chat</title>
</head>
<body>
  <div id="app">
    <!-- WhatsApp Left Sidebar: Profile & Chats List -->
    <aside id="sidebar">
      <div id="sidebar-header">
        <div id="self-profile" title="Click to edit name or change photo">
          <div id="self-avatar-container">
            <div id="self-avatar">ME</div>
            <div id="self-avatar-overlay" title="Change photo">
              <svg class="lucide" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
            </div>
          </div>
          <div id="self-info">
            <div id="self-name-row">
              <span id="self-username">Anonymous</span>
              <span id="self-edit-icon" title="Change Username">
                <svg class="lucide" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
              </span>
            </div>
            <span id="self-status">● Online on LAN</span>
          </div>
        </div>
        <div id="sidebar-actions">
          <button id="btn-new-group" class="icon-btn" title="Create New Group">
            <svg class="lucide" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
          </button>
          <button id="btn-change-room" class="icon-btn" title="Change Room Passphrase">
            <svg class="lucide" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>
          </button>
        </div>
      </div>

      <!-- Hidden avatar file picker -->
      <input type="file" id="avatar-file-picker" accept="image/*" class="hidden" />

      <!-- Room banner -->
      <div id="room-banner">
        <div class="room-pill-inner">
          <span class="room-label">ROOM:</span>
          <span id="room-name">general</span>
        </div>
        <span id="e2e-badge" title="End-to-End Encrypted">
          <svg class="lucide" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Encrypted
        </span>
      </div>

      <!-- Peer Search -->
      <div id="search-box">
        <div class="search-input-wrapper">
          <svg class="lucide search-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" id="peer-search" placeholder="Search chats or peers…" />
        </div>
      </div>

      <!-- Chats List -->
      <div id="chats-list">
        <div class="section-divider">ROOMS &amp; GROUPS</div>
        <!-- General Room Group -->
        <div class="chat-item active" id="chat-item-general" data-target="general">
          <div class="chat-avatar group-avatar">
            <svg class="lucide" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>
          </div>
          <div class="chat-item-content">
            <div class="chat-item-top">
              <span class="chat-title">#general (Everyone)</span>
              <span class="chat-badge" id="general-peer-count">0 online</span>
            </div>
            <div class="chat-item-sub">Public LAN room · All peers receive messages</div>
          </div>
        </div>

        <!-- Custom Groups Container -->
        <div id="custom-groups-list"></div>

        <div class="section-divider">DIRECT MESSAGES (1-ON-1)</div>
        <div id="direct-peers-list">
          <div class="no-peers-msg">Discovering peers on your Wi-Fi/LAN…</div>
        </div>
      </div>
    </aside>

    <!-- WhatsApp Active Chat Pane -->
    <section id="main-chat">
      <header id="chat-header">
        <button id="btn-back" class="icon-btn" title="Back to chats">
          <svg class="lucide" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        </button>
        <div id="active-chat-avatar">
          <svg class="lucide" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>
        </div>
        <div id="active-chat-info" title="Click to view group info & members">
          <div id="active-chat-title">#general (Everyone)</div>
          <div id="active-chat-sub">Public LAN Room · 0 online (click for info)</div>
        </div>
        <div id="header-right">
          <button id="btn-group-info" class="icon-btn" title="View Group Members & Info">
            <svg class="lucide" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </button>
          <button id="btn-refresh-peers" class="icon-btn" title="Refresh Peers">
            <svg class="lucide" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
          </button>
        </div>
      </header>

      <!-- Messages Window -->
      <main id="messages">
        <div class="e2e-notice">
          <svg class="lucide" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>Messages and media are end-to-end encrypted with your room passphrase. Persisted locally on your device.</span>
        </div>
      </main>

      <!-- Typing Indicator -->
      <div id="typing-indicator" class="hidden">
        <span class="typing-dots"><span></span><span></span><span></span></span>
        <span id="typing-text">someone is typing…</span>
      </div>

      <!-- Reply Preview Bar -->
      <div id="reply-bar" class="hidden">
        <div id="reply-bar-accent"></div>
        <div id="reply-bar-content">
          <div id="reply-bar-name"></div>
          <div id="reply-bar-text"></div>
        </div>
        <button id="reply-bar-close" title="Cancel reply">&times;</button>
      </div>

      <!-- Attachment Preview Drawer -->
      <div id="attachment-drawer" class="hidden">
        <div id="attachment-header">
          <span id="attachment-title">Attached item</span>
          <button id="attachment-close" title="Remove attachment">&times;</button>
        </div>
        <div id="attachment-content"></div>
      </div>

      <!-- WhatsApp Composer -->
      <footer id="composer">
        <div id="attach-dropdown-wrapper">
          <button id="attach-btn" class="composer-icon-btn" title="Share Document, PDF, Image or Code">
            <svg class="lucide" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </button>
          <div id="attach-menu" class="hidden">
            <div class="attach-item" id="attach-doc-btn">
              <div class="attach-icon doc-color">
                <svg class="lucide" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
              </div>
              <span>Document / PDF</span>
            </div>
            <div class="attach-item" id="attach-img-btn">
              <div class="attach-icon img-color">
                <svg class="lucide" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
              </div>
              <span>Photo / Media</span>
            </div>
            <div class="attach-item" id="attach-code-btn">
              <div class="attach-icon code-color">
                <svg class="lucide" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
              </div>
              <span>Code Snippet</span>
            </div>
          </div>
        </div>

        <input type="file" id="file-picker" class="hidden" multiple />
        <input type="file" id="gif-picker" class="hidden" accept="image/gif" />

        <div id="sticker-dropdown-wrapper">
          <button id="sticker-btn" class="composer-icon-btn" title="Stickers &amp; GIFs">
            <svg class="lucide" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9" y1="9" y2="9"/><line x1="15" x2="15" y1="9" y2="9"/></svg>
          </button>
          <div id="sticker-panel" class="hidden">
            <div id="sticker-panel-tabs">
              <button class="sticker-tab active" data-tab="stickers">Stickers</button>
              <button class="sticker-tab" data-tab="gifs">GIFs</button>
            </div>
            <div id="sticker-search-wrapper" class="sticker-tab-content">
              <input type="text" id="sticker-search" placeholder="Search stickers &amp; GIFs…" />
            </div>
            <div id="sticker-grid" class="sticker-tab-content"></div>
            <div id="gif-tab-content" class="sticker-tab-content hidden">
              <div id="gif-grid"></div>
              <button id="gif-upload-link" class="gif-upload-link" type="button">Or upload your own GIF file…</button>
            </div>
          </div>
        </div>

        <div id="input-container">
          <textarea id="input" placeholder="Type a message… (Shift+Enter for newline)" rows="1"></textarea>
        </div>

        <button id="send-btn" class="send-circle-btn" title="Send (Enter)">
          <svg class="lucide" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
        </button>
      </footer>
    </section>

    <!-- Group Info & Members Drawer -->
    <div id="group-info-drawer" class="hidden">
      <div class="drawer-header">
        <button id="btn-close-group-info" class="icon-btn" title="Close">
          <svg class="lucide" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
        <h3>Group Info &amp; Members</h3>
      </div>
      <div class="drawer-body">
        <div class="group-hero">
          <div class="group-hero-avatar" id="group-hero-avatar-el">
            <svg class="lucide" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>
          </div>
          <h2 id="group-info-name">#general</h2>
          <p id="group-info-counts">0 online · 0 total members</p>
        </div>

        <div class="group-card">
          <h4>
            <svg class="lucide" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
            Room Security
          </h4>
          <p>End-to-end encrypted with your room passphrase. Messages are only visible to peers in this room/group.</p>
        </div>

        <div class="group-card" id="group-members-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
            <h4>Members (<span id="member-total-count">0</span>)</h4>
            <button id="btn-add-member-to-group" class="small-action-btn hidden" title="Add peer to this group">
              <svg class="lucide" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
              Add Member
            </button>
          </div>
          <!-- Dropdown/picker for adding peers to custom group -->
          <div id="add-member-dropdown" class="add-member-picker hidden">
            <div style="font-size:0.8em; color:var(--wa-subtext); margin-bottom:6px;">Select peer on LAN to add:</div>
            <div id="add-member-peer-list"></div>
          </div>
          <div id="group-members-list">
            <!-- Rendered members -->
          </div>
        </div>

        <div class="group-card">
          <h4>History &amp; Data</h4>
          <div id="clear-history-idle">
            <button id="btn-clear-history" class="danger-btn">
              <svg class="lucide" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
              Clear Chat History
            </button>
          </div>
          <div id="clear-history-confirm-box" class="confirm-box hidden">
            <p style="font-size:0.85em; color:#fca5a5; margin:0 0 8px 0;">Delete all saved chat messages on this device? This cannot be undone.</p>
            <div style="display:flex; gap:8px;">
              <button id="btn-confirm-clear-yes" class="danger-btn-solid">Yes, Clear All</button>
              <button id="btn-confirm-clear-no" class="btn-secondary" style="padding:6px 12px; font-size:0.85em;">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Group Modal -->
    <div id="create-group-modal" class="modal-overlay hidden">
      <div class="modal-card">
        <div class="modal-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <svg class="lucide" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--wa-teal)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <h3 class="modal-title">Create New Group</h3>
          </div>
          <button id="btn-close-create-group" class="icon-btn" title="Close">
            <svg class="lucide" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="group-name-input">Group Name / Subject</label>
            <input type="text" id="group-name-input" placeholder="e.g. Frontend Team, Bug Squashers" maxlength="30" />
          </div>
          <div class="form-group">
            <label>Select Initial Members (Peers on LAN)</label>
            <div id="create-group-peer-list" class="peer-checklist">
              <div class="no-peers-msg">No other peers online to add yet. You can still create the group and add members later!</div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button id="btn-cancel-create-group" class="btn-secondary">Cancel</button>
          <button id="btn-submit-create-group" class="btn-primary">Create Group</button>
        </div>
      </div>
    </div>

    <!-- Profile Preview Modal -->
    <div id="profile-modal" class="modal-overlay hidden">
      <div class="modal-card profile-card">
        <div class="modal-header">
          <h3 class="modal-title">Profile</h3>
          <button id="btn-close-profile" class="icon-btn" title="Close">
            <svg class="lucide" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div class="modal-body" style="align-items:center; text-align:center;">
          <div id="profile-modal-avatar" class="profile-modal-avatar"></div>
          <h2 id="profile-modal-name"></h2>
          <p id="profile-modal-status"></p>
          <p id="profile-modal-address"></p>
        </div>
        <div class="modal-footer">
          <button id="btn-profile-message" class="btn-primary">Message</button>
        </div>
      </div>
    </div>

    <!-- Forward Message Modal -->
    <div id="forward-modal" class="modal-overlay hidden">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Forward Message</h3>
          <button id="btn-close-forward" class="icon-btn" title="Close">
            <svg class="lucide" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Select chats to forward to</label>
            <div id="forward-target-list" class="peer-checklist"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button id="btn-cancel-forward" class="btn-secondary">Cancel</button>
          <button id="btn-submit-forward" class="btn-primary">Forward</button>
        </div>
      </div>
    </div>

    <!-- Message Info Modal (delivered / read receipts) -->
    <div id="msg-info-modal" class="modal-overlay hidden">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">Message Info</h3>
          <button id="btn-close-msg-info" class="icon-btn" title="Close">
            <svg class="lucide" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="msg-info-section">
            <h4>Read</h4>
            <div id="msg-info-read-list" class="msg-info-list"></div>
          </div>
          <div class="msg-info-section">
            <h4>Delivered</h4>
            <div id="msg-info-delivered-list" class="msg-info-list"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Reaction Picker Popup -->
    <div id="reaction-picker" class="hidden">
      <div id="reaction-picker-quick"></div>
    </div>

    <!-- Drag & Drop Overlay -->
    <div id="drop-overlay" class="hidden">
      <div class="drop-modal">
        <div class="drop-icon">
          <svg class="lucide" viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--wa-teal)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m8 16 4-4 4 4"/></svg>
        </div>
        <h3>Drop files or PDF here</h3>
        <p>They will be shared instantly in this chat</p>
      </div>
    </div>
  </div>

  <script nonce="${csp}" src="${mediaUri('main.js')}"></script>
</body>
</html>`;
  }

  dispose(): void {
    this.panel.dispose();
  }
}
