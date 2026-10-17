import * as vscode from 'vscode';
import { GroupInfo } from './types';

const FILE_NAME = 'lan_chat_groups.json';

export class GroupManager {
  private groups = new Map<string, GroupInfo>();
  private fileUri: vscode.Uri | undefined;
  private saveTimeout: NodeJS.Timeout | undefined;
  private isLoaded = false;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly selfId: string
  ) {}

  private async getFileUri(): Promise<vscode.Uri> {
    if (!this.fileUri) {
      await vscode.workspace.fs.createDirectory(this.context.globalStorageUri);
      this.fileUri = vscode.Uri.joinPath(this.context.globalStorageUri, FILE_NAME);
    }
    return this.fileUri;
  }

  async load(): Promise<GroupInfo[]> {
    if (this.isLoaded) {
      return this.getAll();
    }
    try {
      const uri = await this.getFileUri();
      const data = await vscode.workspace.fs.readFile(uri);
      const parsed = JSON.parse(Buffer.from(data).toString('utf8'));
      if (Array.isArray(parsed)) {
        this.groups.clear();
        for (const g of parsed) {
          if (g && g.id && g.name && Array.isArray(g.members)) {
            this.groups.set(g.id, g);
          }
        }
      }
    } catch {
      // First run or file doesn't exist yet
    }
    this.isLoaded = true;
    return this.getAll();
  }

  getAll(): GroupInfo[] {
    return Array.from(this.groups.values()).filter((g) => g.members.includes(this.selfId));
  }

  get(id: string): GroupInfo | undefined {
    return this.groups.get(id);
  }

  upsert(group: GroupInfo): void {
    if (!group.members.includes(group.createdBy)) {
      group.members.push(group.createdBy);
    }
    this.groups.set(group.id, group);
    this.scheduleSave();
  }

  addMember(groupId: string, peerId: string): GroupInfo | undefined {
    const group = this.groups.get(groupId);
    if (!group) {
      return undefined;
    }
    if (!group.members.includes(peerId)) {
      group.members.push(peerId);
      this.scheduleSave();
    }
    return group;
  }

  removeMember(groupId: string, peerId: string): GroupInfo | undefined {
    const group = this.groups.get(groupId);
    if (!group) {
      return undefined;
    }
    group.members = group.members.filter((m) => m !== peerId);
    this.scheduleSave();
    return group;
  }

  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.persist();
    }, 400);
  }

  private async persist(): Promise<void> {
    try {
      const uri = await this.getFileUri();
      const list = Array.from(this.groups.values());
      const content = Buffer.from(JSON.stringify(list, null, 2), 'utf8');
      await vscode.workspace.fs.writeFile(uri, content);
    } catch (err) {
      console.error('Failed to persist LAN chat groups:', err);
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
