import { providerMeta } from "../lib/providers";

interface ProviderBadgeProps {
  provider: string | null | undefined;
  modelName?: string;
  className?: string;
}

export function ProviderBadge({ provider, modelName, className }: ProviderBadgeProps) {
  const meta = providerMeta(provider);
  const cls = `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.chip}${className ? " " + className : ""}`;
  return (
    <span className={cls}>
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: meta.colorVar, boxShadow: `0 0 8px ${meta.colorVar}` }}
      />
      {modelName ?? meta.label}
    </span>
  );
}
