document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('keyword-list');
  const inputEl = document.getElementById('keyword-input');
  const addBtn = document.getElementById('add-btn');
  const counterEl = document.getElementById('counter');
  const resetBtn = document.getElementById('reset-btn');
  const caseCheckbox = document.getElementById('case-sensitive');
  const masterCheckbox = document.getElementById('master-enabled');
  const maskFieldsCheckbox = document.getElementById('mask-fields');
  const revealToggle = document.getElementById('reveal-words-toggle');

  const WORD_MASK = '●●●'; // 글자 수 유추 방지를 위해 고정된 길이로 표시

  let latestKeywords = [];
  let wordsVisible = false; // 페이지를 열 때마다 항상 가려진 상태로 시작 (저장하지 않음)

  function renderList() {
    listEl.innerHTML = '';
    if (latestKeywords.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty-msg';
      li.textContent = '등록된 단어가 없습니다.';
      listEl.appendChild(li);
      return;
    }
    latestKeywords.forEach((kw, idx) => {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = wordsVisible ? kw : WORD_MASK;
      const delBtn = document.createElement('button');
      delBtn.textContent = '삭제';
      delBtn.className = 'del-btn';
      delBtn.addEventListener('click', () => {
        const newList = latestKeywords.filter((_, i) => i !== idx);
        chrome.storage.local.set({ keywords: newList }, loadAndRender);
      });
      li.appendChild(span);
      li.appendChild(delBtn);
      listEl.appendChild(li);
    });
  }

  function loadAndRender() {
    chrome.storage.local.get(
      { keywords: [], hiddenCount: 0, caseSensitive: false, enabled: true, maskFields: true },
      (res) => {
        latestKeywords = res.keywords;
        renderList();
        counterEl.textContent = res.hiddenCount.toLocaleString();
        caseCheckbox.checked = res.caseSensitive;
        masterCheckbox.checked = res.enabled;
        maskFieldsCheckbox.checked = res.maskFields;
      }
    );
  }

  revealToggle.addEventListener('change', () => {
    wordsVisible = revealToggle.checked;
    renderList();
  });

  function addKeyword() {
    const val = inputEl.value.trim();
    if (!val) return;
    if (latestKeywords.includes(val)) {
      inputEl.value = '';
      return;
    }
    const newList = [...latestKeywords, val];
    chrome.storage.local.set({ keywords: newList }, () => {
      inputEl.value = '';
      loadAndRender();
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

  maskFieldsCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ maskFields: maskFieldsCheckbox.checked });
  });

  resetBtn.addEventListener('click', () => {
    if (confirm('누적 숨김 횟수를 0으로 초기화할까요?')) {
      chrome.storage.local.set({ hiddenCount: 0 }, loadAndRender);
    }
  });

  loadAndRender();
});