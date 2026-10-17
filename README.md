# LAN Code Chat

Chat with everyone else on your LAN, straight from VS Code — no server, no
account, no internet. Point it at the office Wi-Fi and it finds its own
peers, forms a mesh, and lets you fling code snippets back and forth with
one click to insert, copy, or open as a new file.

## How it works

- **Discovery** — each editor broadcasts a small "I'm here" packet over UDP
  on the LAN every few seconds (`lanCodeChat.discoveryPort`, default
  `54545`) and listens for the same from everyone else. No central host.
- **Mesh chat** — every pair of peers that end up in the same *room* opens
  one direct WebSocket between them (deterministic dialing rule, so you
  never get duplicate links). An N-person room is a full mesh, not a relay.
- **Rooms** — `lanCodeChat.room` is a passphrase (default `"general"`).
  Messages are encrypted (AES-256-GCM, key derived from the passphrase)
  before they ever touch the socket. Peers using a different passphrase
  still show up in the peer list (so you know they're nearby) but their
  messages are unreadable to you, and vice versa — a free, serverless way to
  keep multiple rooms on one LAN from colliding.
- **Snippets, not just text** — share your current selection or whole file;
  it shows up in the chat as a syntax-highlighted block with **Copy**,
  **Insert at Cursor**, and **Open as New File** buttons for whoever
  receives it.
- **Direct messages** — right-click a peer in the "Nearby Peers" view to DM
  just them instead of the whole room.

## Using it

1. Open the **LAN Code Chat** icon in the Activity Bar to see nearby peers.
2. Run **LAN Code Chat: Open Chat Room** (or click the status bar item).
3. Select some code → right-click → **LAN Code Chat: Share Selection to
   Chat** (or use the command palette), add an optional caption, hit Send.
4. Everyone in the same room sees it instantly and can insert it straight
   into their own editor.

### Commands

| Command | What it does |
|---|---|
| `LAN Code Chat: Open Chat Room` | Opens the chat panel |
| `LAN Code Chat: Share Selection to Chat` | Attaches the current selection |
| `LAN Code Chat: Share Current File to Chat` | Attaches the whole active file |
| `LAN Code Chat: Set Display Name` | Changes what peers see as your name |
| `LAN Code Chat: Set Room Passphrase` | Switches/creates a private room |
| `LAN Code Chat: Direct Message Peer` | DMs one peer from the peer list |

### Settings

See `lanCodeChat.*` in Settings — username, room passphrase, discovery
port, port range for the chat socket, announce interval, peer timeout, and
whether to pop a notification on incoming messages.

## Development

```bash
npm install
npm run compile   # or: npm run watch

```
command for build extenstion 
```
npx @vscode/vsce package --allow-missing-repository
```

Press `F5` (Run LAN Code Chat Extension) to launch an Extension
Development Host with the extension loaded. Open two VS Code windows (or
run it on two machines on the same LAN) to actually see peers.

## Notes / limitations

- Works within a single broadcast domain (same Wi-Fi/switch segment); it
  won't cross routed subnets or VPNs by design — it's a LAN tool.
- Encryption keeps a room's content private from other rooms on the same
  LAN, but this is a convenience boundary for a dev tool, not a hardened
  security product — don't paste secrets you wouldn't paste in Slack.
