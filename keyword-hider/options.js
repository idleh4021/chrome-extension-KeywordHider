document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('keyword-list');
  const inputEl = document.getElementById('keyword-input');
  const addBtn = document.getElementById('add-btn');
  const counterEl = document.getElementById('counter');
  const resetBtn = document.getElementById('reset-btn');
  const caseCheckbox = document.getElementById('case-sensitive');
  const masterCheckbox = document.getElementById('master-enabled');

  function render() {
    chrome.storage.local.get(
      { keywords: [], hiddenCount: 0, caseSensitive: false, enabled: true },
      (res) => {
        listEl.innerHTML = '';
        if (res.keywords.length === 0) {
          const li = document.createElement('li');
          li.className = 'empty-msg';
          li.textContent = '등록된 단어가 없습니다.';
          listEl.appendChild(li);
        } else {
          res.keywords.forEach((kw, idx) => {
            const li = document.createElement('li');
            const span = document.createElement('span');
            span.textContent = kw;
            const delBtn = document.createElement('button');
            delBtn.textContent = '삭제';
            delBtn.className = 'del-btn';
            delBtn.addEventListener('click', () => {
              const newList = res.keywords.filter((_, i) => i !== idx);
              chrome.storage.local.set({ keywords: newList }, render);
            });
            li.appendChild(span);
            li.appendChild(delBtn);
            listEl.appendChild(li);
          });
        }
        counterEl.textContent = res.hiddenCount.toLocaleString();
        caseCheckbox.checked = res.caseSensitive;
        masterCheckbox.checked = res.enabled;
      }
    );
  }

  function addKeyword() {
    const val = inputEl.value.trim();
    if (!val) return;
    chrome.storage.local.get({ keywords: [] }, (res) => {
      if (res.keywords.includes(val)) {
        inputEl.value = '';
        return;
      }
      const newList = [...res.keywords, val];
      chrome.storage.local.set({ keywords: newList }, () => {
        inputEl.value = '';
        render();
      });
    });
  }

  addBtn.addEventListener('click', addKeyword);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addKeyword();
  });

  caseCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ caseSensitive: caseCheckbox.checked });
  });

  masterCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ enabled: masterCheckbox.checked });
  });

  resetBtn.addEventListener('click', () => {
    if (confirm('누적 숨김 횟수를 0으로 초기화할까요?')) {
      chrome.storage.local.set({ hiddenCount: 0 }, render);
    }
  });

  render();
});
