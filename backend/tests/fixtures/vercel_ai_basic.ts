// Fixture: Vercel AI SDK basic generateText with openai helper
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function summarize(text: string) {
  const { text: out } = await generateText({
    model: openai("gpt-4o"),
    system: "Summarize in one sentence.",
    prompt: text,
    maxTokens: 200,
  });
  return out;
}
