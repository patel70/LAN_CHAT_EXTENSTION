import * as vscode from 'vscode';
import { ChatMessage } from './types';

export interface StoredMessageRecord {
  msg: ChatMessage;
  isSelf: boolean;
}

const MAX_STORED_MESSAGES = 1500;
const FILE_NAME = 'lan_chat_history.json';

export class ChatHistoryManager {
  private cache: StoredMessageRecord[] = [];
  private fileUri: vscode.Uri | undefined;
  private saveTimeout: NodeJS.Timeout | undefined;
  private isLoaded = false;

  constructor(private readonly context: vscode.ExtensionContext) {}

  private async getFileUri(): Promise<vscode.Uri> {
    if (!this.fileUri) {
      await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);
      this.fileUri = vscode.Uri.joinPath(this.context.globalStorageUri, FILE_NAME);
    }
    return this.fileUri;
  }

  async load(): Promise<StoredMessageRecord[]> {
    if (this.isLoaded) {
      return this.cache;
    }
    try {
      const uri = await this.getFileUri();
      const data = await vscode.workspace.fs.readFile(uri);
      const parsed = JSON.parse(Buffer.from(data).toString('utf8'));
      if (Array.isArray(parsed)) {
        this.cache = parsed;
      }
    } catch {
      // First run or file doesn't exist yet
      this.cache = [];
    }
    this.isLoaded = true;
    return this.cache;
  }

  getMessages(): StoredMessageRecord[] {
    return this.cache;
  }

  addMessage(msg: ChatMessage, isSelf: boolean): void {
    this.cache.push({ msg, isSelf });
    if (this.cache.length > MAX_STORED_MESSAGES) {
      this.cache.shift();
    }
    this.scheduleSave();
  }

  findMessage(msgId: string): ChatMessage | undefined {
    return this.cache.find((r) => r.msg.msgId === msgId)?.msg;
  }

  /** Call after mutating a message object returned by findMessage() in place. */
  touch(): void {
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    // Debounce disk write by 500ms
    this.saveTimeout = setTimeout(() => {
      this.persist();
    }, 500);
  }

  private async persist(): Promise<void> {
    try {
      const uri = await this.getFileUri();
      const content = Buffer.from(JSON.stringify(this.cache), 'utf8');
      await vscode.workspace.fs.writeFile(uri, content);
    } catch (err) {
      console.error('Failed to persist chat history:', err);
    }
  }

  async clear(): Promise<void> {
    this.cache = [];
    try {
      const uri = await this.getFileUri();
      const content = Buffer.from(JSON.stringify([]), 'utf8');
      await vscode.workspace.fs.writeFile(uri, content);
    } catch (err) {
      console.error('Failed to clear chat history:', err);
    }
  }

  flush(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = undefined;
    }
    this.persist();
  }
}
