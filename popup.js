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

// ── Learn tab ──────────────────────────────────────────────────────────────

const TECHNIQUES = [
  {
    icon: "🧠",
    iconBg: "#cba6f7",
    iconBgDim: "rgba(203,166,247,0.12)",
    name: "Chain-of-Thought",
    tag: "Reasoning",
    tagColor: "#cba6f7",
    tagBg: "rgba(203,166,247,0.12)",
    desc: "Ask the AI to reason through the problem step by step before giving a final answer. Dramatically improves accuracy on complex tasks — the AI catches its own mistakes mid-reasoning.",
    exampleLabel: "Add to any prompt:",
    example: "Think through this step by step. Show your reasoning before giving the final answer.",
    instruction: "Apply chain-of-thought reasoning: ask the AI to think step by step and show its reasoning before giving the final answer."
  },
  {
    icon: "🎭",
    iconBg: "#89b4fa",
    iconBgDim: "rgba(137,180,250,0.12)",
    name: "Role Prompting",
    tag: "Framing",
    tagColor: "#89b4fa",
    tagBg: "rgba(137,180,250,0.12)",
    desc: "Assign the AI a specific expert persona before your ask. The AI adopts the vocabulary, priorities, and depth of that role — a security engineer thinks about different risks than a frontend dev.",
    exampleLabel: "Add to any prompt:",
    example: "You are a senior [role] with 10+ years of experience. [task]",
    instruction: "Frame this as a role prompt: assign the AI a specific expert persona that best fits the task, then state the request."
  },
  {
    icon: "📎",
    iconBg: "#a6e3a1",
    iconBgDim: "rgba(166,227,161,0.12)",
    name: "Few-Shot Examples",
    tag: "Examples",
    tagColor: "#a6e3a1",
    tagBg: "rgba(166,227,161,0.12)",
    desc: "Show the AI 2-3 examples of input → output before your actual request. The AI infers the pattern and applies it. Far more reliable than describing the format in words.",
    exampleLabel: "Structure:",
    example: "Example 1: [input] → [output]\nExample 2: [input] → [output]\nNow do this: [your actual input]",
    instruction: "Structure this as a few-shot prompt: include 2-3 concrete input→output examples before the actual request so the AI learns the exact pattern expected."
  },
  {
    icon: "🚧",
    iconBg: "#f9e2af",
    iconBgDim: "rgba(249,226,175,0.12)",
    name: "Constraints First",
    tag: "Guardrails",
    tagColor: "#f9e2af",
    tagBg: "rgba(249,226,175,0.12)",
    desc: "Lead with what NOT to do before describing what you want. AIs are better at avoiding specific pitfalls when told upfront — don't bury constraints at the end where they get less weight.",
    exampleLabel: "Structure:",
    example: "Do NOT use external libraries. Do NOT add error handling beyond what's asked. Do NOT explain the code unless asked. Now: [task]",
    instruction: "Lead with explicit constraints (what NOT to do, what to avoid) before stating the actual task. Put guardrails first."
  },
  {
    icon: "📐",
    iconBg: "#fab387",
    iconBgDim: "rgba(250,179,135,0.12)",
    name: "Structured Output",
    tag: "Format",
    tagColor: "#fab387",
    tagBg: "rgba(250,179,135,0.12)",
    desc: "Specify the exact output format — JSON schema, table columns, bullet structure, code block language. Removes ambiguity about how to present the answer and makes output directly usable.",
    exampleLabel: "Add to any prompt:",
    example: "Return your answer as JSON with this shape: { \"result\": string, \"confidence\": number, \"reasoning\": string[] }",
    instruction: "Add a structured output requirement: specify the exact format (JSON, table, numbered list, code block) the AI should use for its response."
  },
  {
    icon: "✅",
    iconBg: "#a6e3a1",
    iconBgDim: "rgba(166,227,161,0.12)",
    name: "Acceptance Criteria",
    tag: "Definition of Done",
    tagColor: "#a6e3a1",
    tagBg: "rgba(166,227,161,0.12)",
    desc: "Tell the AI what \"done\" looks like before it starts. Without this, the AI decides when to stop. With it, the AI self-checks against your criteria and keeps going until all are met.",
    exampleLabel: "Add to any prompt:",
    example: "Your answer is complete when: (1) all edge cases are handled, (2) there are no hardcoded values, (3) the function has a docstring.",
    instruction: "Add acceptance criteria: define what a complete, correct answer looks like so the AI can self-check before responding."
  },
  {
    icon: "🔁",
    iconBg: "#cba6f7",
    iconBgDim: "rgba(203,166,247,0.12)",
    name: "Self-Verification",
    tag: "Quality",
    tagColor: "#cba6f7",
    tagBg: "rgba(203,166,247,0.12)",
    desc: "Ask the AI to verify its own answer after producing it. Research shows this catches ~30% more errors than a single pass. Works especially well for code, math, and logic.",
    exampleLabel: "Add at the end:",
    example: "After writing your answer, review it once. Check for bugs, edge cases, and whether it fully satisfies the request. Fix anything you find.",
    instruction: "Add a self-verification step: after producing the answer, the AI should review it for correctness, edge cases, and completeness — and fix any issues found."
  },
  {
    icon: "🗜️",
    iconBg: "#6c7086",
    iconBgDim: "rgba(108,112,134,0.12)",
    name: "Token Compression",
    tag: "Efficiency",
    tagColor: "#a6adc8",
    tagBg: "rgba(166,173,200,0.12)",
    desc: "Strip the prompt to its minimum effective form. Remove pleasantries, filler words, redundant context, and markdown formatting. A shorter prompt costs less and often gets a more focused answer.",
    exampleLabel: "Principle:",
    example: "If removing a word doesn't change what the AI will do — remove it. No \"please\", no \"could you\", no restating the obvious.",
    instruction: "Compress this prompt for maximum token efficiency: strip all filler, pleasantries, redundancy, and unnecessary formatting. Keep only words that change the output."
  }
];

function renderLearnTab() {
  const container = document.getElementById("technique-cards");
  container.innerHTML = "";

  TECHNIQUES.forEach((t, i) => {
    const card = document.createElement("div");
    card.className = "technique-card";
    card.innerHTML = `
      <div class="technique-header">
        <div class="technique-icon" style="background:${t.iconBgDim}">${t.icon}</div>
        <span class="technique-name">${t.name}</span>
        <span class="technique-tag" style="color:${t.tagColor};background:${t.tagBg}">${t.tag}</span>
      </div>
      <div class="technique-desc">${t.desc}</div>
      <div class="technique-example" style="border-left-color:${t.iconBg}">
        <strong>${t.exampleLabel}</strong>
        ${escapeHtml(t.example).replace(/\n/g, "<br>")}
      </div>
      <div class="technique-actions">
        <button class="btn-use" style="background:${t.iconBg};color:#1e1e2e" data-index="${i}">
          Use this style
        </button>
        <span class="applied-badge" id="applied-${i}">✓ Set as custom instruction</span>
      </div>
    `;

    card.querySelector(".btn-use").addEventListener("click", () => {
      chrome.storage.local.set({ customInstruction: t.instruction }, () => {
        // Flash confirmation
        const badge = document.getElementById(`applied-${i}`);
        badge.classList.add("visible");
        setTimeout(() => badge.classList.remove("visible"), 2500);
      });
    });

    container.appendChild(card);
  });
}

renderLearnTab();

// ── Helpers ────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatDate(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}
