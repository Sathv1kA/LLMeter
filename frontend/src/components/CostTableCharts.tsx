/**
 * Recharts-using chart components, factored out so they can be code-split
 * via React.lazy(). Recharts ships ~150 KB of JS — users who never flip to
 * Chart view shouldn't have to download it.
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { fmtCost } from "../utils/formatters";

const PROVIDER_COLORS: Record<string, string> = {
  openai: "oklch(0.74 0.16 155)",
  anthropic: "oklch(0.74 0.15 55)",
  google: "oklch(0.7 0.15 240)",
  groq: "oklch(0.74 0.17 155)",
  mistral: "oklch(0.7 0.18 25)",
  meta: "oklch(0.66 0.17 265)",
  cohere: "oklch(0.68 0.17 320)",
  xai: "oklch(0.66 0.22 340)",
  deepseek: "oklch(0.74 0.12 210)",
};

const TOOLTIP_STYLE = {
  background: "oklch(0.2 0.012 270)",
  border: "1px solid oklch(0.32 0.012 270)",
  borderRadius: 4,
  fontSize: 12,
  color: "oklch(0.95 0.005 270)",
} as const;

const AXIS_TICK_NUM = { fontSize: 11, fill: "oklch(0.6 0.01 270)" } as const;
const AXIS_TICK_CAT = { fontSize: 11, fill: "oklch(0.85 0.005 270)" } as const;

interface ChartRow {
  model_id: string;
  name: string;
  cost: number;
  provider: string;
}

interface ModelCostBarChartProps {
  data: ChartRow[];
  selectedId: string | null;
  onSelect: (modelId: string) => void;
}

export function ModelCostBarChart({
  data,
  selectedId,
  onSelect,
}: ModelCostBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
        <XAxis
          type="number"
          tickFormatter={(v) => fmtCost(v)}
          tick={AXIS_TICK_NUM}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={AXIS_TICK_CAT}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(v) => fmtCost(Number(v))}
          cursor={{ fill: "oklch(0.85 0.18 65 / 0.08)" }}
          contentStyle={TOOLTIP_STYLE}
        />
        <Bar
          dataKey="cost"
          radius={[0, 2, 2, 0]}
          cursor="pointer"
          onClick={(item: { payload?: { model_id?: string } }) => {
            if (item?.payload?.model_id) onSelect(item.payload.model_id);
          }}
        >
          {data.map((d) => (
            <Cell
              key={d.model_id}
              fill={
                selectedId === d.model_id
                  ? "var(--primary)"
                  : PROVIDER_COLORS[d.provider] ?? "var(--muted-foreground)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const CMP_BAR_COLORS = {
  declared: "oklch(0.5 0.01 270)",
  selected: "oklch(0.78 0.16 70)",
  benchmark: "oklch(0.74 0.17 155)",
} as const;

export interface ComparisonRow {
  key: string;
  label: string;
  value: number;
  kind: keyof typeof CMP_BAR_COLORS;
}

export function WhatIfComparisonChart({ data }: { data: ComparisonRow[] }) {
  return (
    <ResponsiveContainer
      width="100%"
      height={Math.max(140, data.length * 48)}
    >
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16 }}>
        <XAxis
          type="number"
          tickFormatter={(v) => fmtCost(v)}
          tick={AXIS_TICK_NUM}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={200}
          tick={{ fontSize: 10, fill: "oklch(0.85 0.005 270)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(v) => fmtCost(Number(v))}
          contentStyle={TOOLTIP_STYLE}
        />
        <Bar dataKey="value" radius={[0, 2, 2, 0]} name="Cost">
          {data.map((d) => (
            <Cell key={d.key} fill={CMP_BAR_COLORS[d.kind]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Default export combines both — the lazy() loader wraps this component, and
// callers pick which sub-chart to render via the `mode` prop.
export type ChartsComponentProps =
  | {
      mode: "model-costs";
      data: ChartRow[];
      selectedId: string | null;
      onSelect: (modelId: string) => void;
    }
  | {
      mode: "what-if";
      data: ComparisonRow[];
    };

export default function CostTableCharts(props: ChartsComponentProps) {
  if (props.mode === "model-costs") {
    return (
      <ModelCostBarChart
        data={props.data}
        selectedId={props.selectedId}
        onSelect={props.onSelect}
      />
    );
  }
  return <WhatIfComparisonChart data={props.data} />;
}
