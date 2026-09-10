chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(
    { keywords: null, hiddenCount: null, caseSensitive: null, enabled: null },
    (res) => {
      const defaults = {};
      if (res.keywords === null) defaults.keywords = [];
      if (res.hiddenCount === null) defaults.hiddenCount = 0;
      if (res.caseSensitive === null) defaults.caseSensitive = false;
      if (res.enabled === null) defaults.enabled = true;
      if (Object.keys(defaults).length > 0) {
        chrome.storage.local.set(defaults);
      }
    }
  );
});
