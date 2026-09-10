const MENU_ID = 'keyword-hider-add-selection';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(
    { keywords: null, hiddenCount: null, caseSensitive: null, enabled: null, maskFields: null },
    (res) => {
      const defaults = {};
      if (res.keywords === null) defaults.keywords = [];
      if (res.hiddenCount === null) defaults.hiddenCount = 0;
      if (res.caseSensitive === null) defaults.caseSensitive = false;
      if (res.enabled === null) defaults.enabled = true;
      if (res.maskFields === null) defaults.maskFields = true;
      if (Object.keys(defaults).length > 0) {
        chrome.storage.local.set(defaults);
      }
    }
  );

  // 우클릭(선택 텍스트) 컨텍스트 메뉴 등록
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Keyword Hider에 "%s" 추가',
      contexts: ['selection'],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== MENU_ID) return;
  const text = (info.selectionText || '').trim();
  if (!text) return;

  chrome.storage.local.get({ keywords: [] }, (res) => {
    if (res.keywords.includes(text)) {
      flashBadge('!', '#faa61a'); // 이미 등록된 단어
      return;
    }
    const newList = [...res.keywords, text];
    chrome.storage.local.set({ keywords: newList }, () => {
      flashBadge('✓', '#43b581'); // 추가 완료
    });
  });
});

function flashBadge(text, color) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1500);
}

// ---------- 탭별 임시 비활성화 ----------
const pausedTabs = new Set();

// 서비스 워커가 재시작돼도 세션 동안은 유지되도록 storage.session에 백업
chrome.storage.session.get({ pausedTabIds: [] }, (res) => {
  (res.pausedTabIds || []).forEach((id) => pausedTabs.add(id));
});

function persistPausedTabs() {
  chrome.storage.session.set({ pausedTabIds: Array.from(pausedTabs) });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'get-page-paused') {
    const tabId = sender.tab && sender.tab.id;
    sendResponse({ paused: tabId != null && pausedTabs.has(tabId) });
    return; // 동기 응답
  }

  if (message.type === 'toggle-tab-pause') {
    const { tabId, paused } = message;
    if (paused) {
      pausedTabs.add(tabId);
    } else {
      pausedTabs.delete(tabId);
    }
    persistPausedTabs();
    chrome.tabs.sendMessage(tabId, { type: 'set-paused', paused }).catch(() => {});
    sendResponse({ ok: true });
  }

  if (message.type === 'get-tab-pause-state') {
    sendResponse({ paused: pausedTabs.has(message.tabId) });
  }
});

// 탭이 닫히면 목록 정리
chrome.tabs.onRemoved.addListener((tabId) => {
  if (pausedTabs.delete(tabId)) persistPausedTabs();
});