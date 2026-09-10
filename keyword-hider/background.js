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

