// Fixture: Vercel AI SDK embed with google helper + a user-defined embed()
// that should NOT be detected.
import { embed } from "ai";
import { google } from "@ai-sdk/google";

// User-defined wrapper that shadows nothing but happens to share the name.
// Not a Vercel AI SDK call — no `model:` kwarg.
export function embedLocally(text: string) {
  return embed({ raw: text });
}

export async function makeEmbedding(text: string) {
  const { embedding } = await embed({
    model: google("gemini-1.5-flash"),
    value: text,
  });
  return embedding;
}
