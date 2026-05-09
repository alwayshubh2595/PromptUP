# ⚡ PromptUp

**Enhance your AI prompts in-place — before you hit send.**

PromptUp rewrites rough, vague prompts into clear, specific, effective ones using Claude Haiku. Works where you work: AI chat sites in the browser, and VS Code terminals where you talk to Claude Code or GitHub Copilot.

Press `Ctrl+Shift+E` anywhere. Pick a mode. Review the diff. Apply.

---

## What's inside

```
promptup/
├── Chrome Extension        — works on Claude, ChatGPT, Gemini, Perplexity, Grok
│   ├── manifest.json
│   ├── background.js       — Anthropic API calls, mode logic, system prompt
│   ├── content.js          — keyboard shortcut, in-page picker modal, diff view
│   ├── content.css         — toast + modal styles
│   ├── popup.html          — extension popup (history + settings)
│   ├── popup.js
│   ├── generate-icons.html — open in browser to generate icon PNGs
│   └── icons/
│
└── promptup-vscode/        — VS Code extension
    ├── extension.js        — commands, mode picker, terminal integration
    ├── package.json
    └── README.md
```

---

## Chrome Extension

### Installation

1. Clone this repo
2. Open `chrome://extensions` → enable **Developer mode**
3. Click **Load unpacked** → select the root folder (where `manifest.json` is)
4. Click the PromptUp icon → **Settings** → paste your [Anthropic API key](https://console.anthropic.com/)

> No Anthropic account? Get one at console.anthropic.com — Haiku is very cheap (~$0.001 per enhancement).

### Usage

1. Go to any supported AI site
2. Type a rough prompt in the chat box
3. Press **`Ctrl+Shift+E`**
4. Pick a mode (or write a custom instruction)
5. Review the side-by-side diff → click **Apply Enhanced**

### Supported sites

| Site | URL |
|------|-----|
| Claude | claude.ai |
| ChatGPT | chatgpt.com |
| Gemini | gemini.google.com |
| Perplexity | perplexity.ai |
| Grok | grok.com |

### Modes

| Mode | What it does |
|------|-------------|
| ✨ Default | Balanced clarity — adds context, removes vagueness |
| ⚡ Concise | Short and direct — every word earns its place |
| 📋 Detailed | Comprehensive — adds background, format requirements, edge cases |
| ⚙️ Technical | Precise specs — exact constraints, explicit output requirements |
| 🪨 Caveman | Token-efficient — strips all filler, no emojis, no markdown |
| 🎓 Expert | Domain-fluent — assumes expert audience, uses precise terminology |
| ✏️ Custom | You describe exactly how you want it enhanced |

### Features

- **In-page picker** — mode selection + custom instructions happen on the page, not in the popup
- **Technique chips** — 8 expert prompting techniques available as one-click chips in the picker (Chain-of-Thought, Role Prompting, Few-Shot, Constraints First, Structured Output, Acceptance Criteria, Self-Verify, Token Compression)
- **Side-by-side diff** — word-level highlight of what changed before applying
- **Editable diff** — click ✏️ Edit in the diff view to tweak the enhanced prompt before applying; re-renders the diff with your changes
- **Prompt history** — last 10 enhanced prompts saved, accessible from popup
- **Context-aware history** — previous prompts in the session are fed as context so enhancements stay coherent across a conversation
- **Learn tab** — popup teaches 8 expert prompting techniques with explanations, real examples, and a "Use this style" button that sets it as your custom instruction
- **Persistent preferences** — last used mode and custom instruction remembered across sessions
- **Toast notifications** — loading / success / error feedback

---

## VS Code Extension

For developers using Claude Code CLI, GitHub Copilot chat, or any AI terminal tool inside VS Code.

### Installation (dev mode)

1. Open the `promptup-vscode/` folder in VS Code
2. Press **F5** → opens an Extension Development Host with PromptUp loaded
3. In the host window: `Ctrl+Shift+P` → **PromptUp: Set API Key** → paste your key

### Usage — from the editor

1. Open any file, write or select a rough prompt
2. Press **`Ctrl+Shift+E`**
3. Pick a mode → review diff → click **Apply**

### Usage — from the terminal

1. Focus the VS Code terminal (where Claude Code / Copilot is running)
2. Press **`Ctrl+Shift+E`**
3. Type your rough prompt in the input box
4. Pick a mode → review diff → click **Send to terminal**
5. The enhanced prompt is typed into the terminal — press **Enter** to send

### Modes (coding-specific)

| Mode | What it does |
|------|-------------|
| ✨ Default | Balanced clarity for any coding task |
| 🐛 Debug | Structures with symptoms, context, expected vs actual, asks for fix + explanation |
| ➕ Generate | Adds function signatures, I/O types, error handling, edge cases |
| ✏️ Refactor | Makes "better" explicit — readability / performance / maintainability |
| 🔍 Review | Specifies focus areas, asks for prioritised actionable fixes |
| 🧪 Tests | Adds framework, coverage expectations, edge cases, chain-of-thought verification |
| 📖 Explain | Step-by-step walkthrough with chain-of-thought |
| ⚡ Token-Save | Maximum token efficiency — strips all filler, no markdown |
| 🎓 Expert | Senior-engineer framing, chain-of-thought before code |
| ✏️ Custom | Write your own instruction |

### Context awareness

The VS Code extension automatically includes in every API call:
- Current file name and language (Python, TypeScript, etc.)
- Up to 8 lines of surrounding code around your selection

So the enhanced prompt is already grounded in your actual codebase — no need to manually specify the language or framework.

---

## How it works

```
User types rough prompt
        ↓
Ctrl+Shift+E
        ↓
PromptUp picker (mode + optional custom instruction)
        ↓
background.js / extension.js → Anthropic API (claude-haiku)
        ↓
System prompt: expert prompt engineer rules + mode instruction + session history
        ↓
Enhanced prompt returned
        ↓
Side-by-side diff shown
        ↓
User clicks Apply → text written back in-place
```

The system prompt encodes prompt engineering best practices from research:
- Always imperative, never first-person
- Surfaces language, framework, constraints
- Bakes in sensible defaults so the AI acts immediately
- Adds chain-of-thought instruction for complex modes
- Uses session history as context for conversation continuity

### Techniques taught in the Learn tab

| Technique | What it does |
|-----------|-------------|
| 🧠 Chain-of-Thought | Ask AI to reason step by step before answering |
| 🎭 Role Prompting | Assign an expert persona before the ask |
| 📎 Few-Shot | Show 2-3 input→output examples before your request |
| 🚧 Constraints First | Lead with what NOT to do before stating the task |
| 📐 Structured Output | Specify exact output format (JSON, table, list) |
| ✅ Acceptance Criteria | Define what "done" looks like upfront |
| 🔁 Self-Verify | Ask AI to review and fix its own answer |
| 🗜️ Token Compression | Strip all filler — minimum effective prompt |

Each technique has a one-click **"Use this style"** button that sets it as your custom instruction, and the same techniques are available as chips directly in the in-page picker.

---

## Roadmap

### Near-term
- [ ] Prompt templates — save reusable prompts, accessible from the picker
- [ ] History in VS Code — last 10 enhancements accessible from command palette
- [ ] Auto mode — Claude reads the prompt and picks the best mode automatically
- [ ] Package VS Code extension as `.vsix` for one-click install

### Medium-term
- [ ] Multi-model support — choose GPT-4o or Gemini as the enhancement model
- [ ] Project context — reads `README.md` / `package.json` / `.promptup` config to know your stack automatically
- [ ] Snippet injection — select code in editor, press shortcut, appends it as context to terminal prompt
- [ ] Firefox support — manifest v2 adjustments

### Longer-term
- [ ] Chrome Web Store listing
- [ ] VS Code Marketplace listing
- [ ] Team shared prompt templates (via config file in repo)
- [ ] Analytics — track which modes are used most, average enhancement quality

---

## Contributing

PRs welcome. The codebase is intentionally small and dependency-free (no bundler, no framework).

- Chrome extension: plain JS, no build step — edit and reload
- VS Code extension: plain JS, no TypeScript — press F5 to run

---

## Privacy

Your prompts are sent to the Anthropic API using your own API key. Nothing is sent to any other server. The extension stores only your API key and prompt history locally (`chrome.storage.local` / VS Code settings).
