document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('master-toggle');
  const counterEl = document.getElementById('counter');
  const openBtn = document.getElementById('open-options');

  function render() {
    chrome.storage.local.get({ enabled: true, hiddenCount: 0 }, (res) => {
      toggle.checked = res.enabled;
      counterEl.textContent = res.hiddenCount.toLocaleString();
    });
  }

  toggle.addEventListener('change', () => {
    chrome.storage.local.set({ enabled: toggle.checked });
  });

  openBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  render();
});
