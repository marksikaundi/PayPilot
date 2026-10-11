import { isRecord, parseJsonObject } from "./fields";

const MODEL = "gpt-4o-mini";

export async function completeJson(
  system: string,
  user: string,
): Promise<Record<string, unknown>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Add OPENAI_API_KEY to your Convex deployment. PayPilot uses gpt-4o-mini to draft invoices, write reminders, and answer questions about this workspace.",
    );
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (response.status === 401) {
    throw new Error(
      "OpenAI rejected the API key. Check OPENAI_API_KEY in the Convex dashboard.",
    );
  }
  if (response.status === 429) {
    throw new Error("gpt-4o-mini is rate limiting requests. Wait a moment and try again.");
  }
  if (!response.ok) {
    throw new Error("The model request failed. Try again in a moment.");
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    throw new Error("The model returned an empty response. Try again.");
  }
  const choice = payload.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message) || typeof choice.message.content !== "string") {
    throw new Error("The model returned an empty response. Try again.");
  }
  return parseJsonObject(choice.message.content);
}
