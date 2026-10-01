import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const MODEL = "openai/gpt-6-astra";

export async function generateWeeklyReview(packet: unknown): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured for this app yet.");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const result = streamText({
    model: provider.responses(MODEL),
    system:
      "You are a concise productivity coach. Review one project's last 7 days of work and reply ONLY with JSON: " +
      '{"summary": string (3-5 sentences), "wins": string[], "concerns": string[], ' +
      '"priority_adjustments": [{"change": string, "reason": string}], "focus_next_week": string}. ' +
      "Keep each list to at most 4 items. Base everything on the data; mention when data is thin. " +
      "Use the user's reply language and coaching tone if given.",
    prompt: JSON.stringify(packet),
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  return await result.text;
}
