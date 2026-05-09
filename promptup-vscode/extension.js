const vscode = require("vscode");

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert prompt engineer specializing in coding and software development tasks. Your job is to take a rough developer prompt and rewrite it to be precise, context-rich, and immediately actionable for AI coding assistants like GitHub Copilot, Claude, and Codex.

Core rules:
- Preserve the developer's original intent exactly
- Output ONLY the improved prompt — no preamble, no explanation, no meta-commentary
- Write FROM the user TO the AI — always imperative ("Write…", "Refactor…", "Explain…"), never first-person ("I will…")
- If the task is genuinely ambiguous and a key detail would significantly change the output, add ONE line at the end: "If anything critical is unclear, ask one focused question before proceeding — otherwise use the defaults above and begin." Omit this line when intent is clear.

Coding-specific rules:
- Always surface the programming language, framework, and relevant version constraints if they can be inferred or are needed
- For bugs/errors: structure the prompt to include symptoms, context, and what was expected vs what happened
- For generation: specify output format, function signature style, error handling expectations, and whether tests are needed
- For refactoring: make explicit what "better" means (readability, performance, maintainability, security)
- For reviews: specify focus areas — don't let the AI give generic feedback
- For tests: specify test framework, coverage expectations, and edge cases to consider
- Strip pleasantries, filler words, and redundant phrasing
- Prefer concrete constraints over vague adjectives ("under 50ms" not "fast", "no external dependencies" not "simple")
- If context about the codebase, language or framework is provided, weave it into the prompt naturally`;

// ── Mode instructions ─────────────────────────────────────────────────────────

const MODES = {
  default: {
    label: "$(sparkle) Default",
    instruction: ""
  },
  debug: {
    label: "$(bug) Debug",
    instruction: `Structure this as a debugging prompt. Include: the exact error/symptom, the context in which it occurs, what was expected vs what happened, and any relevant stack trace or variable state. Ask the AI to explain what constraint is violated and provide a concrete fix with explanation.\n\n`
  },
  generate: {
    label: "$(add) Generate",
    instruction: `Structure this as a code generation prompt. Specify: the exact function/component/module needed, input/output types, error handling approach, edge cases to cover, coding style constraints, and whether tests should be included. Include a concrete example of the expected output format if helpful.\n\n`
  },
  refactor: {
    label: "$(edit) Refactor",
    instruction: `Structure this as a refactoring prompt. Make explicit what "better" means — choose from: readability, performance, maintainability, testability, security, reducing duplication. Specify constraints (preserve API surface, no new dependencies, keep same language). Ask for before/after with explanation of each change.\n\n`
  },
  review: {
    label: "$(search) Review",
    instruction: `Structure this as a code review prompt. Specify focus areas from: correctness, security vulnerabilities, performance bottlenecks, error handling gaps, naming/readability, architectural concerns. Ask for concrete actionable fixes, not just observations. Prioritize findings by severity.\n\n`
  },
  tests: {
    label: "$(beaker) Tests",
    instruction: `Structure this as a test-writing prompt. Specify: the test framework, whether unit/integration/e2e, coverage expectations, which edge cases and error paths must be covered, and any mocking approach. Ask the AI to verify its own tests by reasoning through each case.\n\n`
  },
  explain: {
    label: "$(book) Explain",
    instruction: `Structure this as a code explanation prompt. Ask for a step-by-step walkthrough: what the code does, why it's structured this way, any non-obvious design decisions, potential gotchas, and how it fits into the broader system. Use chain-of-thought — explain each section before summarizing.\n\n`
  },
  caveman: {
    label: "$(zap) Token-Save",
    instruction: `Rewrite for maximum token efficiency. Strip every unnecessary word, filler phrase, pleasantry, and redundancy. No emojis, no markdown formatting, no bullet points unless structurally essential. Use terse imperative sentences. Every word must carry meaning — if removing it doesn't change what the AI will do, remove it.\n\n`
  },
  expert: {
    label: "$(mortar-board) Expert",
    instruction: `Rewrite assuming the AI is a senior engineer with deep domain expertise. Use precise technical terminology, reference relevant patterns/frameworks/algorithms by name, specify exact constraints and performance requirements, and structure the prompt with clear scope, acceptance criteria, and known constraints. Add chain-of-thought instruction: ask the AI to reason through the approach before writing code.\n\n`
  }
};

// ── Context collector ─────────────────────────────────────────────────────────

function gatherEditorContext() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return {};

  const doc = editor.document;
  const selection = editor.selection;
  const selectedText = doc.getText(selection);
  const language = doc.languageId;
  const fileName = doc.fileName.split("/").pop().split("\\").pop();

  // Grab surrounding context (10 lines above selection or cursor)
  let surroundingCode = "";
  if (!selection.isEmpty) {
    const startLine = Math.max(0, selection.start.line - 8);
    const endLine = Math.min(doc.lineCount - 1, selection.end.line + 4);
    const range = new vscode.Range(startLine, 0, endLine, doc.lineAt(endLine).text.length);
    surroundingCode = doc.getText(range);
  }

  return { selectedText, language, fileName, surroundingCode };
}

// ── API call ──────────────────────────────────────────────────────────────────

async function callAnthropicAPI(prompt, modeInstruction, customInstruction, context) {
  const config = vscode.workspace.getConfiguration("promptup");
  const apiKey = config.get("apiKey");
  if (!apiKey) throw new Error("No API key set. Run 'PromptUp: Set API Key' from the command palette.");

  const instruction = customInstruction?.trim()
    ? `Apply this specific instruction when enhancing the prompt: ${customInstruction.trim()}\n\n`
    : modeInstruction;

  const contextBlock = buildContextBlock(context);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `${contextBlock}${instruction}Enhance this prompt:\n\n${prompt}`
      }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text?.trim() ?? prompt;
}

function buildContextBlock({ language, fileName, surroundingCode }) {
  if (!language && !fileName) return "";
  let block = "Editor context:\n";
  if (fileName) block += `- File: ${fileName}\n`;
  if (language) block += `- Language: ${language}\n`;
  if (surroundingCode) block += `- Surrounding code:\n\`\`\`${language}\n${surroundingCode.slice(0, 600)}\n\`\`\`\n`;
  return block + "\n";
}

// ── Mode picker UI ────────────────────────────────────────────────────────────

async function showModePicker() {
  const customItem = {
    label: "$(pencil) Custom",
    description: "custom",
    detail: "Write your own enhancement instruction",
    id: "custom"
  };

  const modeItems = Object.entries(MODES).map(([id, m]) => ({
    label: m.label,
    description: id,
    id
  }));

  const items = [customItem, { kind: vscode.QuickPickItemKind.Separator, label: "Modes" }, ...modeItems];

  const picked = await vscode.window.showQuickPick(items, {
    title: "PromptUp — How should I enhance this?",
    placeHolder: "Pick a mode — or choose Custom to write your own instruction"
  });

  if (!picked) return null;

  // Only ask for text if they explicitly chose Custom
  if (picked.id === "custom") {
    const custom = await vscode.window.showInputBox({
      title: "PromptUp — Custom instruction",
      prompt: 'e.g. "Use TypeScript strict mode" or "Assume React 18 with hooks"',
      placeHolder: "Describe how you want the prompt enhanced",
      ignoreFocusOut: true
    });
    if (custom === undefined) return null;
    return { mode: "default", customInstruction: custom };
  }

  return { mode: picked.id, customInstruction: "" };
}

// ── Diff view ─────────────────────────────────────────────────────────────────

async function showDiffAndApply(original, enhanced, editor, selection) {
  // Show diff in a side-by-side virtual document
  const originalUri = vscode.Uri.parse("promptup-diff://original/Original Prompt");
  const enhancedUri = vscode.Uri.parse("promptup-diff://enhanced/Enhanced Prompt");

  const provider = new (class {
    provideTextDocumentContent(uri) {
      return uri.authority === "original" ? original : enhanced;
    }
  })();

  const reg1 = vscode.workspace.registerTextDocumentContentProvider("promptup-diff", provider);

  await vscode.commands.executeCommand(
    "vscode.diff",
    originalUri,
    enhancedUri,
    "PromptUp: Original ↔ Enhanced",
    { preview: true }
  );

  const action = await vscode.window.showInformationMessage(
    "PromptUp — Apply enhanced prompt?",
    { modal: false },
    "Apply",
    "Discard"
  );

  reg1.dispose();

  // Close the diff tab
  await vscode.commands.executeCommand("workbench.action.closeActiveEditor");

  if (action === "Apply") {
    await editor.edit(editBuilder => {
      if (selection && !selection.isEmpty) {
        editBuilder.replace(selection, enhanced);
      } else {
        const fullRange = new vscode.Range(
          editor.document.positionAt(0),
          editor.document.positionAt(editor.document.getText().length)
        );
        editBuilder.replace(fullRange, enhanced);
      }
    });
    vscode.window.showInformationMessage("PromptUp: Prompt enhanced!");
  }
}

// ── Main command ──────────────────────────────────────────────────────────────

async function enhanceCommand() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("PromptUp: Click inside a text editor first, then press Ctrl+Shift+E.");
    return;
  }

  const context = gatherEditorContext();
  const selection = editor.selection;

  // Get the text to enhance — selected text, or full document
  const text = context.selectedText || editor.document.getText();
  if (!text.trim()) {
    vscode.window.showErrorMessage("PromptUp: Editor is empty.");
    return;
  }

  const picked = await showModePicker();
  if (!picked) return;

  const { mode, customInstruction } = picked;
  const modeInstruction = MODES[mode]?.instruction || "";

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "PromptUp: Enhancing prompt…",
      cancellable: false
    },
    async () => {
      try {
        const enhanced = await callAnthropicAPI(text, modeInstruction, customInstruction, context);
        await showDiffAndApply(text, enhanced, editor, selection);
      } catch (err) {
        vscode.window.showErrorMessage(`PromptUp: ${err.message}`);
      }
    }
  );
}

// ── Set API key command ───────────────────────────────────────────────────────

async function setApiKeyCommand() {
  const key = await vscode.window.showInputBox({
    title: "PromptUp — Set Anthropic API Key",
    prompt: "Enter your Anthropic API key",
    placeHolder: "sk-ant-…",
    password: true,
    ignoreFocusOut: true
  });

  if (!key) return;

  await vscode.workspace.getConfiguration("promptup").update(
    "apiKey", key, vscode.ConfigurationTarget.Global
  );
  vscode.window.showInformationMessage("PromptUp: API key saved.");
}

// ── Terminal diff helper ──────────────────────────────────────────────────────

async function showTerminalDiff(original, enhanced) {
  const originalUri = vscode.Uri.parse("promptup-diff://original/Original Prompt");
  const enhancedUri = vscode.Uri.parse("promptup-diff://enhanced/Enhanced Prompt");

  const provider = new (class {
    provideTextDocumentContent(uri) {
      return uri.authority === "original" ? original : enhanced;
    }
  })();

  const reg = vscode.workspace.registerTextDocumentContentProvider("promptup-diff", provider);

  await vscode.commands.executeCommand(
    "vscode.diff",
    originalUri,
    enhancedUri,
    "PromptUp: Original ↔ Enhanced",
    { preview: true }
  );

  const action = await vscode.window.showInformationMessage(
    "PromptUp — Send enhanced prompt to terminal?",
    { modal: false },
    "Send to terminal",
    "Discard"
  );

  reg.dispose();
  await vscode.commands.executeCommand("workbench.action.closeActiveEditor");

  return action === "Send to terminal" ? "send" : "discard";
}

// ── Terminal / clipboard command ──────────────────────────────────────────────

async function enhanceFromTerminalCommand() {
  // Pre-fill input box with whatever is in the clipboard
  const clipboard = await vscode.env.clipboard.readText();

  const text = await vscode.window.showInputBox({
    title: "PromptUp — Type or paste your prompt",
    prompt: "Write your rough prompt. It will be enhanced and copied back to clipboard.",
    value: clipboard,
    placeHolder: "e.g. fix the bug in my auth middleware",
    ignoreFocusOut: true
  });

  if (!text?.trim()) return;

  const picked = await showModePicker();
  if (!picked) return;

  const { mode, customInstruction } = picked;
  const modeInstruction = MODES[mode]?.instruction || "";

  // No editor context available from terminal — pass empty context
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "PromptUp: Enhancing prompt…",
      cancellable: false
    },
    async () => {
      try {
        const enhanced = await callAnthropicAPI(text, modeInstruction, customInstruction, {});

        // Show diff first so user can review
        const action = await showTerminalDiff(text, enhanced);

        if (action === "send") {
          // Type directly into the active terminal — user just presses Enter
          const terminal = vscode.window.activeTerminal;
          if (terminal) {
            terminal.show(true); // focus terminal, preserve focus
            terminal.sendText(enhanced, false); // false = don't press Enter yet
          } else {
            // Fallback: copy to clipboard
            await vscode.env.clipboard.writeText(enhanced);
            vscode.window.showInformationMessage("PromptUp: No active terminal — copied to clipboard instead.");
          }
        }
      } catch (err) {
        vscode.window.showErrorMessage(`PromptUp: ${err.message}`);
      }
    }
  );
}

// ── Activate ──────────────────────────────────────────────────────────────────

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("promptup.enhance", enhanceCommand),
    vscode.commands.registerCommand("promptup.enhanceFromTerminal", enhanceFromTerminalCommand),
    vscode.commands.registerCommand("promptup.setApiKey", setApiKeyCommand)
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
