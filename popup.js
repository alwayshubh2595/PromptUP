// ── Tab switching ──────────────────────────────────────────────────────────
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add("active");
  });
});

// ── Load saved state ───────────────────────────────────────────────────────
chrome.storage.local.get(["apiKey", "history"], data => {
  if (data.apiKey) document.getElementById("apiKey").value = data.apiKey;
  renderHistory(data.history || []);
});

// ── API key save ───────────────────────────────────────────────────────────
document.getElementById("saveKey").addEventListener("click", () => {
  const key = document.getElementById("apiKey").value.trim();
  if (!key) { showStatus("Enter a valid API key.", true); return; }

  chrome.storage.local.set({ apiKey: key }, () => {
    if (chrome.runtime.lastError) {
      showStatus("Error: " + chrome.runtime.lastError.message, true);
      return;
    }
    showStatus("Saved!");
    setTimeout(() => showStatus(""), 2000);
  });
});

function showStatus(msg, isError = false) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.className = isError ? "error" : "";
}

// ── History ────────────────────────────────────────────────────────────────
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.history) {
    renderHistory(changes.history.newValue || []);
  }
});

document.getElementById("clearHistory").addEventListener("click", () => {
  chrome.storage.local.set({ history: [] });
});

function renderHistory(history) {
  document.getElementById("historyCount").textContent = history.length;
  const list = document.getElementById("history-list");

  if (!history.length) {
    list.innerHTML = '<li class="empty-state">No history yet.<br>Press Ctrl+Shift+E on any AI site.</li>';
    return;
  }

  list.innerHTML = "";
  history.forEach(item => {
    const li = document.createElement("li");
    li.className = "history-item";
    li.innerHTML = `
      <div class="history-original">↳ ${escapeHtml(item.original)}</div>
      <div class="history-enhanced">${escapeHtml(item.enhanced)}</div>
      <div class="history-footer">
        <span class="history-meta">${formatDate(item.ts)}</span>
        <span class="history-mode-badge">${item.mode}</span>
        <span class="copy-hint">click to copy</span>
      </div>
    `;
    li.addEventListener("click", () => {
      navigator.clipboard.writeText(item.enhanced);
      li.style.borderColor = "var(--green)";
      setTimeout(() => li.style.borderColor = "", 1200);
    });
    list.appendChild(li);
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatDate(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}
