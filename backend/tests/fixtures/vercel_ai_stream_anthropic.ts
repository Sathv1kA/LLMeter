// Fixture: Vercel AI SDK streamText with anthropic helper, in a for-of loop
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

const items = ["a", "b", "c"];

export async function classifyAll() {
  const out: string[] = [];
  for (const item of items) {
    const { text } = await streamText({
      model: anthropic("claude-3-5-haiku-20241022"),
      prompt: `Classify the sentiment of: ${item}`,
    });
    out.push(text);
  }
  return out;
}
