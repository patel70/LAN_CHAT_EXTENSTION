export interface SelfIdentity {
  id: string;
  username: string;
  color: string;
  avatar?: string; // base64 data url thumbnail
}

export interface CodeSnippet {
  language: string;
  code: string;
  fileName?: string;
}

export interface FileAttachment {
  name: string;
  size: number;
  mimeType: string;
  data: string; // base64 data uri or base64 string
}

export interface StickerAttachment {
  emoji: string;
}

export interface GifAttachment {
  key: string; // references a built-in animated GIF-style reaction known to both ends
}

export interface ReplyPreview {
  msgId: string;
  fromName: string;
  text: string; // short plain-text preview of the quoted message
}

export interface ReactionEntry {
  emoji: string;
  by: string[]; // peer ids who reacted with this emoji
}

export interface GroupInfo {
  id: string; // "grp-uuid"
  name: string;
  members: string[]; // member peer IDs (including selfId)
  createdBy: string; // peer ID
  createdAt: number;
}

export interface ChatMessage {
  msgId: string;
  fromId: string;
  fromName: string;
  color: string;
  avatar?: string;
  text: string;
  code?: CodeSnippet;
  file?: FileAttachment;
  sticker?: StickerAttachment;
  gif?: GifAttachment;
  replyTo?: ReplyPreview;
  forwarded?: boolean;
  reactions?: ReactionEntry[];
  toId?: string; // present for direct messages
  groupId?: string; // present for custom groups; undefined for #general public room
  ts: number;
}

export interface AnnouncePacket {
  type: 'announce';
  id: string;
  username: string;
  color: string;
  avatar?: string;
  wsPort: number;
  roomHash: string;
  ts: number;
}

export interface PeerInfo {
  id: string;
  username: string;
  color: string;
  avatar?: string;
  address: string;
  wsPort: number;
  roomHash: string;
  sameRoom: boolean;
  lastSeen: number;
  connected: boolean;
}

export type WirePayload =
  | { kind: 'hello'; id: string; username: string; color: string; avatar?: string }
  | { kind: 'chat'; msg: ChatMessage }
  | { kind: 'typing'; id: string; username: string }
  | { kind: 'profileUpdate'; id: string; username: string; avatar?: string }
  | { kind: 'nameChange'; id: string; username: string }
  | { kind: 'groupUpdate'; group: GroupInfo; actorName: string; action: 'created' | 'memberAdded' | 'memberRemoved' }
  | { kind: 'ack'; msgId: string; by: string; status: 'delivered' | 'read' }
  | { kind: 'reaction'; msgId: string; emoji: string; by: string; action: 'set' | 'clear' }
  | { kind: 'bye'; id: string };
