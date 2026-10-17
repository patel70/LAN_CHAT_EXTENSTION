import * as vscode from 'vscode';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { SelfIdentity } from './types';

const ID_KEY = 'lanCodeChat.selfId';
const COLOR_KEY = 'lanCodeChat.selfColor';
const USERNAME_KEY = 'lanCodeChat.selfUsername';
const AVATAR_KEY = 'lanCodeChat.selfAvatar';

// A small, high-contrast palette so avatars/usernames stay readable in both
// light and dark themes instead of a random-hue lottery.
const PALETTE = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4',
  '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', '#008080',
  '#e6beff', '#9a6324', '#800000', '#aaffc3', '#808000',
  '#ffd8b1', '#000075', '#ff4d4d', '#1aa3ff', '#ff9ecb'
];

function pickColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function getSelfIdentity(context: vscode.ExtensionContext): SelfIdentity {
  let id = context.globalState.get<string>(ID_KEY);
  if (!id) {
    id = uuidv4();
    context.globalState.update(ID_KEY, id);
  }

  let color = context.globalState.get<string>(COLOR_KEY);
  if (!color) {
    color = pickColor(id);
    context.globalState.update(COLOR_KEY, color);
  }

  const storedUsername = context.globalState.get<string>(USERNAME_KEY);
  const configured = vscode.workspace.getConfiguration('lanCodeChat').get<string>('username', '');
  let defaultUser = 'Anonymous';
  try {
    defaultUser = os.userInfo().username || process.env.USERNAME || process.env.USER || 'Anonymous';
  } catch {
    defaultUser = process.env.USERNAME || process.env.USER || 'Anonymous';
  }

  const username = (storedUsername && storedUsername.trim().length > 0)
    ? storedUsername.trim()
    : ((configured && configured.trim().length > 0) ? configured.trim() : defaultUser);

  const avatar = context.globalState.get<string>(AVATAR_KEY);

  return { id, username, color, avatar };
}

export async function setSelfUsername(context: vscode.ExtensionContext, username: string): Promise<void> {
  const trimmed = username.trim();
  if (trimmed) {
    await context.globalState.update(USERNAME_KEY, trimmed);
    try {
      await vscode.workspace.getConfiguration('lanCodeChat').update('username', trimmed, vscode.ConfigurationTarget.Global);
    } catch {
      // Configuration update best-effort
    }
  }
}

export async function setSelfAvatar(context: vscode.ExtensionContext, avatar: string | undefined): Promise<void> {
  await context.globalState.update(AVATAR_KEY, avatar || undefined);
}
