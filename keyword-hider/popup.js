document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('master-toggle');
  const counterEl = document.getElementById('counter');
  const openBtn = document.getElementById('open-options');
  const pageToggle = document.getElementById('page-pause-toggle');

  let currentTabId = null;

  function render() {
    chrome.storage.local.get({ enabled: true, hiddenCount: 0 }, (res) => {
      toggle.checked = res.enabled;
      counterEl.textContent = res.hiddenCount.toLocaleString();
    });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab) return;
      currentTabId = tab.id;
      chrome.runtime.sendMessage(
        { type: 'get-tab-pause-state', tabId: currentTabId },
        (res) => {
          pageToggle.checked = !!(res && res.paused);
        }
      );
    });
  }

  toggle.addEventListener('change', () => {
    chrome.storage.local.set({ enabled: toggle.checked });
  });

  pageToggle.addEventListener('change', () => {
    if (currentTabId == null) return;
    chrome.runtime.sendMessage({
      type: 'toggle-tab-pause',
      tabId: currentTabId,
      paused: pageToggle.checked,
    });
  });

  openBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  render();
});