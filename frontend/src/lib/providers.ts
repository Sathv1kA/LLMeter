/**
 * Provider → display name + brand color mapping.
 *
 * `colorVar` is a CSS var reference so it works inline (e.g. the dot
 * next to a model in the live feed) without baking the oklch literal
 * into JSX. The chip utility classes use arbitrary-value oklch() so
 * Tailwind picks them up at build-time.
 */
export type ProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "mistral"
  | "meta"
  | "cohere"
  | "xai"
  | "deepseek"
  | "groq";

export interface ProviderMeta {
  label: string;
  colorVar: string;
  /** Classname for chips/badges — tinted background + matching border. */
  chip: string;
}

const UNKNOWN: ProviderMeta = {
  label: "Other",
  colorVar: "var(--muted-foreground)",
  chip: "bg-muted/40 text-muted-foreground border-border",
};

export const PROVIDER_META: Record<string, ProviderMeta> = {
  openai: {
    label: "OpenAI",
    colorVar: "var(--openai)",
    chip: "bg-[oklch(0.74_0.16_155/0.15)] text-[oklch(0.85_0.18_155)] border-[oklch(0.74_0.16_155/0.4)]",
  },
  anthropic: {
    label: "Anthropic",
    colorVar: "var(--anthropic)",
    chip: "bg-[oklch(0.74_0.15_55/0.15)] text-[oklch(0.86_0.17_60)] border-[oklch(0.74_0.15_55/0.4)]",
  },
  google: {
    label: "Google",
    colorVar: "var(--google)",
    chip: "bg-[oklch(0.7_0.15_240/0.15)] text-[oklch(0.83_0.15_235)] border-[oklch(0.7_0.15_240/0.4)]",
  },
  mistral: {
    label: "Mistral",
    colorVar: "var(--mistral)",
    chip: "bg-[oklch(0.7_0.18_25/0.15)] text-[oklch(0.84_0.18_30)] border-[oklch(0.7_0.18_25/0.4)]",
  },
  meta: {
    label: "Meta",
    colorVar: "var(--meta)",
    chip: "bg-[oklch(0.66_0.17_265/0.15)] text-[oklch(0.82_0.16_265)] border-[oklch(0.66_0.17_265/0.4)]",
  },
  cohere: {
    label: "Cohere",
    colorVar: "var(--cohere)",
    chip: "bg-[oklch(0.68_0.17_320/0.15)] text-[oklch(0.85_0.18_325)] border-[oklch(0.68_0.17_320/0.4)]",
  },
  xai: {
    label: "xAI",
    colorVar: "var(--magenta)",
    chip: "bg-[oklch(0.66_0.22_340/0.15)] text-[oklch(0.85_0.2_340)] border-[oklch(0.66_0.22_340/0.4)]",
  },
  deepseek: {
    label: "DeepSeek",
    colorVar: "var(--cyan)",
    chip: "bg-[oklch(0.74_0.12_210/0.15)] text-[oklch(0.86_0.12_210)] border-[oklch(0.74_0.12_210/0.4)]",
  },
  groq: {
    label: "Groq",
    colorVar: "var(--success)",
    chip: "bg-[oklch(0.74_0.17_155/0.15)] text-[oklch(0.86_0.17_155)] border-[oklch(0.74_0.17_155/0.4)]",
  },
};

export function providerMeta(id: string | null | undefined): ProviderMeta {
  if (!id) return UNKNOWN;
  return PROVIDER_META[id] ?? UNKNOWN;
}
