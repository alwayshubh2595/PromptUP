// Site-specific adapters for reading/writing prompt text
const SITE_ADAPTERS = {
  // Claude.ai — ProseMirror contenteditable
  "claude.ai": {
    getEditor: () =>
      document.querySelector(
        'div[contenteditable="true"].ProseMirror, div[contenteditable="true"][data-testid="compose-area"]'
      ),
    getText(el) {
      return el.innerText.trim();
    },
    setText(el, text) {
      // ProseMirror: dispatch an input event after setting innerText
      el.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand("selectAll");
      document.execCommand("insertText", false, text);
      if (!el.innerText.trim()) {
        // fallback: direct set + input event
        el.innerText = text;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
  },

  // ChatGPT — custom contenteditable with data-id
  "chatgpt.com": {
    getEditor: () =>
      document.querySelector(
        '#prompt-textarea, div[contenteditable="true"][data-id]'
      ),
    getText(el) {
      return el.tagName === "TEXTAREA" ? el.value : el.innerText.trim();
    },
    setText(el, text) {
      if (el.tagName === "TEXTAREA") {
        setNativeValue(el, text);
      } else {
        el.focus();
        document.execCommand("selectAll");
        document.execCommand("insertText", false, text);
      }
    }
  },

  // Gemini
  "gemini.google.com": {
    getEditor: () =>
      document.querySelector(
        'div[contenteditable="true"].ql-editor, rich-textarea div[contenteditable="true"]'
      ),
    getText: el => el.innerText.trim(),
    setText(el, text) {
      el.focus();
      document.execCommand("selectAll");
      document.execCommand("insertText", false, text);
    }
  },

  // Perplexity
  "www.perplexity.ai": {
    getEditor: () =>
      document.querySelector('textarea[placeholder], div[contenteditable="true"]'),
    getText: el =>
      el.tagName === "TEXTAREA" ? el.value : el.innerText.trim(),
    setText(el, text) {
      if (el.tagName === "TEXTAREA") {
        setNativeValue(el, text);
      } else {
        el.focus();
        document.execCommand("selectAll");
        document.execCommand("insertText", false, text);
      }
    }
  },

  // Grok
  "grok.com": {
    getEditor: () =>
      document.querySelector('div[contenteditable="true"], textarea'),
    getText: el =>
      el.tagName === "TEXTAREA" ? el.value : el.innerText.trim(),
    setText(el, text) {
      if (el.tagName === "TEXTAREA") {
        setNativeValue(el, text);
      } else {
        el.focus();
        document.execCommand("selectAll");
        document.execCommand("insertText", false, text);
      }
    }
  }
};

// React-friendly way to set a native input/textarea value
function setNativeValue(el, value) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    el.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype,
    "value"
  ).set;
  nativeInputValueSetter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function getAdapter() {
  const host = location.hostname;
  // x.com Grok route
  if (host === "x.com") return SITE_ADAPTERS["grok.com"];
  return SITE_ADAPTERS[host] || null;
}

function getEditorAndText() {
  const adapter = getAdapter();
  if (!adapter) return null;
  const el = adapter.getEditor();
  if (!el) return null;
  const text = adapter.getText(el);
  return { el, text, adapter };
}

// ── Toast notifications ──────────────────────────────────────────────────────

function showToast(state, message) {
  removeToast();
  const toast = document.createElement("div");
  toast.id = "promptup-toast";
  toast.className = `promptup-toast promptup-toast--${state}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  // force reflow for transition
  void toast.offsetWidth;
  toast.classList.add("promptup-toast--visible");
  if (state !== "loading") {
    setTimeout(removeToast, 3000);
  }
  return toast;
}

function removeToast() {
  document.getElementById("promptup-toast")?.remove();
}

// ── Diff view ────────────────────────────────────────────────────────────────

function showDiffModal(original, enhanced, onAccept) {
  removeModal();

  const overlay = document.createElement("div");
  overlay.id = "promptup-overlay";
  overlay.className = "promptup-overlay";

  const modal = document.createElement("div");
  modal.className = "promptup-modal";

  modal.innerHTML = `
    <div class="promptup-modal__header">
      <span class="promptup-modal__title">PromptUp — Review Changes</span>
      <button class="promptup-modal__close" id="promptup-close" title="Cancel">✕</button>
    </div>
    <div class="promptup-modal__body">
      <div class="promptup-diff-col">
        <div class="promptup-diff-label">Original</div>
        <div class="promptup-diff-text promptup-diff-text--original" id="promptup-original"></div>
      </div>
      <div class="promptup-diff-col">
        <div class="promptup-diff-label">Enhanced</div>
        <div class="promptup-diff-text promptup-diff-text--enhanced" id="promptup-enhanced"></div>
      </div>
    </div>
    <div class="promptup-modal__footer">
      <button class="promptup-btn promptup-btn--secondary" id="promptup-cancel">Cancel</button>
      <button class="promptup-btn promptup-btn--primary" id="promptup-accept">Apply Enhanced ↵</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Render word-level diff
  renderDiff(original, enhanced,
    document.getElementById("promptup-original"),
    document.getElementById("promptup-enhanced")
  );

  const close = () => removeModal();
  document.getElementById("promptup-close").onclick = close;
  document.getElementById("promptup-cancel").onclick = close;
  document.getElementById("promptup-accept").onclick = () => {
    removeModal();
    onAccept();
  };
  overlay.addEventListener("click", e => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", handleModalKey);

  function handleModalKey(e) {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", handleModalKey); }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      removeModal();
      onAccept();
      document.removeEventListener("keydown", handleModalKey);
    }
  }
}

function removeModal() {
  document.getElementById("promptup-overlay")?.remove();
}

// Simple word-level diff — marks removals in original, additions in enhanced
function renderDiff(original, enhanced, origEl, enhEl) {
  const origWords = tokenize(original);
  const enhWords = tokenize(enhanced);
  const lcs = computeLCS(origWords, enhWords);

  let oi = 0, ei = 0, li = 0;
  const origFrags = document.createDocumentFragment();
  const enhFrags = document.createDocumentFragment();

  while (oi < origWords.length || ei < enhWords.length) {
    if (li < lcs.length && oi < origWords.length && origWords[oi] === lcs[li] &&
        ei < enhWords.length && enhWords[ei] === lcs[li]) {
      // common
      origFrags.appendChild(span(origWords[oi], ""));
      enhFrags.appendChild(span(enhWords[ei], ""));
      oi++; ei++; li++;
    } else {
      if (oi < origWords.length && (li >= lcs.length || origWords[oi] !== lcs[li])) {
        origFrags.appendChild(span(origWords[oi], "promptup-diff--removed"));
        oi++;
      }
      if (ei < enhWords.length && (li >= lcs.length || enhWords[ei] !== lcs[li])) {
        enhFrags.appendChild(span(enhWords[ei], "promptup-diff--added"));
        ei++;
      }
    }
  }

  origEl.appendChild(origFrags);
  enhEl.appendChild(enhFrags);
}

function span(text, cls) {
  const s = document.createElement("span");
  if (cls) s.className = cls;
  s.textContent = text;
  return s;
}

function tokenize(text) {
  // Split on word boundaries, keeping whitespace as tokens
  return text.split(/(\s+)/);
}

function computeLCS(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);
  // backtrack
  const lcs = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i-1] === b[j-1]) { lcs.unshift(a[i-1]); i--; j--; }
    else if (dp[i-1][j] > dp[i][j-1]) i--;
    else j--;
  }
  return lcs;
}

// ── Prompt history ───────────────────────────────────────────────────────────

async function saveToHistory(original, enhanced, mode) {
  const { history = [] } = await chrome.storage.local.get("history");
  history.unshift({ original, enhanced, mode, ts: Date.now() });
  if (history.length > 10) history.length = 10;
  await chrome.storage.local.set({ history });
}

// ── Picker modal ─────────────────────────────────────────────────────────────

const MODES = [
  { id: "default",   icon: "✨", name: "Default",   desc: "Balanced clarity" },
  { id: "concise",   icon: "⚡", name: "Concise",   desc: "Short & direct" },
  { id: "detailed",  icon: "📋", name: "Detailed",  desc: "Full context" },
  { id: "technical", icon: "⚙️", name: "Technical", desc: "Precise specs" },
  { id: "caveman",   icon: "🪨", name: "Caveman",   desc: "Token-efficient" },
  { id: "expert",    icon: "🎓", name: "Expert",    desc: "Domain-fluent" },
];

function showPickerModal(savedMode, savedCustom, onEnhance) {
  removePicker();

  let selectedMode = savedMode;

  const overlay = document.createElement("div");
  overlay.id = "promptup-picker-overlay";
  overlay.className = "promptup-overlay";

  const modal = document.createElement("div");
  modal.className = "promptup-modal promptup-picker";

  modal.innerHTML = `
    <div class="promptup-modal__header">
      <span class="promptup-modal__title">⚡ PromptUp — How should I enhance this?</span>
      <button class="promptup-modal__close" id="promptup-picker-close">✕</button>
    </div>
    <div class="promptup-picker__body">
      <div class="promptup-picker__grid" id="promptup-mode-grid"></div>
      <div class="promptup-picker__custom">
        <div class="promptup-picker__custom-label">Custom instructions <span class="promptup-picker__custom-hint">(optional — overrides mode)</span></div>
        <textarea
          id="promptup-custom-input"
          class="promptup-picker__textarea"
          placeholder='e.g. "Write it like a PM" or "Add step-by-step reasoning"'
          maxlength="300"
        >${savedCustom || ""}</textarea>
      </div>
    </div>
    <div class="promptup-modal__footer">
      <span class="promptup-picker__hint">Esc to cancel</span>
      <button class="promptup-btn promptup-btn--secondary" id="promptup-picker-cancel">Cancel</button>
      <button class="promptup-btn promptup-btn--primary" id="promptup-picker-go">Enhance ↵</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Render mode grid
  const grid = document.getElementById("promptup-mode-grid");
  MODES.forEach(m => {
    const card = document.createElement("button");
    card.className = "promptup-mode-card" + (m.id === selectedMode ? " active" : "");
    card.dataset.mode = m.id;
    card.innerHTML = `
      <span class="promptup-mode-card__icon">${m.icon}</span>
      <span class="promptup-mode-card__name">${m.name}</span>
      <span class="promptup-mode-card__desc">${m.desc}</span>
    `;
    card.addEventListener("click", () => {
      selectedMode = m.id;
      grid.querySelectorAll(".promptup-mode-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
    });
    grid.appendChild(card);
  });

  const customInput = document.getElementById("promptup-custom-input");
  customInput.focus();

  const doEnhance = () => {
    const custom = customInput.value.trim();
    // Persist choices for next time
    chrome.storage.local.set({ mode: selectedMode, customInstruction: custom });
    removePicker();
    onEnhance(selectedMode, custom);
  };

  const close = () => removePicker();

  document.getElementById("promptup-picker-close").onclick = close;
  document.getElementById("promptup-picker-cancel").onclick = close;
  document.getElementById("promptup-picker-go").onclick = doEnhance;
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  const handleKey = e => {
    if (e.key === "Escape") { close(); document.removeEventListener("keydown", handleKey); }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      doEnhance();
      document.removeEventListener("keydown", handleKey);
    }
  };
  document.addEventListener("keydown", handleKey);
}

function removePicker() {
  document.getElementById("promptup-picker-overlay")?.remove();
}

// ── Enhance flow ──────────────────────────────────────────────────────────────

function runEnhance(editorResult, mode, customInstruction) {
  const { el, text, adapter } = editorResult;

  chrome.storage.local.get("history", ({ history = [] }) => {
    const recentHistory = history.slice(0, 5);

    showToast("loading", "PromptUp: enhancing…");

    let responded = false;
    chrome.runtime.sendMessage(
      { type: "ENHANCE_PROMPT", text, mode, history: recentHistory, customInstruction },
      response => {
        responded = true;
        const err = chrome.runtime.lastError;
        removeToast();
        if (err) { showToast("error", `PromptUp: ${err.message}`); return; }
        if (!response || !response.success) {
          showToast("error", `PromptUp: ${response?.error ?? "Unknown error"}`);
          return;
        }
        const enhanced = response.enhanced;
        showDiffModal(text, enhanced, () => {
          adapter.setText(el, enhanced);
          saveToHistory(text, enhanced, mode);
          showToast("success", "PromptUp: prompt enhanced!");
        });
      }
    );

    setTimeout(() => {
      if (!responded) {
        removeToast();
        showToast("error", "PromptUp: service worker timed out. Try again.");
      }
    }, 15000);
  });
}

// ── Main keyboard handler ────────────────────────────────────────────────────

document.addEventListener("keydown", async e => {
  if (!(e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "e")) return;
  e.preventDefault();

  const result = getEditorAndText();
  if (!result) {
    showToast("error", "PromptUp: couldn't find a text editor on this page.");
    return;
  }
  if (!result.text) {
    showToast("error", "PromptUp: the editor is empty.");
    return;
  }

  const { mode = "default", customInstruction = "" } = await chrome.storage.local.get(["mode", "customInstruction"]);

  showPickerModal(mode, customInstruction, (selectedMode, custom) => {
    runEnhance(result, selectedMode, custom);
  });
});
