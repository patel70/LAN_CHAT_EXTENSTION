import * as vscode from 'vscode';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getSelfIdentity, setSelfAvatar, setSelfUsername } from './identity';
import { deriveRoomKey, roomHash } from './crypto';
import { DiscoveryManager } from './discovery';
import { NetworkManager } from './network';
import { PeerTreeProvider } from './peerProvider';
import { ChatPanel, ForwardTarget, SendPayload } from './chatPanel';
import { ChatHistoryManager } from './history';
import { GroupManager } from './groups';
import { AnnouncePacket, ChatMessage, CodeSnippet, FileAttachment, GroupInfo, PeerInfo, SelfIdentity } from './types';

let discovery: DiscoveryManager | undefined;
let network: NetworkManager | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let pruneTimer: NodeJS.Timeout | undefined;
let historyManager: ChatHistoryManager | undefined;
let groupManager: GroupManager | undefined;

interface SentTracking {
  recipientIds: string[];
  delivered: Set<string>;
  read: Set<string>;
}
const sentTracking = new Map<string, SentTracking>();

function config() {
  return vscode.workspace.getConfiguration('lanCodeChat');
}

function currentRoom(): string {
  return config().get<string>('room', 'general') || 'general';
}

function updateStatusBar(peerProvider: PeerTreeProvider): void {
  if (!statusBarItem) {
    return;
  }
  const allPeers = peerProvider.all();
  const connected = allPeers.filter((p) => p.connected).length;
  statusBarItem.text = `$(radio-tower) LAN Chat: ${connected}`;
  statusBarItem.tooltip = connected > 0
    ? `${connected} peer(s) connected in room "${currentRoom()}" — click to open chat`
    : `No peers connected yet in room "${currentRoom()}" — click to open chat`;
  ChatPanel.instance?.setPeerCount(connected);
  ChatPanel.instance?.setPeers(allPeers);
}

function languageForDocument(doc: vscode.TextDocument): string {
  return doc.languageId || 'plaintext';
}

function capSnippet(code: string, maxChars = 20000): string {
  if (code.length <= maxChars) {
    return code;
  }
  return code.slice(0, maxChars) + `\n\n/* …truncated, ${code.length - maxChars} more characters not sent… */`;
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp'
};

function guessMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

function parseDataUri(dataUri: string): Buffer {
  const commaIndex = dataUri.indexOf(',');
  const base64Str = commaIndex !== -1 ? dataUri.slice(commaIndex + 1) : dataUri;
  return Buffer.from(base64Str, 'base64');
}

export function activate(context: vscode.ExtensionContext): void {
  const self: SelfIdentity = getSelfIdentity(context);
  const peerProvider = new PeerTreeProvider();
  historyManager = new ChatHistoryManager(context);
  groupManager = new GroupManager(context, self.id);

  // Preload saved persistent history and groups
  historyManager.load().catch((err) => console.error('Failed to preload chat history:', err));
  groupManager.load().catch((err) => console.error('Failed to preload groups:', err));

  vscode.window.registerTreeDataProvider('lanCodeChat.peers', peerProvider);
  context.subscriptions.push(peerProvider);

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'lanCodeChat.openChat';
  statusBarItem.text = '$(radio-tower) LAN Chat: 0';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  let roomKey = deriveRoomKey(currentRoom());
  network = new NetworkManager(self, roomKey, config().get<number>('wsPortRangeStart', 54560));

  // Guard against unhandled EventEmitter errors crashing the Extension Host
  network.on('error', (err) => {
    console.error('LAN Code Chat network error:', err);
  });

  const dedupSeen = new Set<string>();
  const seenCap: string[] = [];
  function alreadySeen(msgId: string): boolean {
    if (dedupSeen.has(msgId)) {
      return true;
    }
    dedupSeen.add(msgId);
    seenCap.push(msgId);
    if (seenCap.length > 500) {
      const old = seenCap.shift();
      if (old) dedupSeen.delete(old);
    }
    return false;
  }

  network.on('peerConnected', ({ id, username, avatar }: { id: string; username: string; color?: string; avatar?: string }) => {
    peerProvider.setConnected(id, true);
    if (avatar) {
      peerProvider.updateAvatar(id, avatar);
    }
    updateStatusBar(peerProvider);
    ChatPanel.instance?.addSystem(`${username} joined the room.`);
  });

  network.on('peerDisconnected', (id: string) => {
    const peer = peerProvider.get(id);
    peerProvider.setConnected(id, false);
    updateStatusBar(peerProvider);
    if (peer) {
      ChatPanel.instance?.addSystem(`${peer.username} left the room.`);
    }
  });

  network.on('peerNameChanged', ({ id, username }: { id: string; username: string }) => {
    peerProvider.updateUsername(id, username);
    updateStatusBar(peerProvider);
    ChatPanel.instance?.setPeers(peerProvider.all());
    ChatPanel.instance?.addSystem(`Peer changed display name to "${username}".`);
  });

  network.on('peerProfileUpdated', ({ id, username, avatar }: { id: string; username: string; avatar?: string }) => {
    peerProvider.updateUsername(id, username);
    peerProvider.updateAvatar(id, avatar);
    updateStatusBar(peerProvider);
    ChatPanel.instance?.setPeers(peerProvider.all());
  });

  network.on('groupUpdate', ({ group, actorName, action }: { group: GroupInfo; actorName: string; action: 'created' | 'memberAdded' | 'memberRemoved' }) => {
    if (group.members.includes(self.id)) {
      groupManager?.upsert(group);
      ChatPanel.instance?.setGroups(groupManager?.getAll() || []);
      let notice = '';
      if (action === 'created') {
        notice = `${actorName} created group "${group.name}".`;
      } else if (action === 'memberAdded') {
        notice = `${actorName} added member(s) to group "${group.name}".`;
      } else {
        notice = `Group "${group.name}" was updated by ${actorName}.`;
      }
      ChatPanel.instance?.addSystem(notice);
    }
  });

  network.on('message', (msg: ChatMessage) => {
    if (!msg || !msg.msgId || alreadySeen(msg.msgId)) {
      return;
    }
    if (msg.groupId) {
      const grp = groupManager?.get(msg.groupId);
      if (!grp || !grp.members.includes(self.id)) {
        return; // Not a member of this group
      }
    }
    // Save to persistent storage
    historyManager?.addMessage(msg, false);

    // Acknowledge receipt immediately so the sender's tick marks update,
    // same idea as WhatsApp's single/double-tick delivery receipts.
    network?.sendAck(msg.fromId, msg.msgId, 'delivered');

    ChatPanel.instance?.addMessage(msg, false);
    const panelFocused = ChatPanel.instance?.isVisible;
    if (!panelFocused && config().get<boolean>('notifyOnMessage', true)) {
      const preview = msg.sticker
        ? `sent a sticker ${msg.sticker.emoji}`
        : msg.gif
        ? 'sent a GIF'
        : msg.file
        ? `sent file ${msg.file.name}`
        : msg.text || (msg.code ? `sent a ${msg.code.language} snippet` : 'sent a message');
      vscode.window.showInformationMessage(`${msg.fromName}: ${preview}`, 'Open Chat').then((pick) => {
        if (pick === 'Open Chat') {
          vscode.commands.executeCommand('lanCodeChat.openChat');
        }
      });
    }
  });

  network.on('typing', ({ username, id }: { username: string; id: string }) => {
    ChatPanel.instance?.showTyping(username, id);
  });

  network.on('ack', ({ msgId, by, status }: { msgId: string; by: string; status: 'delivered' | 'read' }) => {
    const tracking = sentTracking.get(msgId);
    if (!tracking) {
      return;
    }
    tracking.delivered.add(by);
    if (status === 'read') {
      tracking.read.add(by);
    }
    ChatPanel.instance?.setMessageAck(
      msgId,
      Array.from(tracking.delivered),
      Array.from(tracking.read),
      tracking.recipientIds.length
    );
  });

  network.on('reaction', ({ msgId, emoji, by, action }: { msgId: string; emoji: string; by: string; action: 'set' | 'clear' }) => {
    applyReaction(msgId, emoji, by, action);
  });

  discovery = new DiscoveryManager(
    config().get<number>('discoveryPort', 54545),
    config().get<number>('announceIntervalMs', 3000),
    (): AnnouncePacket => ({
      type: 'announce',
      id: self.id,
      username: self.username,
      color: self.color,
      wsPort: network ? network.boundPort : 0,
      roomHash: roomHash(currentRoom()),
      ts: Date.now()
    })
  );

  discovery.on('error', (err) => {
    console.error('LAN Code Chat discovery error:', err);
  });

  discovery.on('announce', ({ packet, address }) => {
    if (packet.id === self.id) {
      return;
    }
    const sameRoom = packet.roomHash === roomHash(currentRoom());
    const existing = peerProvider.get(packet.id);
    const peer: PeerInfo = {
      id: packet.id,
      username: packet.username,
      color: packet.color,
      avatar: existing?.avatar || packet.avatar,
      address,
      wsPort: packet.wsPort,
      roomHash: packet.roomHash,
      sameRoom,
      lastSeen: Date.now(),
      connected: existing?.connected ?? false
    };
    peerProvider.upsert(peer);
    ChatPanel.instance?.setPeers(peerProvider.all());
    if (sameRoom && network && network.boundPort > 0) {
      network.connectToPeer(peer);
    }
  });

  network.start().then((port) => {
    vscode.window.setStatusBarMessage(`LAN Code Chat listening on port ${port}`, 3000);
    discovery?.start();
  }).catch((err) => {
    vscode.window.showErrorMessage(`LAN Code Chat couldn't open a listening socket: ${err.message}`);
  });

  pruneTimer = setInterval(() => {
    const prunedIds = peerProvider.pruneStale(config().get<number>('peerTimeoutMs', 12000));
    for (const id of prunedIds) {
      network?.disconnectPeer(id);
    }
    updateStatusBar(peerProvider);
  }, 3000);

  /** Everyone besides us who should end up with a copy of a message on this target. */
  function computeRecipientIds(toId?: string, groupId?: string): string[] {
    if (toId) {
      return [toId];
    }
    if (groupId) {
      const grp = groupManager?.get(groupId);
      return grp ? grp.members.filter((id) => id !== self.id) : [];
    }
    return peerProvider.all().filter((p) => p.sameRoom).map((p) => p.id);
  }

  function sendChat(payload: SendPayload): void {
    const msg: ChatMessage = {
      msgId: uuidv4(),
      fromId: self.id,
      fromName: self.username,
      color: self.color,
      avatar: self.avatar,
      text: payload.text,
      code: payload.code,
      file: payload.file,
      sticker: payload.sticker,
      gif: payload.gif,
      replyTo: payload.replyTo,
      forwarded: payload.forwarded,
      toId: payload.toId,
      groupId: payload.groupId,
      ts: Date.now()
    };
    dedupSeen.add(msg.msgId);

    // Save to persistent storage
    historyManager?.addMessage(msg, true);

    let memberIds: string[] | undefined;
    if (payload.groupId) {
      const grp = groupManager?.get(payload.groupId);
      if (grp) {
        memberIds = grp.members;
      }
    }

    const result = network?.broadcastMessage(msg, memberIds) ?? { delivered: false, recipientCount: 0 };
    if (payload.toId && !result.delivered) {
      vscode.window.showWarningMessage('Direct message not delivered: peer is not currently connected.');
    }

    const recipientIds = computeRecipientIds(payload.toId, payload.groupId);
    if (recipientIds.length > 0) {
      sentTracking.set(msg.msgId, { recipientIds, delivered: new Set(), read: new Set() });
    }

    ChatPanel.instance?.addMessage(msg, true, recipientIds);
  }

  /** Mutates the stored message's reaction list and tells the panel to re-render it. */
  function applyReaction(msgId: string, emoji: string, by: string, action: 'set' | 'clear'): void {
    const msg = historyManager?.findMessage(msgId);
    if (!msg) {
      return;
    }
    let reactions = msg.reactions ?? [];
    for (const entry of reactions) {
      entry.by = entry.by.filter((id) => id !== by);
    }
    reactions = reactions.filter((entry) => entry.by.length > 0);
    if (action === 'set' && emoji) {
      let entry = reactions.find((e) => e.emoji === emoji);
      if (!entry) {
        entry = { emoji, by: [] };
        reactions.push(entry);
      }
      entry.by.push(by);
    }
    msg.reactions = reactions;
    historyManager?.touch();
    ChatPanel.instance?.setReactions(msgId, reactions);
  }

  function handleMessageSeen(msgId: string, fromId: string): void {
    network?.sendAck(fromId, msgId, 'read');
  }

  function handleReact(msgId: string, emoji: string | null): void {
    const msg = historyManager?.findMessage(msgId);
    if (!msg) {
      return;
    }
    const action: 'set' | 'clear' = emoji ? 'set' : 'clear';
    applyReaction(msgId, emoji ?? '', self.id, action);
    const recipientIds = computeRecipientIds(
      msg.toId ? (msg.fromId === self.id ? msg.toId : msg.fromId) : undefined,
      msg.groupId
    );
    network?.sendReaction(msgId, emoji ?? '', action, recipientIds);
  }

  function handleForward(msgId: string, targets: ForwardTarget[]): void {
    const original = historyManager?.findMessage(msgId);
    if (!original) {
      return;
    }
    for (const target of targets) {
      sendChat({
        text: original.text,
        code: original.code,
        file: original.file,
        sticker: original.sticker,
        gif: original.gif,
        toId: target.toId,
        groupId: target.groupId,
        forwarded: true
      });
    }
  }

  async function handleOpenFile(file: FileAttachment): Promise<void> {
    try {
      const storageDir = context.globalStorageUri;
      const cacheDir = vscode.Uri.joinPath(storageDir, 'received_files');
      await vscode.workspace.fs.createDirectory(cacheDir);
      const fileUri = vscode.Uri.joinPath(cacheDir, file.name);
      const buffer = parseDataUri(file.data);
      await vscode.workspace.fs.writeFile(fileUri, buffer);

      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        try {
          await vscode.commands.executeCommand('vscode.open', fileUri);
        } catch {
          await vscode.env.openExternal(fileUri);
        }
      } else {
        await vscode.commands.executeCommand('vscode.open', fileUri);
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to open file ${file.name}: ${err?.message || err}`);
    }
  }

  async function handleSaveFile(file: FileAttachment): Promise<void> {
    try {
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(file.name),
        title: `Save ${file.name}`
      });
      if (!saveUri) {
        return;
      }
      const buffer = parseDataUri(file.data);
      await vscode.workspace.fs.writeFile(saveUri, buffer);
      const pick = await vscode.window.showInformationMessage(
        `Saved ${file.name}`,
        'Open File',
        'Show in File Explorer'
      );
      if (pick === 'Open File') {
        await vscode.commands.executeCommand('vscode.open', saveUri);
      } else if (pick === 'Show in File Explorer') {
        await vscode.commands.executeCommand('revealFileInOS', saveUri);
      }
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to save file: ${err?.message || err}`);
    }
  }

  async function handlePickAndShareFile(toId?: string, groupId?: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.selection && !editor.selection.isEmpty) {
      const text = editor.document.getText(editor.selection);
      const snippet: CodeSnippet = {
        language: languageForDocument(editor.document),
        code: capSnippet(text),
        fileName: path.basename(editor.document.fileName)
      };
      openChat().attachCode(snippet);
      return;
    }
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: true,
      openLabel: 'Share File(s) to LAN Chat',
      filters: {
        'All Files': ['*'],
        'PDF Documents': ['pdf'],
        'Images': ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']
      }
    });
    if (!uris || uris.length === 0) {
      return;
    }
    const files: FileAttachment[] = [];
    for (const uri of uris) {
      const data = await vscode.workspace.fs.readFile(uri);
      const fileName = path.basename(uri.fsPath);
      const mime = guessMimeType(fileName);
      const base64 = Buffer.from(data).toString('base64');
      files.push({
        name: fileName,
        size: data.byteLength,
        mimeType: mime,
        data: `data:${mime};base64,${base64}`
      });
    }
    if (files.length === 1) {
      // Single file: stage it in the composer so the user can add a caption before sending.
      openChat().attachFile(files[0]);
      return;
    }
    // Multiple files: send each immediately as its own message, like picking several
    // photos at once in WhatsApp.
    openChat();
    for (const file of files) {
      sendChat({ text: '', file, toId, groupId });
    }
  }

  async function handleCreateGroup(name: string, memberIds: string[]): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) {
      vscode.window.showWarningMessage('Group name cannot be empty.');
      return;
    }
    const members = Array.from(new Set([self.id, ...memberIds]));
    const newGroup: GroupInfo = {
      id: `grp-${uuidv4()}`,
      name: trimmed,
      members,
      createdBy: self.id,
      createdAt: Date.now()
    };
    groupManager?.upsert(newGroup);
    network?.sendGroupUpdate(newGroup, self.username, 'created');
    ChatPanel.instance?.setGroups(groupManager?.getAll() || []);
    vscode.window.showInformationMessage(`LAN Code Chat: group "${newGroup.name}" created.`);
  }

  async function handleAddGroupMember(groupId: string, memberId: string): Promise<void> {
    const group = groupManager?.addMember(groupId, memberId);
    if (group) {
      network?.sendGroupUpdate(group, self.username, 'memberAdded');
      ChatPanel.instance?.setGroups(groupManager?.getAll() || []);
      const peer = peerProvider.get(memberId);
      const peerName = peer ? peer.username : 'Peer';
      vscode.window.showInformationMessage(`LAN Code Chat: added ${peerName} to "${group.name}".`);
    }
  }

  async function handleUsernameChange(newName: string): Promise<void> {
    const trimmed = newName.trim();
    if (trimmed) {
      self.username = trimmed;
      await setSelfUsername(context, trimmed);
      network?.sendProfileUpdate(trimmed, self.avatar);
      ChatPanel.instance?.updateSelf(self);
      discovery?.triggerAnnounce();
      peerProvider.refresh();
      updateStatusBar(peerProvider);
    }
  }

  async function handleSetAvatar(avatar: string): Promise<void> {
    self.avatar = avatar;
    await setSelfAvatar(context, avatar);
    network?.sendProfileUpdate(self.username, avatar);
    ChatPanel.instance?.updateSelf(self);
    discovery?.triggerAnnounce();
    peerProvider.refresh();
  }

  async function handleChangeAvatar(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      openLabel: 'Select Profile Picture',
      filters: { Images: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }
    });
    if (uris && uris[0]) {
      const data = await vscode.workspace.fs.readFile(uris[0]);
      const mime = uris[0].fsPath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
      const base64 = Buffer.from(data).toString('base64');
      const avatarDataUrl = `data:${mime};base64,${base64}`;
      await handleSetAvatar(avatarDataUrl);
      vscode.window.showInformationMessage('LAN Code Chat: profile picture updated.');
    }
  }

  function openChat(): ChatPanel {
    return ChatPanel.createOrShow(context, {
      self,
      getRoom: currentRoom,
      getPeers: () => peerProvider.all(),
      getGroups: () => groupManager ? groupManager.getAll() : [],
      getHistory: () => historyManager ? historyManager.getMessages() : [],
      onSend: sendChat,
      onTyping: () => network?.sendTyping(),
      onOpenFile: handleOpenFile,
      onSaveFile: handleSaveFile,
      onPickAndShareFile: handlePickAndShareFile,
      onChangeRoom: () => vscode.commands.executeCommand('lanCodeChat.setRoom'),
      onChangeUsername: () => vscode.commands.executeCommand('lanCodeChat.setUsername'),
      onChangeAvatar: handleChangeAvatar,
      onSetAvatar: handleSetAvatar,
      onSetUsername: (u) => handleUsernameChange(u),
      onCreateGroup: handleCreateGroup,
      onAddGroupMember: handleAddGroupMember,
      onClearHistory: async () => {
        await historyManager?.clear();
        ChatPanel.instance?.clearHistoryView();
      },
      onMessageSeen: handleMessageSeen,
      onReact: handleReact,
      onForward: handleForward
    });
  }

  function handleRoomChange(newRoom: string): void {
    const trimmed = newRoom.trim() || 'general';
    roomKey = deriveRoomKey(trimmed);
    network?.setRoomKey(roomKey);
    network?.disconnectAll();
    peerProvider.updateRoomHash(roomHash(trimmed));
    updateStatusBar(peerProvider);
    ChatPanel.instance?.updateRoom(trimmed);
    discovery?.triggerAnnounce();
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('lanCodeChat.openChat', () => {
      openChat();
      updateStatusBar(peerProvider);
    }),

    vscode.commands.registerCommand('lanCodeChat.shareSelection', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('Open a file and select some code first.');
        return;
      }
      const text = editor.document.getText(editor.selection);
      if (!text.trim()) {
        vscode.window.showWarningMessage('Select some code to share first.');
        return;
      }
      const snippet: CodeSnippet = {
        language: languageForDocument(editor.document),
        code: capSnippet(text),
        fileName: path.basename(editor.document.fileName)
      };
      openChat().attachCode(snippet);
    }),

    vscode.commands.registerCommand('lanCodeChat.shareFile', () => {
      handlePickAndShareFile();
    }),

    vscode.commands.registerCommand('lanCodeChat.setUsername', async () => {
      const value = await vscode.window.showInputBox({
        prompt: 'Display name shown to peers on the LAN',
        value: self.username
      });
      if (value && value.trim()) {
        await config().update('username', value.trim(), vscode.ConfigurationTarget.Global);
        handleUsernameChange(value.trim());
        vscode.window.showInformationMessage(`LAN Code Chat: you're now "${self.username}".`);
      }
    }),

    vscode.commands.registerCommand('lanCodeChat.setRoom', async () => {
      const value = await vscode.window.showInputBox({
        prompt: 'Room passphrase — only peers using the exact same passphrase can read your messages',
        value: currentRoom(),
        password: false
      });
      if (value && value.trim()) {
        await config().update('room', value.trim(), vscode.ConfigurationTarget.Global);
        handleRoomChange(value.trim());
        vscode.window.showInformationMessage(`LAN Code Chat: joined room "${value.trim()}".`);
      }
    }),

    vscode.commands.registerCommand('lanCodeChat.refreshPeers', () => {
      peerProvider.refresh();
      discovery?.triggerAnnounce();
      ChatPanel.instance?.setPeers(peerProvider.all());
    }),

    vscode.commands.registerCommand('lanCodeChat.sendDirectMessage', (item) => {
      const peer: PeerInfo | undefined = item?.peer;
      if (!peer) {
        return;
      }
      if (peer.id === self.id) {
        vscode.window.showInformationMessage('You cannot direct message yourself.');
        return;
      }
      if (!peer.sameRoom) {
        vscode.window.showWarningMessage(`${peer.username} is in a different room — switch rooms to message them directly.`);
        return;
      }
      openChat().setDirectMessageTarget(peer.id, peer.username);
    }),

    vscode.commands.registerCommand('lanCodeChat.copyPeerAddress', (item) => {
      const peer: PeerInfo | undefined = item?.peer;
      if (peer) {
        vscode.env.clipboard.writeText(`${peer.address}:${peer.wsPort}`);
        vscode.window.setStatusBarMessage(`$(check) Copied ${peer.address}:${peer.wsPort}`, 2000);
      }
    }),

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('lanCodeChat.room')) {
        handleRoomChange(currentRoom());
      }
      if (e.affectsConfiguration('lanCodeChat.username')) {
        const configured = config().get<string>('username', '');
        if (configured && configured.trim()) {
          handleUsernameChange(configured.trim());
        }
      }
    })
  );
}

export function deactivate(): void {
  if (pruneTimer) {
    clearInterval(pruneTimer);
    pruneTimer = undefined;
  }
  try {
    historyManager?.flush();
  } catch {}
  try {
    groupManager?.flush();
  } catch {}
  try {
    network?.stop();
  } catch {}
  try {
    discovery?.stop();
  } catch {}
}
