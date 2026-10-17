// @ts-nocheck
(function () {
  const vscode = acquireVsCodeApi();

  // Elements
  const sidebarEl = document.getElementById('sidebar');
  const mainChatEl = document.getElementById('main-chat');
  const btnBack = document.getElementById('btn-back');
  const selfProfileEl = document.getElementById('self-profile');
  const selfAvatarContainerEl = document.getElementById('self-avatar-container');
  const selfAvatarEl = document.getElementById('self-avatar');
  const selfAvatarOverlayEl = document.getElementById('self-avatar-overlay');
  const selfInfoEl = document.getElementById('self-info');
  const selfNameRowEl = document.getElementById('self-name-row');
  const selfUsernameEl = document.getElementById('self-username');
  const avatarFilePickerEl = document.getElementById('avatar-file-picker');
  const btnChangeRoom = document.getElementById('btn-change-room');
  const roomNameEl = document.getElementById('room-name');
  const peerSearchInput = document.getElementById('peer-search');
  const btnNewGroup = document.getElementById('btn-new-group');
  const chatItemGeneral = document.getElementById('chat-item-general');
  const generalPeerCountEl = document.getElementById('general-peer-count');
  const customGroupsListEl = document.getElementById('custom-groups-list');
  const directPeersListEl = document.getElementById('direct-peers-list');

  const activeChatAvatarEl = document.getElementById('active-chat-avatar');
  const activeChatInfoEl = document.getElementById('active-chat-info');
  const activeChatTitleEl = document.getElementById('active-chat-title');
  const activeChatSubEl = document.getElementById('active-chat-sub');
  const btnGroupInfo = document.getElementById('btn-group-info');
  const btnRefreshPeers = document.getElementById('btn-refresh-peers');

  const groupInfoDrawerEl = document.getElementById('group-info-drawer');
  const btnCloseGroupInfo = document.getElementById('btn-close-group-info');
  const groupHeroAvatarEl = document.getElementById('group-hero-avatar-el');
  const groupInfoNameEl = document.getElementById('group-info-name');
  const groupInfoCountsEl = document.getElementById('group-info-counts');
  const memberTotalCountEl = document.getElementById('member-total-count');
  const btnAddMemberToGroup = document.getElementById('btn-add-member-to-group');
  const addMemberDropdownEl = document.getElementById('add-member-dropdown');
  const addMemberPeerListEl = document.getElementById('add-member-peer-list');
  const groupMembersListEl = document.getElementById('group-members-list');
  const btnClearHistory = document.getElementById('btn-clear-history');
  const clearHistoryIdleEl = document.getElementById('clear-history-idle');
  const clearHistoryConfirmBoxEl = document.getElementById('clear-history-confirm-box');
  const btnConfirmClearYes = document.getElementById('btn-confirm-clear-yes');
  const btnConfirmClearNo = document.getElementById('btn-confirm-clear-no');

  const createGroupModalEl = document.getElementById('create-group-modal');
  const btnCloseCreateGroup = document.getElementById('btn-close-create-group');
  const btnCancelCreateGroup = document.getElementById('btn-cancel-create-group');
  const btnSubmitCreateGroup = document.getElementById('btn-submit-create-group');
  const groupNameInput = document.getElementById('group-name-input');
  const createGroupPeerListEl = document.getElementById('create-group-peer-list');

  const messagesEl = document.getElementById('messages');
  const typingEl = document.getElementById('typing-indicator');
  const typingTextEl = document.getElementById('typing-text');
  const attachmentDrawerEl = document.getElementById('attachment-drawer');
  const attachmentContentEl = document.getElementById('attachment-content');
  const attachmentCloseBtn = document.getElementById('attachment-close');

  const inputEl = document.getElementById('input');
  const sendBtn = document.getElementById('send-btn');
  const attachBtn = document.getElementById('attach-btn');
  const attachMenuEl = document.getElementById('attach-menu');
  const filePickerEl = document.getElementById('file-picker');
  const attachDocBtn = document.getElementById('attach-doc-btn');
  const attachImgBtn = document.getElementById('attach-img-btn');
  const attachCodeBtn = document.getElementById('attach-code-btn');
  const dropOverlayEl = document.getElementById('drop-overlay');

  const stickerBtn = document.getElementById('sticker-btn');
  const stickerPanelEl = document.getElementById('sticker-panel');
  const stickerGridEl = document.getElementById('sticker-grid');
  const stickerSearchEl = document.getElementById('sticker-search');
  const gifTabContentEl = document.getElementById('gif-tab-content');
  const gifGridEl = document.getElementById('gif-grid');
  const gifUploadLink = document.getElementById('gif-upload-link');
  const gifPickerEl = document.getElementById('gif-picker');
  const stickerTabs = document.querySelectorAll('.sticker-tab');

  const replyBarEl = document.getElementById('reply-bar');
  const replyBarNameEl = document.getElementById('reply-bar-name');
  const replyBarTextEl = document.getElementById('reply-bar-text');
  const replyBarCloseBtn = document.getElementById('reply-bar-close');

  const profileModalEl = document.getElementById('profile-modal');
  const btnCloseProfile = document.getElementById('btn-close-profile');
  const profileModalAvatarEl = document.getElementById('profile-modal-avatar');
  const profileModalNameEl = document.getElementById('profile-modal-name');
  const profileModalStatusEl = document.getElementById('profile-modal-status');
  const profileModalAddressEl = document.getElementById('profile-modal-address');
  const btnProfileMessage = document.getElementById('btn-profile-message');

  const forwardModalEl = document.getElementById('forward-modal');
  const btnCloseForward = document.getElementById('btn-close-forward');
  const btnCancelForward = document.getElementById('btn-cancel-forward');
  const btnSubmitForward = document.getElementById('btn-submit-forward');
  const forwardTargetListEl = document.getElementById('forward-target-list');

  const msgInfoModalEl = document.getElementById('msg-info-modal');
  const btnCloseMsgInfo = document.getElementById('btn-close-msg-info');
  const msgInfoReadListEl = document.getElementById('msg-info-read-list');
  const msgInfoDeliveredListEl = document.getElementById('msg-info-delivered-list');

  const reactionPickerEl = document.getElementById('reaction-picker');
  const reactionPickerQuickEl = document.getElementById('reaction-picker-quick');

  // State
  let selfId = null;
  let selfUser = 'Anonymous';
  let selfColor = '#c7a254';
  let selfAvatar = null;
  let activeTarget = 'general'; // 'general' or 'grp-...' or peerId
  let peers = []; // PeerInfo[]
  let groups = []; // GroupInfo[]
  const conversations = new Map(); // conversationKey ('general' | 'grp-...' | peerId) -> Array<{ msg, isSelf }>
  const unreadCounts = new Map();

  let attachedCode = null;
  let attachedFile = null;
  let lastTypingSent = 0;
  let typingTimeout = null;
  let replyingTo = null; // { msgId, fromName, text }
  let forwardSourceMsgId = null;
  let reactionTargetMsgId = null;
  const messageIndex = new Map(); // msgId -> { msg, isSelf, row }

  const MAX_FILE_SIZE = 25 * 1024 * 1024;

  const STICKERS = [
    { e: '😀', tags: ['happy', 'smile', 'grin'] },
    { e: '😂', tags: ['laugh', 'lol', 'funny'] },
    { e: '🥹', tags: ['touched', 'emotional'] },
    { e: '😍', tags: ['love', 'heart eyes', 'crush'] },
    { e: '😎', tags: ['cool', 'sunglasses', 'swag'] },
    { e: '🤔', tags: ['thinking', 'hmm'] },
    { e: '😴', tags: ['sleep', 'tired', 'zzz'] },
    { e: '🤯', tags: ['mindblown', 'shocked', 'wow'] },
    { e: '🥳', tags: ['party', 'celebrate', 'birthday'] },
    { e: '😭', tags: ['cry', 'sad', 'sob'] },
    { e: '👍', tags: ['thumbsup', 'like', 'yes', 'good', 'approve'] },
    { e: '👎', tags: ['thumbsdown', 'dislike', 'no', 'bad'] },
    { e: '👏', tags: ['clap', 'applause', 'bravo'] },
    { e: '🙌', tags: ['praise', 'yay', 'hooray'] },
    { e: '🙏', tags: ['pray', 'please', 'thanks'] },
    { e: '🤝', tags: ['deal', 'handshake', 'agree'] },
    { e: '💪', tags: ['strong', 'muscle', 'flex'] },
    { e: '✌️', tags: ['peace', 'victory'] },
    { e: '🤙', tags: ['call me', 'chill'] },
    { e: '👌', tags: ['ok', 'perfect', 'nice'] },
    { e: '❤️', tags: ['heart', 'love'] },
    { e: '🔥', tags: ['fire', 'lit', 'hot', 'awesome'] },
    { e: '🎉', tags: ['party', 'confetti', 'celebrate'] },
    { e: '✨', tags: ['sparkle', 'magic', 'shiny'] },
    { e: '💯', tags: ['hundred', 'perfect', 'score'] },
    { e: '⭐', tags: ['star', 'favorite'] },
    { e: '☕', tags: ['coffee', 'tea', 'break'] },
    { e: '🐛', tags: ['bug', 'debug', 'code'] },
    { e: '🚀', tags: ['rocket', 'launch', 'ship', 'deploy'] },
    { e: '✅', tags: ['check', 'done', 'approved', 'yes'] },
    { e: '😅', tags: ['nervous', 'phew', 'sweat'] },
    { e: '🤣', tags: ['rofl', 'laugh', 'funny'] },
    { e: '😬', tags: ['cringe', 'awkward', 'yikes'] },
    { e: '😮', tags: ['surprised', 'shock', 'wow'] },
    { e: '🥶', tags: ['cold', 'freezing'] },
    { e: '🫡', tags: ['salute', 'respect'] },
    { e: '🫶', tags: ['love', 'heart hands'] },
    { e: '🤓', tags: ['nerd', 'geek'] },
    { e: '🫠', tags: ['melting', 'overwhelmed'] },
    { e: '💀', tags: ['dead', 'dying', 'funny'] }
  ];

  // Built-in, offline "GIF" reactions: CSS-animated emoji, searchable by tag, no
  // internet/import required by default. Users can still upload their own real
  // GIF file via the "upload your own" link if they want something custom.
  const BUILTIN_GIFS = [
    { key: 'thumbsup-bounce', e: '👍', anim: 'gif-bounce', tags: ['thumbs up', 'like', 'yes', 'approve', 'nice'] },
    { key: 'clap-wiggle', e: '👏', anim: 'gif-wiggle', tags: ['clap', 'applause', 'bravo', 'well done'] },
    { key: 'heart-pulse', e: '❤️', anim: 'gif-pulse', tags: ['love', 'heart', 'like'] },
    { key: 'laugh-wiggle', e: '😂', anim: 'gif-wiggle', tags: ['laugh', 'lol', 'funny', 'haha'] },
    { key: 'fire-float', e: '🔥', anim: 'gif-float', tags: ['fire', 'lit', 'hot', 'awesome'] },
    { key: 'party-spin', e: '🎉', anim: 'gif-spin', tags: ['party', 'confetti', 'celebrate', 'woo'] },
    { key: 'dance-wiggle', e: '💃', anim: 'gif-wiggle', tags: ['dance', 'party', 'groove'] },
    { key: 'rocket-float', e: '🚀', anim: 'gif-float', tags: ['rocket', 'launch', 'ship', 'deploy', 'fast'] },
    { key: 'mindblown-spin', e: '🤯', anim: 'gif-spin', tags: ['mindblown', 'wow', 'shocked', 'omg'] },
    { key: 'facepalm-wiggle', e: '🤦', anim: 'gif-wiggle', tags: ['facepalm', 'ugh', 'really'] },
    { key: 'wave-wiggle', e: '👋', anim: 'gif-wiggle', tags: ['wave', 'hi', 'hello', 'bye'] },
    { key: 'eyes-pulse', e: '👀', anim: 'gif-pulse', tags: ['eyes', 'look', 'suspicious', 'watching'] },
    { key: 'thinking-float', e: '🤔', anim: 'gif-float', tags: ['thinking', 'hmm', 'wonder'] },
    { key: 'cry-wiggle', e: '😭', anim: 'gif-wiggle', tags: ['cry', 'sad', 'sob'] },
    { key: 'ok-bounce', e: '👌', anim: 'gif-bounce', tags: ['ok', 'perfect', 'nice', 'good'] },
    { key: 'muscle-bounce', e: '💪', anim: 'gif-bounce', tags: ['strong', 'flex', 'gym', 'power'] },
    { key: 'confused-wiggle', e: '😵‍💫', anim: 'gif-wiggle', tags: ['confused', 'dizzy', 'lost'] },
    { key: 'sparkle-spin', e: '✨', anim: 'gif-spin', tags: ['sparkle', 'magic', 'shiny', 'nice'] },
    { key: 'check-bounce', e: '✅', anim: 'gif-bounce', tags: ['done', 'approved', 'check', 'yes', 'ship it'] },
    { key: 'no-wiggle', e: '🙅', anim: 'gif-wiggle', tags: ['no', 'nope', 'reject', 'denied'] },
    { key: 'coffee-float', e: '☕', anim: 'gif-float', tags: ['coffee', 'tea', 'break', 'tired'] },
    { key: 'bug-wiggle', e: '🐛', anim: 'gif-wiggle', tags: ['bug', 'debug', 'code', 'error'] },
    { key: 'skull-pulse', e: '💀', anim: 'gif-pulse', tags: ['dead', 'dying', 'funny', 'lol'] },
    { key: 'clock-spin', e: '⏰', anim: 'gif-spin', tags: ['time', 'clock', 'hurry', 'deadline'] }
  ];

  const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  const KEYWORDS = new Set([
    'function', 'return', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
    'continue', 'class', 'extends', 'implements', 'interface', 'new', 'this', 'super', 'import', 'export', 'from',
    'default', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'in', 'of', 'yield',
    'def', 'elif', 'lambda', 'None', 'True', 'False', 'pass', 'with', 'as', 'raise', 'global', 'nonlocal',
    'public', 'private', 'protected', 'static', 'void', 'int', 'float', 'double', 'bool', 'char', 'string',
    'struct', 'enum', 'namespace', 'using', 'package', 'func', 'fn', 'impl', 'trait', 'match', 'mut', 'pub',
    'null', 'nil', 'undefined', 'true', 'false'
  ]);

  const ICONS = {
    users: `<svg class="lucide" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    usersSmall: `<svg class="lucide" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    hash: `<svg class="lucide" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>`,
    hashHero: `<svg class="lucide" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>`,
    usersHero: `<svg class="lucide" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    messageSquare: `<svg class="lucide" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    lock: `<svg class="lucide" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    fileText: `<svg class="lucide" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
    image: `<svg class="lucide" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
    code: `<svg class="lucide" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>`,
    copy: `<svg class="lucide" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
    insert: `<svg class="lucide" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    download: `<svg class="lucide" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`,
    externalLink: `<svg class="lucide" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`,
    checkCheck: `<svg class="lucide" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 7 17l-5-5"/><path d="m22 10-7.5 7.5L13 16"/></svg>`,
    singleCheck: `<svg class="lucide" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
    reply: `<svg class="lucide" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>`,
    forward: `<svg class="lucide" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/></svg>`,
    reactSmile: `<svg class="lucide" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9" y1="9" y2="9"/><line x1="15" x2="15" y1="9" y2="9"/></svg>`
  };

  function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  function renderAvatarElement(containerEl, avatarUrl, name, bgColor) {
    containerEl.innerHTML = '';
    if (avatarUrl) {
      const img = document.createElement('img');
      img.src = avatarUrl;
      img.alt = name || 'Avatar';
      containerEl.appendChild(img);
    } else {
      containerEl.textContent = getInitials(name);
      containerEl.style.backgroundColor = bgColor || '#c7a254';
    }
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatTime(ts) {
    try {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  function highlight(code) {
    let out = '';
    let i = 0;
    const n = code.length;
    while (i < n) {
      const ch = code[i];

      if (ch === '/' && code[i + 1] === '/') {
        let j = i;
        while (j < n && code[j] !== '\n') j++;
        out += `<span class="tok-com">${escapeHtml(code.slice(i, j))}</span>`;
        i = j;
        continue;
      }
      if (ch === '#') {
        let j = i;
        while (j < n && code[j] !== '\n') j++;
        out += `<span class="tok-com">${escapeHtml(code.slice(i, j))}</span>`;
        i = j;
        continue;
      }
      if (ch === '/' && code[i + 1] === '*') {
        let j = i + 2;
        while (j < n && !(code[j] === '*' && code[j + 1] === '/')) j++;
        j = Math.min(j + 2, n);
        out += `<span class="tok-com">${escapeHtml(code.slice(i, j))}</span>`;
        i = j;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        const quote = ch;
        let j = i + 1;
        while (j < n && code[j] !== quote) {
          if (code[j] === '\\') j++;
          j++;
        }
        j = Math.min(j + 1, n);
        out += `<span class="tok-str">${escapeHtml(code.slice(i, j))}</span>`;
        i = j;
        continue;
      }
      if (/[0-9]/.test(ch)) {
        let j = i;
        while (j < n && /[0-9.]/.test(code[j])) j++;
        out += `<span class="tok-num">${escapeHtml(code.slice(i, j))}</span>`;
        i = j;
        continue;
      }
      if (/[A-Za-z_]/.test(ch)) {
        let j = i;
        while (j < n && /[A-Za-z0-9_]/.test(code[j])) j++;
        const word = code.slice(i, j);
        out += KEYWORDS.has(word) ? `<span class="tok-kw">${word}</span>` : escapeHtml(word);
        i = j;
        continue;
      }
      out += escapeHtml(ch);
      i++;
    }
    return out;
  }

  function getConversationKey(msg, isSelf) {
    if (msg.groupId) {
      return msg.groupId;
    }
    if (!msg.toId) {
      return 'general';
    }
    if (isSelf) {
      return msg.toId;
    }
    return msg.fromId;
  }

  function renderCustomGroupsList() {
    if (!customGroupsListEl) return;
    customGroupsListEl.innerHTML = '';

    const filter = peerSearchInput.value.toLowerCase().trim();
    const matchingGroups = groups.filter((g) => {
      if (filter && !g.name.toLowerCase().includes(filter)) return false;
      return true;
    });

    for (const group of matchingGroups) {
      const item = document.createElement('div');
      item.className = 'chat-item ' + (activeTarget === group.id ? 'active' : '');
      item.setAttribute('data-target', group.id);

      const avatar = document.createElement('div');
      avatar.className = 'chat-avatar group-avatar';
      avatar.innerHTML = ICONS.users;
      avatar.style.backgroundColor = '#5b5fc7';
      item.appendChild(avatar);

      const content = document.createElement('div');
      content.className = 'chat-item-content';

      const top = document.createElement('div');
      top.className = 'chat-item-top';

      const title = document.createElement('span');
      title.className = 'chat-title';
      title.textContent = group.name;
      top.appendChild(title);

      const unread = unreadCounts.get(group.id) || 0;
      if (unread > 0) {
        const badge = document.createElement('span');
        badge.className = 'unread-badge';
        badge.textContent = unread;
        top.appendChild(badge);
      } else {
        const badge = document.createElement('span');
        badge.className = 'chat-badge';
        badge.textContent = `${group.members.length} members`;
        top.appendChild(badge);
      }
      content.appendChild(top);

      const sub = document.createElement('div');
      sub.className = 'chat-item-sub';
      sub.textContent = `Custom Group · ${group.members.length} member(s)`;
      content.appendChild(sub);

      item.appendChild(content);

      item.addEventListener('click', () => {
        setActiveTarget(group.id);
      });

      customGroupsListEl.appendChild(item);
    }
  }

  function renderPeersList() {
    const filter = peerSearchInput.value.toLowerCase().trim();
    const sameRoomPeers = peers.filter((p) => p.sameRoom);
    generalPeerCountEl.textContent = `${sameRoomPeers.length} online`;

    directPeersListEl.innerHTML = '';

    const matchingPeers = peers.filter((p) => {
      if (!p.sameRoom) return false;
      if (filter && !p.username.toLowerCase().includes(filter)) return false;
      return true;
    });

    if (matchingPeers.length === 0) {
      const msg = document.createElement('div');
      msg.className = 'no-peers-msg';
      msg.textContent = peers.length === 0 ? 'No peers on LAN yet…' : 'No matching peers in this room';
      directPeersListEl.appendChild(msg);
      return;
    }

    for (const peer of matchingPeers) {
      const item = document.createElement('div');
      item.className = 'chat-item ' + (activeTarget === peer.id ? 'active' : '');
      item.setAttribute('data-target', peer.id);

      const avatar = document.createElement('div');
      avatar.className = 'chat-avatar';
      avatar.title = 'View profile';
      renderAvatarElement(avatar, peer.avatar, peer.username, peer.color);
      avatar.addEventListener('click', (e) => {
        e.stopPropagation();
        openProfileModal(peer.id);
      });

      if (peer.connected) {
        const dot = document.createElement('div');
        dot.className = 'peer-online-dot';
        avatar.appendChild(dot);
      }

      item.appendChild(avatar);

      const content = document.createElement('div');
      content.className = 'chat-item-content';

      const top = document.createElement('div');
      top.className = 'chat-item-top';

      const title = document.createElement('span');
      title.className = 'chat-title';
      title.textContent = peer.username;
      top.appendChild(title);

      const unread = unreadCounts.get(peer.id) || 0;
      if (unread > 0) {
        const badge = document.createElement('span');
        badge.className = 'unread-badge';
        badge.textContent = unread;
        top.appendChild(badge);
      } else {
        const status = document.createElement('span');
        status.className = 'chat-badge';
        status.textContent = peer.connected ? 'online' : 'offline';
        top.appendChild(status);
      }

      content.appendChild(top);

      const sub = document.createElement('div');
      sub.className = 'chat-item-sub';
      sub.textContent = `${peer.address}:${peer.wsPort} · Direct Chat`;
      content.appendChild(sub);

      item.appendChild(content);

      item.addEventListener('click', () => {
        setActiveTarget(peer.id);
      });

      directPeersListEl.appendChild(item);
    }
  }

  function setActiveTarget(targetId) {
    activeTarget = targetId;
    unreadCounts.set(targetId, 0);

    // Update active highlight on sidebar
    document.querySelectorAll('.chat-item').forEach((el) => {
      if (el.getAttribute('data-target') === targetId) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Update active chat header
    if (targetId === 'general') {
      activeChatAvatarEl.innerHTML = ICONS.hash;
      activeChatAvatarEl.style.backgroundColor = '#5b5fc7';
      activeChatTitleEl.textContent = '#general (Everyone)';
      const onlineCount = peers.filter((p) => p.sameRoom).length;
      activeChatSubEl.textContent = `Public LAN Group · ${onlineCount} online (click for info)`;
      inputEl.placeholder = 'Message #general… (Shift+Enter for newline)';
    } else if (targetId.startsWith('grp-')) {
      const group = groups.find((g) => g.id === targetId);
      const groupName = group ? group.name : 'Group';
      const memberCount = group ? group.members.length : 1;
      const onlineCount = group
        ? group.members.filter((id) => id === selfId || peers.some((p) => p.id === id && p.connected)).length
        : 1;

      activeChatAvatarEl.innerHTML = ICONS.users;
      activeChatAvatarEl.style.backgroundColor = '#5b5fc7';
      activeChatTitleEl.textContent = groupName;
      activeChatSubEl.textContent = `Custom Group · ${onlineCount} online, ${memberCount} members (click for info)`;
      inputEl.placeholder = `Message ${groupName}… (Shift+Enter for newline)`;
    } else {
      const peer = peers.find((p) => p.id === targetId);
      const name = peer ? peer.username : 'Peer';
      const color = peer ? peer.color : '#c7a254';
      renderAvatarElement(activeChatAvatarEl, peer ? peer.avatar : null, name, color);
      activeChatTitleEl.textContent = name;
      activeChatSubEl.textContent = peer ? `Direct 1-on-1 Chat · ${peer.address}` : 'Direct 1-on-1 Chat';
      inputEl.placeholder = `Message ${name} directly… (Shift+Enter for newline)`;
    }

    // On narrow screens switch view to chat
    sidebarEl.classList.add('view-chat');
    mainChatEl.classList.remove('view-list');

    renderActiveConversation();
    renderPeersList();
    renderCustomGroupsList();
  }

  function renderGroupInfoDrawer() {
    if (addMemberDropdownEl) {
      addMemberDropdownEl.classList.add('hidden');
    }
    if (clearHistoryIdleEl && clearHistoryConfirmBoxEl) {
      clearHistoryIdleEl.classList.remove('hidden');
      clearHistoryConfirmBoxEl.classList.add('hidden');
    }

    if (activeTarget === 'general') {
      const sameRoomPeers = peers.filter((p) => p.sameRoom);
      const connectedCount = sameRoomPeers.filter((p) => p.connected).length;
      const totalMembers = sameRoomPeers.length + 1; // + 1 for self

      if (groupHeroAvatarEl) groupHeroAvatarEl.innerHTML = ICONS.hashHero;
      groupInfoNameEl.textContent = `#general (${roomNameEl.textContent})`;
      groupInfoCountsEl.textContent = `${connectedCount + 1} online · ${totalMembers} total member(s)`;
      memberTotalCountEl.textContent = totalMembers;
      if (btnAddMemberToGroup) btnAddMemberToGroup.classList.add('hidden');

      groupMembersListEl.innerHTML = '';

      // Render Self at top
      const selfRow = document.createElement('div');
      selfRow.className = 'member-row';

      const selfLeft = document.createElement('div');
      selfLeft.className = 'member-left';
      const selfAv = document.createElement('div');
      selfAv.className = 'member-avatar';
      selfAv.title = 'View profile';
      renderAvatarElement(selfAv, selfAvatar, selfUser, selfColor);
      selfAv.addEventListener('click', () => openProfileModal(selfId));
      selfLeft.appendChild(selfAv);

      const selfInfo = document.createElement('div');
      selfInfo.className = 'member-info';
      selfInfo.innerHTML = `
        <div class="member-name">${escapeHtml(selfUser)} <span class="you-badge">YOU</span></div>
        <div class="member-sub online">● Online (This machine)</div>
      `;
      selfLeft.appendChild(selfInfo);
      selfRow.appendChild(selfLeft);
      groupMembersListEl.appendChild(selfRow);

      // Render other peers in this room
      for (const peer of sameRoomPeers) {
        const row = document.createElement('div');
        row.className = 'member-row';

        const left = document.createElement('div');
        left.className = 'member-left';

        const av = document.createElement('div');
        av.className = 'member-avatar';
        av.title = 'View profile';
        renderAvatarElement(av, peer.avatar, peer.username, peer.color);
        av.addEventListener('click', () => openProfileModal(peer.id));
        left.appendChild(av);

        const info = document.createElement('div');
        info.className = 'member-info';
        const onlineStatus = peer.connected
          ? `<div class="member-sub online">● Online (${peer.address}:${peer.wsPort})</div>`
          : `<div class="member-sub">○ Offline (${peer.address})</div>`;
        info.innerHTML = `
          <div class="member-name">${escapeHtml(peer.username)}</div>
          ${onlineStatus}
        `;
        left.appendChild(info);
        row.appendChild(left);

        const btn = document.createElement('button');
        btn.className = 'member-action-btn';
        btn.innerHTML = `${ICONS.messageSquare} <span>Message</span>`;
        btn.title = `Direct message ${peer.username}`;
        btn.addEventListener('click', () => {
          groupInfoDrawerEl.classList.add('hidden');
          setActiveTarget(peer.id);
        });
        row.appendChild(btn);

        groupMembersListEl.appendChild(row);
      }
    } else if (activeTarget.startsWith('grp-')) {
      const group = groups.find((g) => g.id === activeTarget);
      if (!group) return;

      if (groupHeroAvatarEl) groupHeroAvatarEl.innerHTML = ICONS.usersHero;
      groupInfoNameEl.textContent = group.name;

      const onlineCount = group.members.filter((id) => id === selfId || peers.some((p) => p.id === id && p.connected)).length;
      groupInfoCountsEl.textContent = `${onlineCount} online · ${group.members.length} total member(s)`;
      memberTotalCountEl.textContent = group.members.length;
      if (btnAddMemberToGroup) btnAddMemberToGroup.classList.remove('hidden');

      groupMembersListEl.innerHTML = '';

      // Render Self if member
      if (group.members.includes(selfId)) {
        const selfRow = document.createElement('div');
        selfRow.className = 'member-row';
        const selfLeft = document.createElement('div');
        selfLeft.className = 'member-left';
        const selfAv = document.createElement('div');
        selfAv.className = 'member-avatar';
        selfAv.title = 'View profile';
        renderAvatarElement(selfAv, selfAvatar, selfUser, selfColor);
        selfAv.addEventListener('click', () => openProfileModal(selfId));
        selfLeft.appendChild(selfAv);

        const selfInfo = document.createElement('div');
        selfInfo.className = 'member-info';
        const isCreator = group.createdBy === selfId;
        selfInfo.innerHTML = `
          <div class="member-name">${escapeHtml(selfUser)} <span class="you-badge">YOU</span> ${isCreator ? '<span class="you-badge" style="background:#c7a254;color:#1b1c24;">CREATOR</span>' : ''}</div>
          <div class="member-sub online">● Online (This machine)</div>
        `;
        selfLeft.appendChild(selfInfo);
        selfRow.appendChild(selfLeft);
        groupMembersListEl.appendChild(selfRow);
      }

      // Render other members in this group
      for (const mId of group.members) {
        if (mId === selfId) continue;
        const peer = peers.find((p) => p.id === mId);
        const row = document.createElement('div');
        row.className = 'member-row';
        const left = document.createElement('div');
        left.className = 'member-left';
        const av = document.createElement('div');
        av.className = 'member-avatar';
        if (peer) {
          av.title = 'View profile';
          av.addEventListener('click', () => openProfileModal(peer.id));
        }
        renderAvatarElement(av, peer?.avatar || null, peer?.username || 'Peer', peer?.color || '#c7a254');
        left.appendChild(av);

        const info = document.createElement('div');
        info.className = 'member-info';
        const isCreator = group.createdBy === mId;
        const isOnline = peer?.connected ?? false;
        const onlineStatus = isOnline
          ? `<div class="member-sub online">● Online</div>`
          : `<div class="member-sub">○ Offline</div>`;
        info.innerHTML = `
          <div class="member-name">${escapeHtml(peer ? peer.username : mId.slice(0, 8))} ${isCreator ? '<span class="you-badge" style="background:#c7a254;color:#1b1c24;">CREATOR</span>' : ''}</div>
          ${onlineStatus}
        `;
        left.appendChild(info);
        row.appendChild(left);

        if (peer) {
          const btn = document.createElement('button');
          btn.className = 'member-action-btn';
          btn.innerHTML = `${ICONS.messageSquare} <span>Message</span>`;
          btn.title = `Direct message ${peer.username}`;
          btn.addEventListener('click', () => {
            groupInfoDrawerEl.classList.add('hidden');
            setActiveTarget(peer.id);
          });
          row.appendChild(btn);
        }

        groupMembersListEl.appendChild(row);
      }
    }
  }

  function buildSnippetNode(code) {
    const wrap = document.createElement('div');
    wrap.className = 'snippet';

    const head = document.createElement('div');
    head.className = 'snippet-head';
    const lang = document.createElement('span');
    lang.className = 'lang';
    lang.textContent = (code.language || 'code') + (code.fileName ? ` · ${code.fileName}` : '');
    head.appendChild(lang);

    const actions = document.createElement('div');
    actions.className = 'snippet-actions';

    const mkBtn = (iconSvg, label, title, onClick) => {
      const b = document.createElement('button');
      b.innerHTML = `${iconSvg} <span>${label}</span>`;
      b.title = title;
      b.addEventListener('click', onClick);
      return b;
    };

    actions.appendChild(mkBtn(ICONS.copy, 'Copy', 'Copy to clipboard', () => vscode.postMessage({ command: 'copy', code: code.code })));
    actions.appendChild(mkBtn(ICONS.insert, 'Insert', 'Insert at cursor', () =>
      vscode.postMessage({ command: 'insert', code: code.code, language: code.language })));
    actions.appendChild(mkBtn(ICONS.externalLink, 'Open File', 'Open in new editor tab', () =>
      vscode.postMessage({ command: 'insertNewFile', code: code.code, language: code.language })));

    head.appendChild(actions);
    wrap.appendChild(head);

    const pre = document.createElement('pre');
    const codeEl = document.createElement('code');
    codeEl.innerHTML = highlight(code.code);
    pre.appendChild(codeEl);
    wrap.appendChild(pre);

    return wrap;
  }

  function buildFileNode(file) {
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || (file.mimeType && file.mimeType.includes('pdf'));
    const isImage = file.mimeType && file.mimeType.startsWith('image/');

    if (isImage) {
      const isGif = (file.mimeType && file.mimeType.includes('gif')) || file.name.toLowerCase().endsWith('.gif');
      const card = document.createElement('div');
      card.className = 'image-card' + (isGif ? ' gif-card' : '');
      const img = document.createElement('img');
      img.src = file.data;
      img.alt = file.name;
      img.title = 'Click to open or save';
      img.addEventListener('click', () => {
        vscode.postMessage({ command: 'openFile', file });
      });
      card.appendChild(img);

      if (isGif) {
        const badge = document.createElement('span');
        badge.className = 'gif-badge';
        badge.textContent = 'GIF';
        card.appendChild(badge);
      }

      const bar = document.createElement('div');
      bar.className = 'image-card-bar';
      const infoSpan = document.createElement('span');
      infoSpan.textContent = `${file.name} · ${formatBytes(file.size)}`;
      bar.appendChild(infoSpan);

      const saveBtn = document.createElement('button');
      saveBtn.className = 'doc-btn';
      saveBtn.innerHTML = `${ICONS.download} <span>Save As</span>`;
      saveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        vscode.postMessage({ command: 'saveFile', file });
      });
      bar.appendChild(saveBtn);

      card.appendChild(bar);
      return card;
    }

    const card = document.createElement('div');
    card.className = 'doc-card';

    const iconBadge = document.createElement('div');
    iconBadge.className = 'doc-icon-badge ' + (isPdf ? 'pdf' : 'generic');
    const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
    iconBadge.textContent = isPdf ? 'PDF' : ext.slice(0, 4);
    card.appendChild(iconBadge);

    const info = document.createElement('div');
    info.className = 'doc-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'doc-name';
    nameEl.textContent = file.name;
    nameEl.title = file.name;
    info.appendChild(nameEl);

    const metaEl = document.createElement('div');
    metaEl.className = 'doc-meta';
    metaEl.textContent = `${formatBytes(file.size)} · ${isPdf ? 'PDF Document' : ext + ' File'}`;
    info.appendChild(metaEl);

    card.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'doc-actions';

    const openBtn = document.createElement('button');
    openBtn.className = 'doc-btn';
    openBtn.innerHTML = `${ICONS.externalLink} <span>Open</span>`;
    openBtn.title = 'Open file';
    openBtn.addEventListener('click', () => {
      vscode.postMessage({ command: 'openFile', file });
    });
    actions.appendChild(openBtn);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'doc-btn';
    saveBtn.innerHTML = `${ICONS.download} <span>Save As</span>`;
    saveBtn.title = 'Save file to disk';
    saveBtn.addEventListener('click', () => {
      vscode.postMessage({ command: 'saveFile', file });
    });
    actions.appendChild(saveBtn);

    card.appendChild(actions);
    return card;
  }

  function findPeerById(id) {
    if (id === selfId) {
      return { id: selfId, username: selfUser, color: selfColor, avatar: selfAvatar, connected: true, sameRoom: true };
    }
    return peers.find((p) => p.id === id);
  }

  function messagePreviewText(msg) {
    if (msg.sticker) return `Sticker ${msg.sticker.emoji}`;
    if (msg.gif) return 'GIF';
    if (msg.file) return `📎 ${msg.file.name}`;
    if (msg.code) return `</> ${msg.code.language || 'code'} snippet`;
    return msg.text || '';
  }

  function buildReplyQuoteNode(msg) {
    if (!msg.replyTo) return null;
    const quote = document.createElement('div');
    quote.className = 'reply-quote';
    quote.innerHTML = `
      <div class="reply-quote-name">${escapeHtml(msg.replyTo.fromName)}</div>
      <div class="reply-quote-text">${escapeHtml(msg.replyTo.text)}</div>
    `;
    quote.addEventListener('click', (e) => {
      e.stopPropagation();
      scrollToMessage(msg.replyTo.msgId);
    });
    return quote;
  }

  function scrollToMessage(msgId) {
    const entry = messageIndex.get(msgId);
    if (entry && entry.row && entry.row.isConnected) {
      entry.row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      entry.row.classList.add('flash-highlight');
      setTimeout(() => entry.row.classList.remove('flash-highlight'), 1200);
    }
  }

  function tickState(msg) {
    const total = (msg._recipients || []).length;
    if (total === 0) return null;
    const delivered = (msg._delivered || []).length;
    const read = (msg._read || []).length;
    if (read >= total) return 'read';
    if (delivered >= total) return 'delivered';
    return 'sent';
  }

  function buildTickNode(msg) {
    const state = tickState(msg);
    const span = document.createElement('span');
    span.className = 'msg-check ' + (state || 'sent');
    span.innerHTML = state === 'sent' || !state ? ICONS.singleCheck : ICONS.checkCheck;
    if (state) {
      span.title = 'Click for message info';
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        openMessageInfo(msg);
      });
    }
    return span;
  }

  function buildReactionsNode(msg) {
    if (!msg.reactions || msg.reactions.length === 0) return null;
    const wrap = document.createElement('div');
    wrap.className = 'reactions-row';
    for (const entry of msg.reactions) {
      if (!entry.by || entry.by.length === 0) continue;
      const pill = document.createElement('button');
      const mine = entry.by.includes(selfId);
      pill.className = 'reaction-pill' + (mine ? ' mine' : '');
      pill.textContent = `${entry.emoji} ${entry.by.length}`;
      pill.title = entry.by.map((id) => (findPeerById(id) || {}).username || 'Someone').join(', ');
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        vscode.postMessage({ command: 'react', msgId: msg.msgId, emoji: mine ? null : entry.emoji });
      });
      wrap.appendChild(pill);
    }
    return wrap.childElementCount > 0 ? wrap : null;
  }

  function buildHoverToolbar(msg, isSelf) {
    const toolbar = document.createElement('div');
    toolbar.className = 'msg-hover-toolbar';

    const mkBtn = (iconSvg, title, onClick) => {
      const b = document.createElement('button');
      b.innerHTML = iconSvg;
      b.title = title;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        onClick();
      });
      return b;
    };

    toolbar.appendChild(mkBtn(ICONS.reactSmile, 'React', () => openReactionPicker(msg, toolbar)));
    toolbar.appendChild(mkBtn(ICONS.reply, 'Reply', () => startReply(msg)));
    toolbar.appendChild(mkBtn(ICONS.forward, 'Forward', () => openForwardModal(msg.msgId)));

    return toolbar;
  }

  function appendMessageRow(msg, isSelf) {
    const row = document.createElement('div');
    row.className = 'msg-row ' + (isSelf ? 'self' : 'other');
    row.dataset.msgid = msg.msgId;
    messageIndex.set(msg.msgId, { msg, isSelf, row });

    row.appendChild(buildHoverToolbar(msg, isSelf));

    if (msg.sticker && msg.sticker.emoji) {
      row.classList.add('sticker-row');
      if (!isSelf && !msg.toId) {
        const senderEl = document.createElement('div');
        senderEl.className = 'msg-sender sticker-sender';
        senderEl.style.color = msg.color || 'var(--accent)';
        senderEl.textContent = msg.fromName || 'Peer';
        row.appendChild(senderEl);
      }
      const stickerEl = document.createElement('div');
      stickerEl.className = 'sticker-emoji';
      stickerEl.textContent = msg.sticker.emoji;
      row.appendChild(stickerEl);
      const reactions1 = buildReactionsNode(msg);
      if (reactions1) row.appendChild(reactions1);
      const timeEl = document.createElement('span');
      timeEl.className = 'sticker-time';
      timeEl.textContent = formatTime(msg.ts);
      row.appendChild(timeEl);
      messagesEl.appendChild(row);
      return;
    }

    if (msg.gif && msg.gif.key) {
      const gifDef = BUILTIN_GIFS.find((g) => g.key === msg.gif.key);
      row.classList.add('sticker-row');
      const gifEl = document.createElement('div');
      gifEl.className = 'sticker-emoji ' + (gifDef ? gifDef.anim : '');
      gifEl.textContent = gifDef ? gifDef.e : '🎬';
      row.appendChild(gifEl);
      const reactions2 = buildReactionsNode(msg);
      if (reactions2) row.appendChild(reactions2);
      const timeEl = document.createElement('span');
      timeEl.className = 'sticker-time';
      timeEl.textContent = formatTime(msg.ts);
      row.appendChild(timeEl);
      messagesEl.appendChild(row);
      return;
    }

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    if (msg.forwarded) {
      const fwdEl = document.createElement('div');
      fwdEl.className = 'forwarded-tag';
      fwdEl.innerHTML = `${ICONS.forward} <span>Forwarded</span>`;
      bubble.appendChild(fwdEl);
    }

    if (!isSelf && !msg.toId) {
      const senderRow = document.createElement('div');
      senderRow.className = 'msg-sender';
      senderRow.style.color = msg.color || '#c7a254';

      const peer = findPeerById(msg.fromId);
      const miniAv = document.createElement('span');
      miniAv.className = 'msg-sender-avatar';
      renderAvatarElement(miniAv, peer ? peer.avatar : msg.avatar, msg.fromName, msg.color);
      miniAv.addEventListener('click', (e) => {
        e.stopPropagation();
        openProfileModal(msg.fromId);
      });
      senderRow.appendChild(miniAv);

      const nameSpan = document.createElement('span');
      nameSpan.textContent = msg.fromName || 'Peer';
      senderRow.appendChild(nameSpan);

      bubble.appendChild(senderRow);
    }

    const quoteNode = buildReplyQuoteNode(msg);
    if (quoteNode) bubble.appendChild(quoteNode);

    if (msg.file) {
      bubble.appendChild(buildFileNode(msg.file));
    }

    if (msg.code) {
      bubble.appendChild(buildSnippetNode(msg.code));
    }

    if (msg.text) {
      const textEl = document.createElement('div');
      textEl.className = 'msg-text';
      textEl.textContent = msg.text;
      bubble.appendChild(textEl);
    }

    const footer = document.createElement('div');
    footer.className = 'msg-footer';
    const timeSpan = document.createElement('span');
    timeSpan.className = 'msg-time';
    timeSpan.textContent = formatTime(msg.ts);
    footer.appendChild(timeSpan);

    if (isSelf) {
      footer.appendChild(buildTickNode(msg));
    }

    bubble.appendChild(footer);
    row.appendChild(bubble);

    const reactionsNode = buildReactionsNode(msg);
    if (reactionsNode) row.appendChild(reactionsNode);

    messagesEl.appendChild(row);
  }

  function renderActiveConversation() {
    messagesEl.innerHTML = '';
    const notice = document.createElement('div');
    notice.className = 'e2e-notice';
    notice.innerHTML = activeTarget === 'general'
      ? `${ICONS.lock} <span>Public LAN Group. All peers in this room can chat. Persisted locally.</span>`
      : `${ICONS.lock} <span>Direct 1-on-1 End-to-End Encrypted chat. Only you and this peer can read messages.</span>`;
    messagesEl.appendChild(notice);

    const list = conversations.get(activeTarget) || [];
    for (const item of list) {
      appendMessageRow(item.msg, item.isSelf);
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
    markVisibleMessagesSeen();
  }

  const seenMsgIds = new Set();

  function markVisibleMessagesSeen() {
    if (!document.hasFocus()) return;
    const list = conversations.get(activeTarget) || [];
    for (const item of list) {
      if (!item.isSelf && !seenMsgIds.has(item.msg.msgId)) {
        seenMsgIds.add(item.msg.msgId);
        vscode.postMessage({ command: 'messageSeen', msgId: item.msg.msgId, fromId: item.msg.fromId });
      }
    }
  }

  window.addEventListener('focus', markVisibleMessagesSeen);

  function addSystemNode(text) {
    const div = document.createElement('div');
    div.className = 'system-msg';
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function autoResize() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  }

  function clearAttachments() {
    attachedCode = null;
    attachedFile = null;
    attachmentDrawerEl.classList.add('hidden');
    attachmentContentEl.innerHTML = '';
  }

  function showAttachmentDrawer(type, summaryHtml) {
    attachmentContentEl.innerHTML = summaryHtml;
    attachmentDrawerEl.classList.remove('hidden');
    inputEl.focus();
  }

  function readFileAsAttachment(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        data: e.target.result
      });
      reader.readAsDataURL(file);
    });
  }

  function handleFileSelected(file) {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      addSystemNode(`File size exceeds 25 MB limit (${formatBytes(file.size)}). Please choose a smaller file.`);
      return;
    }

    readFileAsAttachment(file).then((att) => {
      attachedFile = att;

      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      const isImg = file.type.startsWith('image/');
      const iconSvg = isPdf ? ICONS.fileText : (isImg ? ICONS.image : ICONS.fileText);

      showAttachmentDrawer('file', `
        <div class="drawer-card">
          <div style="display:flex;align-items:center;color:var(--wa-teal);">${iconSvg}</div>
          <div style="overflow:hidden;">
            <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(file.name)}</div>
            <div style="font-size:0.75em;color:#9b96a6;">${formatBytes(file.size)} · Ready to send to ${activeTarget === 'general' ? '#general' : 'peer'}</div>
          </div>
        </div>
      `);
    });
  }

  // Select multiple photos/files at once (like WhatsApp's multi-select gallery
  // picker): each becomes its own message, sent immediately in order.
  async function handleMultipleFilesSelected(fileList) {
    const files = Array.from(fileList);
    const oversized = files.filter((f) => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      addSystemNode(`${oversized.length} file(s) exceed the 25 MB limit and were skipped.`);
    }
    const toId = activeTarget === 'general' || activeTarget.startsWith('grp-') ? undefined : activeTarget;
    const groupId = activeTarget.startsWith('grp-') ? activeTarget : undefined;
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) continue;
      const att = await readFileAsAttachment(file);
      vscode.postMessage({ command: 'send', text: '', file: att, toId, groupId });
    }
  }

  function handleAvatarFileSelected(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        // Create 128x128 compact thumbnail
        const canvas = document.createElement('canvas');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

        const avatarDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        selfAvatar = avatarDataUrl;
        renderAvatarElement(selfAvatarEl, selfAvatar, selfUser, selfColor);

        // Send to extension to persist and broadcast
        vscode.postMessage({ command: 'changeAvatar', avatar: avatarDataUrl });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function send() {
    const text = inputEl.value.trim();
    if (!text && !attachedCode && !attachedFile) {
      return;
    }

    const toId = activeTarget === 'general' || activeTarget.startsWith('grp-') ? undefined : activeTarget;
    const groupId = activeTarget.startsWith('grp-') ? activeTarget : undefined;

    vscode.postMessage({
      command: 'send',
      text,
      code: attachedCode || undefined,
      file: attachedFile || undefined,
      toId,
      groupId,
      replyTo: replyingTo || undefined
    });

    inputEl.value = '';
    autoResize();
    clearAttachments();
    clearReply();
  }

  function startReply(msg) {
    replyingTo = { msgId: msg.msgId, fromName: msg.fromId === selfId ? 'You' : (msg.fromName || 'Peer'), text: messagePreviewText(msg).slice(0, 140) };
    replyBarNameEl.textContent = replyingTo.fromName;
    replyBarTextEl.textContent = replyingTo.text;
    replyBarEl.classList.remove('hidden');
    inputEl.focus();
  }

  function clearReply() {
    replyingTo = null;
    replyBarEl.classList.add('hidden');
  }

  if (replyBarCloseBtn) {
    replyBarCloseBtn.addEventListener('click', clearReply);
  }

  function currentSendTargets() {
    const toId = activeTarget === 'general' || activeTarget.startsWith('grp-') ? undefined : activeTarget;
    const groupId = activeTarget.startsWith('grp-') ? activeTarget : undefined;
    return { toId, groupId };
  }

  function sendSticker(emoji) {
    const { toId, groupId } = currentSendTargets();
    vscode.postMessage({ command: 'send', text: '', sticker: { emoji }, toId, groupId });
  }

  function sendBuiltinGif(key) {
    const { toId, groupId } = currentSendTargets();
    vscode.postMessage({ command: 'send', text: '', gif: { key }, toId, groupId });
  }

  let activeStickerTab = 'stickers';

  function populateStickerGrid(filter) {
    const q = (filter || '').trim().toLowerCase();
    stickerGridEl.innerHTML = '';
    const matches = STICKERS.filter((s) => !q || s.tags.some((t) => t.includes(q)) || s.e === q);
    if (matches.length === 0) {
      stickerGridEl.innerHTML = '<div class="no-peers-msg">No stickers match.</div>';
      return;
    }
    for (const s of matches) {
      const btn = document.createElement('button');
      btn.className = 'sticker-pick-btn';
      btn.type = 'button';
      btn.textContent = s.e;
      btn.title = s.tags[0] || 'Send sticker';
      btn.addEventListener('click', () => {
        sendSticker(s.e);
        stickerPanelEl.classList.add('hidden');
      });
      stickerGridEl.appendChild(btn);
    }
  }

  function populateGifGrid(filter) {
    const q = (filter || '').trim().toLowerCase();
    gifGridEl.innerHTML = '';
    const matches = BUILTIN_GIFS.filter((g) => !q || g.tags.some((t) => t.includes(q)));
    if (matches.length === 0) {
      gifGridEl.innerHTML = '<div class="no-peers-msg">No GIFs match. Try another word, or upload your own.</div>';
      return;
    }
    for (const g of matches) {
      const btn = document.createElement('button');
      btn.className = 'gif-pick-btn';
      btn.type = 'button';
      btn.title = g.tags[0] || 'Send GIF';
      btn.innerHTML = `<span class="gif-pick-emoji ${g.anim}">${g.e}</span>`;
      btn.addEventListener('click', () => {
        sendBuiltinGif(g.key);
        stickerPanelEl.classList.add('hidden');
      });
      gifGridEl.appendChild(btn);
    }
  }

  function refreshStickerSearch() {
    const q = stickerSearchEl ? stickerSearchEl.value : '';
    if (activeStickerTab === 'gifs') {
      populateGifGrid(q);
    } else {
      populateStickerGrid(q);
    }
  }

  function sendGifImmediately(file) {
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      addSystemNode(`GIF exceeds 25 MB limit (${formatBytes(file.size)}).`);
      return;
    }
    readFileAsAttachment(file).then((att) => {
      const { toId, groupId } = currentSendTargets();
      vscode.postMessage({ command: 'send', text: '', file: att, toId, groupId });
    });
  }

  if (stickerBtn) {
    stickerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const opening = stickerPanelEl.classList.contains('hidden');
      stickerPanelEl.classList.toggle('hidden');
      if (opening) {
        if (stickerSearchEl) stickerSearchEl.value = '';
        refreshStickerSearch();
      }
    });
  }

  if (stickerSearchEl) {
    stickerSearchEl.addEventListener('input', refreshStickerSearch);
  }

  stickerTabs.forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      stickerTabs.forEach((b) => b.classList.remove('active'));
      tabBtn.classList.add('active');
      activeStickerTab = tabBtn.getAttribute('data-tab') === 'gifs' ? 'gifs' : 'stickers';
      if (activeStickerTab === 'gifs') {
        stickerGridEl.classList.add('hidden');
        gifTabContentEl.classList.remove('hidden');
      } else {
        stickerGridEl.classList.remove('hidden');
        gifTabContentEl.classList.add('hidden');
      }
      if (stickerSearchEl) stickerSearchEl.value = '';
      refreshStickerSearch();
    });
  });

  if (gifUploadLink) {
    gifUploadLink.addEventListener('click', () => {
      gifPickerEl.value = '';
      gifPickerEl.click();
    });
  }

  if (gifPickerEl) {
    gifPickerEl.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        sendGifImmediately(e.target.files[0]);
        stickerPanelEl.classList.add('hidden');
      }
    });
  }

  // ==================== REACTIONS ====================
  function openReactionPicker(msg, anchorEl) {
    reactionTargetMsgId = msg.msgId;
    reactionPickerQuickEl.innerHTML = '';
    for (const emoji of QUICK_REACTIONS) {
      const btn = document.createElement('button');
      btn.className = 'reaction-quick-btn';
      btn.textContent = emoji;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mine = (msg.reactions || []).find((r) => r.emoji === emoji && r.by.includes(selfId));
        vscode.postMessage({ command: 'react', msgId: msg.msgId, emoji: mine ? null : emoji });
        reactionPickerEl.classList.add('hidden');
      });
      reactionPickerQuickEl.appendChild(btn);
    }
    const rect = anchorEl.getBoundingClientRect();
    reactionPickerEl.style.top = Math.max(8, rect.top - 44) + 'px';
    reactionPickerEl.style.left = Math.min(window.innerWidth - 220, Math.max(8, rect.left - 60)) + 'px';
    reactionPickerEl.classList.remove('hidden');
  }

  document.addEventListener('click', (e) => {
    if (!reactionPickerEl.contains(e.target)) {
      reactionPickerEl.classList.add('hidden');
    }
  });

  // ==================== PROFILE PREVIEW ====================
  let profileModalPeerId = null;

  function openProfileModal(peerId) {
    const peer = findPeerById(peerId);
    if (!peer) return;
    profileModalPeerId = peerId;
    renderAvatarElement(profileModalAvatarEl, peer.avatar, peer.username, peer.color);
    profileModalNameEl.textContent = peer.username + (peerId === selfId ? ' (You)' : '');
    if (peerId === selfId) {
      profileModalStatusEl.textContent = 'This is you, on this machine.';
      profileModalAddressEl.textContent = '';
    } else {
      profileModalStatusEl.textContent = peer.connected ? '● Online now' : '○ Offline';
      profileModalAddressEl.textContent = peer.sameRoom ? `${peer.address}:${peer.wsPort}` : `${peer.address} · different room`;
    }
    btnProfileMessage.classList.toggle('hidden', peerId === selfId);
    profileModalEl.classList.remove('hidden');
  }

  if (btnCloseProfile) btnCloseProfile.addEventListener('click', () => profileModalEl.classList.add('hidden'));
  profileModalEl.addEventListener('click', (e) => {
    if (e.target === profileModalEl) profileModalEl.classList.add('hidden');
  });
  if (btnProfileMessage) {
    btnProfileMessage.addEventListener('click', () => {
      if (profileModalPeerId) {
        setActiveTarget(profileModalPeerId);
      }
      profileModalEl.classList.add('hidden');
    });
  }

  // ==================== FORWARD MESSAGE ====================
  function openForwardModal(msgId) {
    forwardSourceMsgId = msgId;
    forwardTargetListEl.innerHTML = '';

    const addOption = (value, label) => {
      const item = document.createElement('label');
      item.className = 'peer-check-item';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = value;
      const nameSpan = document.createElement('span');
      nameSpan.className = 'peer-check-name';
      nameSpan.textContent = label;
      item.appendChild(checkbox);
      item.appendChild(nameSpan);
      forwardTargetListEl.appendChild(item);
    };

    addOption('general', '#general (Everyone)');
    for (const g of groups) addOption('grp:' + g.id, g.name);
    for (const p of peers.filter((p) => p.sameRoom)) addOption('peer:' + p.id, p.username);

    forwardModalEl.classList.remove('hidden');
  }

  function closeForwardModal() {
    forwardModalEl.classList.add('hidden');
    forwardSourceMsgId = null;
  }

  if (btnCloseForward) btnCloseForward.addEventListener('click', closeForwardModal);
  if (btnCancelForward) btnCancelForward.addEventListener('click', closeForwardModal);
  if (btnSubmitForward) {
    btnSubmitForward.addEventListener('click', () => {
      const checked = Array.from(forwardTargetListEl.querySelectorAll('input[type="checkbox"]:checked')).map((cb) => cb.value);
      if (checked.length === 0 || !forwardSourceMsgId) {
        closeForwardModal();
        return;
      }
      const targets = checked.map((v) => {
        if (v === 'general') return {};
        if (v.startsWith('grp:')) return { groupId: v.slice(4) };
        return { toId: v.slice(5) };
      });
      vscode.postMessage({ command: 'forward', msgId: forwardSourceMsgId, targets });
      closeForwardModal();
    });
  }

  // ==================== MESSAGE INFO (delivered / read) ====================
  function renderMsgInfoRow(container, peerId) {
    const peer = findPeerById(peerId);
    const row = document.createElement('div');
    row.className = 'msg-info-row';
    const av = document.createElement('div');
    av.className = 'msg-info-avatar';
    renderAvatarElement(av, peer ? peer.avatar : null, peer ? peer.username : 'Peer', peer ? peer.color : '#c7a254');
    row.appendChild(av);
    const name = document.createElement('span');
    name.textContent = peer ? peer.username : 'Unknown peer';
    row.appendChild(name);
    container.appendChild(row);
  }

  function openMessageInfo(msg) {
    const recipients = msg._recipients || [];
    const read = new Set(msg._read || []);
    const delivered = new Set(msg._delivered || []);
    msgInfoReadListEl.innerHTML = '';
    msgInfoDeliveredListEl.innerHTML = '';
    let anyRead = false;
    let anyDelivered = false;
    for (const id of recipients) {
      if (read.has(id)) {
        anyRead = true;
        renderMsgInfoRow(msgInfoReadListEl, id);
      } else if (delivered.has(id)) {
        anyDelivered = true;
        renderMsgInfoRow(msgInfoDeliveredListEl, id);
      }
    }
    if (!anyRead) msgInfoReadListEl.innerHTML = '<div class="no-peers-msg">No one yet.</div>';
    if (!anyDelivered) msgInfoDeliveredListEl.innerHTML = '<div class="no-peers-msg">No one yet.</div>';
    msgInfoModalEl.classList.remove('hidden');
  }

  if (btnCloseMsgInfo) btnCloseMsgInfo.addEventListener('click', () => msgInfoModalEl.classList.add('hidden'));
  msgInfoModalEl.addEventListener('click', (e) => {
    if (e.target === msgInfoModalEl) msgInfoModalEl.classList.add('hidden');
  });

  // Event Listeners
  sendBtn.addEventListener('click', send);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  inputEl.addEventListener('input', () => {
    autoResize();
    const now = Date.now();
    if (now - lastTypingSent > 1800) {
      lastTypingSent = now;
      vscode.postMessage({ command: 'typing' });
    }
  });

  chatItemGeneral.addEventListener('click', () => {
    setActiveTarget('general');
  });

  peerSearchInput.addEventListener('input', () => {
    renderPeersList();
    renderCustomGroupsList();
  });

  btnBack.addEventListener('click', () => {
    sidebarEl.classList.remove('view-chat');
    mainChatEl.classList.add('view-list');
  });

  function promptInlineUsernameChange() {
    if (document.getElementById('self-username-inline-input')) {
      return;
    }
    const currentName = selfUser;
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'self-username-inline-input';
    input.className = 'self-username-inline-input';
    input.value = currentName;
    input.maxLength = 25;

    let committed = false;
    function commit() {
      if (committed) return;
      committed = true;
      const val = input.value.trim();
      if (val && val !== currentName) {
        selfUser = val;
        selfUsernameEl.textContent = val;
        vscode.postMessage({ command: 'setUsername', username: val });
      }
      if (input.parentNode) {
        input.replaceWith(selfUsernameEl);
      }
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        committed = true;
        if (input.parentNode) {
          input.replaceWith(selfUsernameEl);
        }
      }
    });

    input.addEventListener('blur', () => {
      commit();
    });

    selfUsernameEl.replaceWith(input);
    input.focus();
    input.select();
  }

  // Clicking on self avatar opens file picker
  if (selfAvatarContainerEl) {
    selfAvatarContainerEl.addEventListener('click', (e) => {
      e.stopPropagation();
      avatarFilePickerEl.click();
    });
  }

  // Clicking on self name row triggers inline username edit
  if (selfNameRowEl) {
    selfNameRowEl.addEventListener('click', (e) => {
      e.stopPropagation();
      promptInlineUsernameChange();
    });
  }

  if (selfProfileEl) {
    selfProfileEl.addEventListener('click', (e) => {
      if (selfAvatarContainerEl && (e.target === selfAvatarContainerEl || selfAvatarContainerEl.contains(e.target))) {
        avatarFilePickerEl.click();
      } else {
        promptInlineUsernameChange();
      }
    });
  }

  avatarFilePickerEl.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleAvatarFileSelected(e.target.files[0]);
    }
  });

  btnChangeRoom.addEventListener('click', () => {
    vscode.postMessage({ command: 'changeRoom' });
  });

  // Group Info Drawer Toggle
  activeChatInfoEl.addEventListener('click', () => {
    if (activeTarget === 'general' || activeTarget.startsWith('grp-')) {
      renderGroupInfoDrawer();
      groupInfoDrawerEl.classList.remove('hidden');
    } else {
      openProfileModal(activeTarget);
    }
  });

  btnGroupInfo.addEventListener('click', () => {
    renderGroupInfoDrawer();
    groupInfoDrawerEl.classList.remove('hidden');
  });

  btnCloseGroupInfo.addEventListener('click', () => {
    groupInfoDrawerEl.classList.add('hidden');
  });

  // Create Group Modal Handlers
  function openCreateGroupModal() {
    groupNameInput.value = '';
    createGroupPeerListEl.innerHTML = '';

    const availablePeers = peers.filter((p) => p.sameRoom && p.id !== selfId);
    if (availablePeers.length === 0) {
      createGroupPeerListEl.innerHTML = '<div class="no-peers-msg">No peers on your LAN yet. You can create the group now and add members later!</div>';
    } else {
      for (const peer of availablePeers) {
        const item = document.createElement('label');
        item.className = 'peer-check-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = peer.id;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'peer-check-name';
        nameSpan.textContent = peer.username + (peer.connected ? ' (Online)' : ' (Offline)');

        item.appendChild(checkbox);
        item.appendChild(nameSpan);
        createGroupPeerListEl.appendChild(item);
      }
    }
    createGroupModalEl.classList.remove('hidden');
    groupNameInput.focus();
  }

  function closeCreateGroupModal() {
    createGroupModalEl.classList.add('hidden');
  }

  if (btnNewGroup) {
    btnNewGroup.addEventListener('click', openCreateGroupModal);
  }
  if (btnCloseCreateGroup) btnCloseCreateGroup.addEventListener('click', closeCreateGroupModal);
  if (btnCancelCreateGroup) btnCancelCreateGroup.addEventListener('click', closeCreateGroupModal);

  if (btnSubmitCreateGroup) {
    btnSubmitCreateGroup.addEventListener('click', () => {
      const name = groupNameInput.value.trim();
      if (!name) {
        groupNameInput.style.borderColor = '#ea3943';
        groupNameInput.focus();
        return;
      }
      const checkboxes = createGroupPeerListEl.querySelectorAll('input[type="checkbox"]:checked');
      const selectedMemberIds = Array.from(checkboxes).map((cb) => cb.value);

      vscode.postMessage({
        command: 'createGroup',
        name,
        members: selectedMemberIds
      });
      closeCreateGroupModal();
    });
  }

  if (groupNameInput) {
    groupNameInput.addEventListener('input', () => {
      groupNameInput.style.borderColor = '';
    });
  }

  // Add Member to Existing Custom Group
  if (btnAddMemberToGroup) {
    btnAddMemberToGroup.addEventListener('click', () => {
      if (!activeTarget.startsWith('grp-')) return;
      const group = groups.find((g) => g.id === activeTarget);
      if (!group) return;

      const isHidden = addMemberDropdownEl.classList.contains('hidden');
      if (!isHidden) {
        addMemberDropdownEl.classList.add('hidden');
        return;
      }

      addMemberPeerListEl.innerHTML = '';
      const nonMembers = peers.filter((p) => p.sameRoom && !group.members.includes(p.id));
      if (nonMembers.length === 0) {
        addMemberPeerListEl.innerHTML = '<div class="no-peers-msg" style="padding:6px 0;">All nearby peers on LAN are already members.</div>';
      } else {
        for (const peer of nonMembers) {
          const row = document.createElement('div');
          row.className = 'add-member-peer-row';

          const nameSpan = document.createElement('span');
          nameSpan.textContent = peer.username;
          nameSpan.style.fontSize = '0.9em';
          nameSpan.style.color = '#e9edef';

          const addBtn = document.createElement('button');
          addBtn.className = 'small-action-btn';
          addBtn.textContent = 'Add';
          addBtn.addEventListener('click', () => {
            vscode.postMessage({
              command: 'addGroupMember',
              groupId: group.id,
              memberId: peer.id
            });
            addMemberDropdownEl.classList.add('hidden');
          });

          row.appendChild(nameSpan);
          row.appendChild(addBtn);
          addMemberPeerListEl.appendChild(row);
        }
      }
      addMemberDropdownEl.classList.remove('hidden');
    });
  }

  // Clear Chat History (two-step inline confirmation, safe for VS Code webview sandbox)
  if (btnClearHistory) {
    btnClearHistory.addEventListener('click', () => {
      if (clearHistoryIdleEl && clearHistoryConfirmBoxEl) {
        clearHistoryIdleEl.classList.add('hidden');
        clearHistoryConfirmBoxEl.classList.remove('hidden');
      }
    });
  }

  if (btnConfirmClearYes) {
    btnConfirmClearYes.addEventListener('click', () => {
      vscode.postMessage({ command: 'clearHistory' });
      if (clearHistoryIdleEl && clearHistoryConfirmBoxEl) {
        clearHistoryConfirmBoxEl.classList.add('hidden');
        clearHistoryIdleEl.classList.remove('hidden');
      }
    });
  }

  if (btnConfirmClearNo) {
    btnConfirmClearNo.addEventListener('click', () => {
      if (clearHistoryIdleEl && clearHistoryConfirmBoxEl) {
        clearHistoryConfirmBoxEl.classList.add('hidden');
        clearHistoryIdleEl.classList.remove('hidden');
      }
    });
  }

  btnRefreshPeers.addEventListener('click', () => {
    vscode.postMessage({ command: 'refreshPeers' });
  });

  attachBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    attachMenuEl.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!attachMenuEl.contains(e.target) && e.target !== attachBtn) {
      attachMenuEl.classList.add('hidden');
    }
    if (stickerPanelEl && !stickerPanelEl.contains(e.target) && e.target !== stickerBtn) {
      stickerPanelEl.classList.add('hidden');
    }
    if (addMemberDropdownEl && !addMemberDropdownEl.contains(e.target) && e.target !== btnAddMemberToGroup) {
      addMemberDropdownEl.classList.add('hidden');
    }
  });

  attachDocBtn.addEventListener('click', () => {
    attachMenuEl.classList.add('hidden');
    filePickerEl.value = '';
    filePickerEl.removeAttribute('accept');
    filePickerEl.click();
  });

  attachImgBtn.addEventListener('click', () => {
    attachMenuEl.classList.add('hidden');
    filePickerEl.value = '';
    filePickerEl.setAttribute('accept', 'image/*');
    filePickerEl.click();
  });

  attachCodeBtn.addEventListener('click', () => {
    attachMenuEl.classList.add('hidden');
    const toId = activeTarget === 'general' || activeTarget.startsWith('grp-') ? undefined : activeTarget;
    const groupId = activeTarget.startsWith('grp-') ? activeTarget : undefined;
    vscode.postMessage({ command: 'pickFile', toId, groupId });
  });

  filePickerEl.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 1) {
      handleMultipleFilesSelected(e.target.files);
    } else if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  });

  attachmentCloseBtn.addEventListener('click', clearAttachments);

  // Drag and drop PDF or media
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropOverlayEl.classList.remove('hidden');
  });

  window.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null || e.clientX <= 0 || e.clientY <= 0) {
      dropOverlayEl.classList.add('hidden');
    }
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dropOverlayEl.classList.add('hidden');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 1) {
      handleMultipleFilesSelected(e.dataTransfer.files);
    } else if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  // Host Message Handler
  window.addEventListener('message', (event) => {
    const m = event.data;
    switch (m.type) {
      case 'init': {
        selfId = m.self.id;
        selfUser = m.self.username;
        selfColor = m.self.color || '#c7a254';
        selfAvatar = m.self.avatar || null;

        selfUsernameEl.textContent = selfUser;
        renderAvatarElement(selfAvatarEl, selfAvatar, selfUser, selfColor);
        roomNameEl.textContent = m.room;

        if (Array.isArray(m.peers)) {
          peers = m.peers;
          renderPeersList();
        }

        if (Array.isArray(m.groups)) {
          groups = m.groups;
          renderCustomGroupsList();
        }

        // Load Persistent Chat History!
        if (Array.isArray(m.history)) {
          conversations.clear();
          for (const record of m.history) {
            const key = getConversationKey(record.msg, record.isSelf);
            if (!conversations.has(key)) {
              conversations.set(key, []);
            }
            conversations.get(key).push({ msg: record.msg, isSelf: record.isSelf });
          }
          renderActiveConversation();
        }
        break;
      }
      case 'selfUpdated':
        selfId = m.self.id;
        selfUser = m.self.username;
        selfColor = m.self.color || selfColor;
        selfAvatar = m.self.avatar !== undefined ? m.self.avatar : selfAvatar;
        selfUsernameEl.textContent = selfUser;
        renderAvatarElement(selfAvatarEl, selfAvatar, selfUser, selfColor);
        if (!groupInfoDrawerEl.classList.contains('hidden')) {
          renderGroupInfoDrawer();
        }
        addSystemNode(`Profile updated: ${selfUser}.`);
        break;
      case 'room':
        roomNameEl.textContent = m.room;
        addSystemNode(`Room passphrase changed to "${m.room}".`);
        renderPeersList();
        break;
      case 'groupsList':
        if (Array.isArray(m.groups)) {
          groups = m.groups;
          renderCustomGroupsList();
          if (activeTarget.startsWith('grp-')) {
            const currentGroup = groups.find((g) => g.id === activeTarget);
            if (currentGroup) {
              setActiveTarget(activeTarget);
              if (!groupInfoDrawerEl.classList.contains('hidden')) {
                renderGroupInfoDrawer();
              }
            } else {
              setActiveTarget('general');
            }
          }
        }
        break;
      case 'peersList':
        if (Array.isArray(m.peers)) {
          peers = m.peers;
          renderPeersList();
          if (activeTarget === 'general') {
            const count = peers.filter((p) => p.sameRoom).length;
            activeChatSubEl.textContent = `Public LAN Group · ${count} online (click for info)`;
          }
          if (!groupInfoDrawerEl.classList.contains('hidden')) {
            renderGroupInfoDrawer();
          }
        }
        break;
      case 'message': {
        if (Array.isArray(m.recipientIds)) {
          m.msg._recipients = m.recipientIds;
        }
        const key = getConversationKey(m.msg, m.isSelf);
        if (!conversations.has(key)) {
          conversations.set(key, []);
        }
        conversations.get(key).push({ msg: m.msg, isSelf: m.isSelf });

        if (activeTarget === key) {
          appendMessageRow(m.msg, m.isSelf);
          messagesEl.scrollTop = messagesEl.scrollHeight;
          markVisibleMessagesSeen();
        } else {
          const current = unreadCounts.get(key) || 0;
          unreadCounts.set(key, current + 1);
          renderPeersList();
          renderCustomGroupsList();
        }
        break;
      }
      case 'ackUpdate': {
        const entry = messageIndex.get(m.msgId);
        if (entry) {
          entry.msg._delivered = m.delivered;
          entry.msg._read = m.read;
          entry.msg._recipients = entry.msg._recipients && entry.msg._recipients.length >= m.total
            ? entry.msg._recipients
            : entry.msg._recipients || [];
          if (entry.row && entry.row.isConnected) {
            const oldFooter = entry.row.querySelector('.msg-check');
            if (oldFooter) {
              const fresh = buildTickNode(entry.msg);
              oldFooter.replaceWith(fresh);
            }
          }
        }
        break;
      }
      case 'reactionsUpdate': {
        const entry = messageIndex.get(m.msgId);
        if (entry) {
          entry.msg.reactions = m.reactions;
          if (entry.row && entry.row.isConnected) {
            const old = entry.row.querySelector('.reactions-row');
            const fresh = buildReactionsNode(entry.msg);
            if (old && fresh) old.replaceWith(fresh);
            else if (old && !fresh) old.remove();
            else if (!old && fresh) entry.row.appendChild(fresh);
          }
        }
        break;
      }
      case 'historyCleared':
        conversations.clear();
        unreadCounts.clear();
        renderActiveConversation();
        renderPeersList();
        renderCustomGroupsList();
        addSystemNode('Local chat history cleared.');
        break;
      case 'system':
        addSystemNode(m.text);
        break;
      case 'typing':
        if (activeTarget === 'general' || activeTarget === m.id) {
          typingTextEl.textContent = `${m.username} is typing…`;
          typingEl.classList.remove('hidden');
          clearTimeout(typingTimeout);
          typingTimeout = setTimeout(() => typingEl.classList.add('hidden'), 2500);
        }
        break;
      case 'attachCode':
        attachedCode = m.code;
        showAttachmentDrawer('code', `
          <div class="drawer-card">
            <div style="display:flex;align-items:center;color:var(--wa-teal);">${ICONS.code}</div>
            <div style="overflow:hidden;">
              <div style="font-weight:600;">Snippet: ${escapeHtml(m.code.language)}${m.code.fileName ? ' · ' + escapeHtml(m.code.fileName) : ''}</div>
              <div style="font-size:0.75em;color:#8696a0;">Ready to send</div>
            </div>
          </div>
        `);
        break;
      case 'attachFile':
        attachedFile = m.file;
        showAttachmentDrawer('file', `
          <div class="drawer-card">
            <div style="display:flex;align-items:center;color:var(--wa-teal);">${ICONS.fileText}</div>
            <div style="overflow:hidden;">
              <div style="font-weight:600;">${escapeHtml(m.file.name)}</div>
              <div style="font-size:0.75em;color:#8696a0;">${formatBytes(m.file.size)} · Ready to send</div>
            </div>
          </div>
        `);
        break;
      case 'dmTarget':
        if (m.peerId) {
          setActiveTarget(m.peerId);
        }
        break;
    }
  });

  autoResize();

  // Signal ready to host so webview is guaranteed to receive persisted profile, peers, room, and history
  vscode.postMessage({ command: 'ready' });
}());
