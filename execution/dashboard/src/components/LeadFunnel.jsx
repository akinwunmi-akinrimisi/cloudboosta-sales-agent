import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { FUNNEL_STAGES } from "../constants";
import EmptyState from "./EmptyState";

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 shadow-lg">
      <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500 mb-0.5">
        {name}
      </p>
      <p className="text-base font-bold text-zinc-50 tabular-nums">{value}</p>
    </div>
  );
}

export default function LeadFunnel({ funnel }) {
  const data = FUNNEL_STAGES.map((stage) => ({
    key: stage.key,
    name: stage.label,
    value: funnel?.[stage.key] ?? 0,
    color: stage.color,
  }));

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="glass-card flex flex-col">
      <div className="px-4 py-3 border-b border-glass-border flex items-center justify-between">
        <h3 className="label-mono text-zinc-400">Lead Funnel</h3>
        <span className="font-mono text-xs text-zinc-500">
          {total.toLocaleString()} total
        </span>
      </div>

      <div className="p-4 flex-1">
        {total === 0 ? (
          <EmptyState
            title="No leads yet"
            message="Lead stage distribution will appear once leads are imported."
          />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              barCategoryGap="30%"
            >
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#71717a", fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#71717a", fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((entry) => (
                  <Cell key={entry.key} fill={entry.color} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
