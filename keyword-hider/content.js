(function () {
  let keywords = [];
  let caseSensitive = false;
  let enabled = true;
  let pagePaused = false;
  let maskFieldsEnabled = true;
  let observer = null;

  // ---------- 초기 로딩 시 원문이 잠깐 보이는 것(FOUC) 방지 ----------
  // document_start 시점에 페이지를 우선 숨기고, 마스킹 처리가 끝난 직후에만 보여줍니다.
  const HIDE_STYLE_ID = 'ks-initial-hide';

  function hidePage() {
    if (document.getElementById(HIDE_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = HIDE_STYLE_ID;
    style.textContent = 'html { visibility: hidden !important; }';
    (document.documentElement || document).appendChild(style);
  }

  function revealPage() {
    clearTimeout(revealSafetyTimer);
    const style = document.getElementById(HIDE_STYLE_ID);
    if (style) style.remove();
  }

  hidePage();
  // 안전장치: 어떤 이유로든(오류, 저장소 지연 등) 마스킹이 끝나지 않아도
  // 페이지가 계속 숨겨진 채로 남지 않도록 최대 2초 후 강제로 표시합니다.
  const revealSafetyTimer = setTimeout(revealPage, 2000);

  // ---------- 유틸 ----------
  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function buildRegex() {
    if (!keywords || keywords.length === 0) return null;
    // 긴 단어부터 매칭되도록 정렬 (짧은 단어가 긴 단어의 부분집합인 경우 대비)
    const sorted = [...keywords]
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp);
    if (sorted.length === 0) return null;
    const pattern = `(${sorted.join('|')})`;
    return new RegExp(pattern, caseSensitive ? 'g' : 'gi');
  }

  // 원본 단어의 글자 수가 유추되지 않도록 항상 고정된 길이로 마스킹합니다.
  const MASK_TEXT = '●●●';
  function maskChar() {
    return MASK_TEXT;
  }

  // ---------- 카운터 ----------
  function incrementCounter(n) {
    if (n <= 0) return;
    chrome.storage.local.get({ hiddenCount: 0 }, (res) => {
      chrome.storage.local.set({ hiddenCount: (res.hiddenCount || 0) + n });
    });
  }

  // ---------- 마스킹 처리 ----------
  function onRevealClick(e) {
    e.stopPropagation();
    const span = e.currentTarget;
    if (span.classList.contains('ks-revealed')) {
      span.classList.remove('ks-revealed');
      span.textContent = maskChar();
    } else {
      span.classList.add('ks-revealed');
      span.textContent = span.dataset.original;
    }
  }

  function shouldSkipParent(parent) {
    if (!parent || !parent.tagName) return true;
    const skipTags = ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT'];
    if (skipTags.includes(parent.tagName)) return true;
    if (parent.closest && parent.closest('.ks-hidden')) return true;
    if (parent.isContentEditable) return true;
    return false;
  }

  function maskTextNode(node, regex) {
    const text = node.nodeValue;
    if (!text) return;
    regex.lastIndex = 0;
    if (!regex.test(text)) return;
    regex.lastIndex = 0;

    const parent = node.parentNode;
    if (shouldSkipParent(parent)) return;

    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let match;
    let count = 0;

    while ((match = regex.exec(text)) !== null) {
      const before = text.slice(lastIndex, match.index);
      if (before) frag.appendChild(document.createTextNode(before));

      const span = document.createElement('span');
      span.className = 'ks-hidden';
      span.dataset.original = match[0];
      span.textContent = maskChar();
      span.title = '클릭하면 표시됩니다';
      span.addEventListener('click', onRevealClick);
      frag.appendChild(span);

      lastIndex = match.index + match[0].length;
      count++;

      if (match[0].length === 0) regex.lastIndex++; // 무한루프 방지
    }

    const after = text.slice(lastIndex);
    if (after) frag.appendChild(document.createTextNode(after));

    parent.replaceChild(frag, node);
    if (count > 0) incrementCounter(count);
  }

  function walkAndMask(root, regex) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (shouldSkipParent(n.parentNode)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach((node) => maskTextNode(node, regex));
  }

    // 페이지 일시정지 시 현재 마스킹된 것들을 원래대로 되돌림
  function unmaskAllInPage() {
    document.querySelectorAll('.ks-hidden').forEach((span) => {
      const original = span.dataset.original || '';
      span.replaceWith(document.createTextNode(original));
    });
    if (document.body) document.body.normalize();

    document
      .querySelectorAll('input[data-ks-masked="true"], textarea[data-ks-masked="true"]')
      .forEach((el) => removeFieldMask(el));
  }

function scanAll() {
    if (!enabled || pagePaused) return;
    const regex = buildRegex();
    if (!regex || !document.body) return;
    walkAndMask(document.body, regex);
    if (maskFieldsEnabled) scanFields(document.body, regex);
  }

  // ---------- input / textarea 마스킹 ----------
  const MASKABLE_INPUT_TYPES = ['text', 'search', 'email', 'tel', 'url', ''];
  const overlayMap = new WeakMap();

  function isMaskableField(el) {
    if (!el || !el.tagName) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      return MASKABLE_INPUT_TYPES.includes(type);
    }
    return false;
  }

  function fieldMatchesKeyword(value, regex) {
    if (!value || !regex) return false;
    regex.lastIndex = 0;
    return regex.test(value);
  }

  function ensureOverlay(el) {
    let overlay = overlayMap.get(el);
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'ks-field-overlay';
    overlay.textContent = MASK_TEXT;
    overlay.title = '클릭하면 입력 필드로 이동합니다';
    overlay.addEventListener('mousedown', (e) => {
      e.preventDefault();
      el.focus();
    });
    document.body.appendChild(overlay);
    overlayMap.set(el, overlay);
    return overlay;
  }

  function positionOverlay(el, overlay) {
    const rect = el.getBoundingClientRect();
    overlay.style.top = `${window.scrollY + rect.top}px`;
    overlay.style.left = `${window.scrollX + rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  }

  function applyFieldMask(el) {
    el.dataset.ksMasked = 'true';
    if (el.tagName === 'INPUT') {
      // 크로미움 계열에서 입력값 자체를 점(dot)으로 표시 (실제 값과 편집 동작은 그대로 유지됨)
      el.style.setProperty('-webkit-text-security', 'disc', 'important');
    } else if (el.tagName === 'TEXTAREA') {
      const overlay = ensureOverlay(el);
      positionOverlay(el, overlay);
      overlay.style.display = 'flex';
    }
  }

  function removeFieldMask(el) {
    delete el.dataset.ksMasked;
    if (el.tagName === 'INPUT') {
      el.style.removeProperty('-webkit-text-security');
    } else if (el.tagName === 'TEXTAREA') {
      const overlay = overlayMap.get(el);
      if (overlay) overlay.style.display = 'none';
    }
  }

  function checkField(el, regex) {
    if (!isMaskableField(el)) return;
    if (!regex) {
      if (el.dataset.ksMasked) removeFieldMask(el);
      return;
    }
    const matched = fieldMatchesKeyword(el.value, regex);
    const wasMasked = el.dataset.ksMasked === 'true';
    if (matched && !wasMasked) {
      applyFieldMask(el);
    } else if (!matched && wasMasked) {
      removeFieldMask(el);
    } else if (matched && el.tagName === 'TEXTAREA') {
      const overlay = overlayMap.get(el);
      if (overlay) positionOverlay(el, overlay);
    }
  }

  function scanFields(root, regex) {
    if (!regex || !root || !root.querySelectorAll) return;
    const fields = root.matches && (root.matches('input, textarea'))
      ? [root, ...root.querySelectorAll('input, textarea')]
      : root.querySelectorAll('input, textarea');
    fields.forEach((el) => checkField(el, regex));
  }

  // 마스킹된 필드에서 Backspace/Delete 입력 시, 한 글자씩이 아닌 전체 삭제 처리
  function onFieldKeydown(e) {
    const el = e.target;
    if (!isMaskableField(el)) return;
    if (el.dataset.ksMasked !== 'true') return;
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      el.value = '';
      removeFieldMask(el);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  

  function onFieldInput(e) {
    if (!enabled || !maskFieldsEnabled || pagePaused) return;
    const el = e.target;
    if (!isMaskableField(el)) return;
    const regex = buildRegex();
    checkField(el, regex);
  }

  function repositionAllOverlays() {
    document.querySelectorAll('textarea[data-ks-masked="true"]').forEach((el) => {
      const overlay = overlayMap.get(el);
      if (overlay) positionOverlay(el, overlay);
    });
  }

  document.addEventListener('keydown', onFieldKeydown, true);
  document.addEventListener('input', onFieldInput, true);
  window.addEventListener('scroll', repositionAllOverlays, true);
  window.addEventListener('resize', repositionAllOverlays);


  // ---------- 동적 콘텐츠 감시 ----------
  function startObserving() {
    if (observer || !document.body) return;
    observer = new MutationObserver((mutations) => {
      if (!enabled || pagePaused) return;
      const regex = buildRegex();
      if (!regex) return;
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            maskTextNode(node, regex);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            walkAndMask(node, regex);
            if (maskFieldsEnabled) scanFields(node, regex);
          }
        });
        // 텍스트가 직접 수정된 경우 (예: innerText 갱신)
        if (m.type === 'characterData' && m.target.nodeType === Node.TEXT_NODE) {
          maskTextNode(m.target, regex);
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function stopObserving() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }

  // ---------- 초기화 ----------
  function init() {
    chrome.storage.local.get(
      { keywords: [], caseSensitive: false, enabled: true, maskFields: true },
      (res) => {
        keywords = res.keywords || [];
        caseSensitive = !!res.caseSensitive;
        enabled = res.enabled !== false;
        maskFieldsEnabled = res.maskFields !== false;

        chrome.runtime.sendMessage({ type: 'get-page-paused' }, (pauseRes) => {
          pagePaused = !!(pauseRes && pauseRes.paused);
          if (enabled && !pagePaused) {
            scanAll();
            startObserving();
          }
          revealPage();
        });
      }
    );
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.keywords) {
      keywords = changes.keywords.newValue || [];
      scanAll(); // 새 단어가 추가되면 현재 페이지에도 즉시 적용
    }
    if (changes.caseSensitive) {
      caseSensitive = !!changes.caseSensitive.newValue;
    }
    if (changes.enabled) {
      enabled = changes.enabled.newValue !== false;
      if (enabled) {
        scanAll();
        startObserving();
      } else {
        stopObserving();
      }
    }
    if (changes.maskFields) {
      maskFieldsEnabled = changes.maskFields.newValue !== false;
      if (maskFieldsEnabled) {
        const regex = buildRegex();
        scanFields(document.body, regex);
      } else {
        // 옵션을 끄면 현재 마스킹돼 있던 필드를 모두 즉시 해제
        document.querySelectorAll('input[data-ks-masked="true"], textarea[data-ks-masked="true"]').forEach((el) => {
          removeFieldMask(el);
        });
      }
    }
  });

    chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== 'set-paused') return;
    pagePaused = !!message.paused;
    if (pagePaused) {
      unmaskAllInPage();
      stopObserving();
    } else if (enabled) {
      scanAll();
      startObserving();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
