const SYSTEM_PROMPT = `You are an expert prompt engineer. Your job is to take a rough, unpolished prompt and rewrite it to be clear, specific, and effective for AI assistants.

Rules:
- Preserve the user's original intent exactly
- Add necessary context, constraints, and output format guidance
- Use precise language; remove vagueness
- Do NOT add unnecessary preamble or explanation — output ONLY the improved prompt
- Keep the same language as the input
- Match the tone: technical if technical, casual if casual
- If the prompt is already excellent, return it unchanged
- If prior prompts are provided as context, use them to understand the ongoing topic and ensure the new prompt flows naturally from the conversation
- CRITICAL: The prompt is always written FROM the user TO an AI. Never use first-person "I will…" or "I'll…" — always use second-person imperative ("Write…", "Explain…", "If not specified, default to…"). Default instructions should read as directives to the AI, not statements about what the AI intends to do.
- CRITICAL: Never structure the prompt as a questionnaire or list of questions for the AI to ask the user. Instead, embed sensible defaults directly into the prompt so the AI can act immediately. If the task is genuinely ambiguous and key details would significantly change the output, add a single line at the end: "If anything critical is unclear, ask one focused question before proceeding — otherwise use the defaults above and begin." Only include this line when truly warranted; omit it when the intent is clear enough to act on.`;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ENHANCE_PROMPT") {
    handleEnhance(message.text, message.mode || "default", message.history || [], message.customInstruction || "")
      .then(enhanced => sendResponse({ success: true, enhanced }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }
});

async function handleEnhance(text, mode, history, customInstruction) {
  const { apiKey } = await chrome.storage.local.get("apiKey");
  if (!apiKey) throw new Error("No API key set. Click the PromptUp icon to add one.");

  const modeInstruction = getModeInstruction(mode, customInstruction);
  const historyBlock = buildHistoryBlock(history);

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
      messages: [
        {
          role: "user",
          content: `${historyBlock}${modeInstruction}Enhance this prompt:\n\n${text}`
        }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text?.trim() ?? text;
}

function buildHistoryBlock(history) {
  if (!history || history.length === 0) return "";

  const lines = history
    .slice()
    .reverse() // oldest first for natural reading order
    .map((item, i) => `[${i + 1}] ${item.enhanced}`)
    .join("\n");

  return `The user has been working on the following prompts in this session (most recent last). Use these to understand the ongoing topic and maintain continuity:\n\n${lines}\n\n---\n\n`;
}

function getModeInstruction(mode, customInstruction) {
  if (customInstruction && customInstruction.trim()) {
    return `Apply this specific instruction when enhancing the prompt: ${customInstruction.trim()}\n\n`;
  }
  switch (mode) {
    case "concise":
      return "Rewrite the prompt to be as short and direct as possible — every word must earn its place. No filler, no pleasantries.\n\n";
    case "detailed":
      return "Rewrite the prompt to be comprehensive: include relevant background, desired output format, edge cases to handle, and success criteria.\n\n";
    case "technical":
      return "Rewrite the prompt with precise technical language, exact specifications, explicit constraints, and clearly defined output requirements.\n\n";
    case "caveman":
      return "Rewrite the prompt for maximum token efficiency. Strip every unnecessary word, filler phrase, pleasantry, and redundancy. No emojis, no bold/italic markdown, no bullet points unless structurally essential. Use terse imperative sentences. Every word must carry meaning — if removing it doesn't change what the AI will do, remove it. The output should be the smallest prompt that produces the same result.\n\n";
    case "expert":
      return "Rewrite the prompt assuming a domain expert audience. Use precise terminology, reference relevant frameworks or methodologies where appropriate, and structure it with clear scope, constraints, and deliverables.\n\n";
    default:
      return "";
  }
}
