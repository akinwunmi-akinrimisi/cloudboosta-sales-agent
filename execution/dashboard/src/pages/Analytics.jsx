import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../api";
import { SkeletonCard } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_RANGES = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
];

const FUNNEL_STAGES = [
  { key: "total_imported", label: "Imported" },
  { key: "enriched", label: "Enriched" },
  { key: "outreach_sent", label: "Outreach" },
  { key: "responded", label: "Responded" },
  { key: "calls_completed", label: "Calls Done" },
  { key: "committed", label: "Committed" },
  { key: "enrolled", label: "Enrolled" },
];

const TOOLTIP_STYLE = {
  backgroundColor: "#18181b",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "8px",
  fontSize: "13px",
  color: "#e4e4e7",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

function heatColor(pct) {
  if (pct >= 20) return "bg-green-600/40";
  if (pct >= 10) return "bg-green-500/25";
  if (pct > 0) return "bg-green-500/10";
  return "bg-zinc-800";
}

function dropOffPct(current, previous) {
  if (!previous || previous === 0) return null;
  return Math.round(((previous - current) / previous) * 100);
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function SectionCard({ title, children, loading, skeletonHeight = 300 }) {
  return (
    <section className="glass-card p-5">
      <h3 className="label-mono text-zinc-500 text-xs mb-4 uppercase tracking-widest">{title}</h3>
      {loading ? (
        <div
          className="animate-pulse rounded-lg bg-zinc-800/60"
          style={{ height: skeletonHeight }}
        />
      ) : (
        children
      )}
    </section>
  );
}

// ─── Section 1: Daily Trends ──────────────────────────────────────────────────

function TrendsSection({ trends, loading }) {
  const empty = !loading && (!trends || trends.length === 0);

  return (
    <SectionCard title="Daily Trends — last 30 days" loading={loading} skeletonHeight={300}>
      {empty ? (
        <EmptyState title="No trend data" message="Trends appear after calls are logged." />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trends}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#71717a", fontSize: 12 }}
              tickFormatter={(d) =>
                new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" })
              }
            />
            <YAxis tick={{ fill: "#71717a", fontSize: 12 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="calls" stroke="#3b82f6" strokeWidth={2} dot={false} name="Calls" />
            <Line type="monotone" dataKey="commitments" stroke="#22c55e" strokeWidth={2} dot={false} name="Commitments" />
            <Line type="monotone" dataKey="follow_ups" stroke="#f59e0b" strokeWidth={2} dot={false} name="Follow-ups" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </SectionCard>
  );
}

// ─── Section 2: Strategy Performance ─────────────────────────────────────────

function buildStrategyData(strategies) {
  const agg = {};
  for (const row of strategies) {
    if (!agg[row.strategy]) {
      agg[row.strategy] = { strategy: row.strategy, total_calls: 0, commitments: 0 };
    }
    agg[row.strategy].total_calls += row.total_calls;
    agg[row.strategy].commitments += row.commitments;
  }
  return Object.values(agg)
    .map((s) => ({
      ...s,
      conversion_pct:
        s.total_calls > 0 ? Math.round((s.commitments / s.total_calls) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.conversion_pct - a.conversion_pct);
}

function StrategySection({ strategies, loading }) {
  const strategyData = strategies ? buildStrategyData(strategies) : [];
  const empty = !loading && strategyData.length === 0;
  const chartHeight = Math.max(80, strategyData.length * 50 + 40);

  return (
    <SectionCard title="Strategy Performance" loading={loading} skeletonHeight={220}>
      {empty ? (
        <EmptyState title="No strategy data" message="Strategy performance appears after calls are logged." />
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={strategyData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              type="number"
              tick={{ fill: "#71717a", fontSize: 12 }}
              domain={[0, 100]}
              unit="%"
            />
            <YAxis
              type="category"
              dataKey="strategy"
              tick={{ fill: "#a1a1aa", fontSize: 12 }}
              width={150}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value, _name, props) => [
                `${value}% — ${props.payload.total_calls} calls`,
                "Conversion",
              ]}
            />
            <Bar dataKey="conversion_pct" fill="#22c55e" radius={[0, 4, 4, 0]} name="Conversion %" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </SectionCard>
  );
}

// ─── Section 3: Strategy × Persona Heatmap ───────────────────────────────────

function HeatmapSection({ heatmapData, loading }) {
  const empty = !loading && (!heatmapData || heatmapData.length === 0);

  const heatStrategies = heatmapData ? [...new Set(heatmapData.map((c) => c.strategy))] : [];
  const heatPersonas = heatmapData ? [...new Set(heatmapData.map((c) => c.persona))] : [];

  function cellFor(strategy, persona) {
    return heatmapData?.find((c) => c.strategy === strategy && c.persona === persona) ?? null;
  }

  return (
    <SectionCard title="Strategy × Persona Heatmap" loading={loading} skeletonHeight={160}>
      {empty ? (
        <EmptyState title="No heatmap data" message="Heatmap populates after strategy + persona combinations are logged." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left py-2 pr-3 text-zinc-500 font-mono font-normal w-40">
                  Strategy
                </th>
                {heatPersonas.map((p) => (
                  <th
                    key={p}
                    className="py-2 px-2 text-center text-zinc-500 font-mono font-normal capitalize whitespace-nowrap"
                  >
                    {p.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatStrategies.map((strategy) => (
                <tr key={strategy}>
                  <td className="py-1.5 pr-3 text-zinc-300 font-mono text-xs whitespace-nowrap">
                    {strategy}
                  </td>
                  {heatPersonas.map((persona) => {
                    const cell = cellFor(strategy, persona);
                    const pct = cell?.conversion_pct ?? 0;
                    const calls = cell?.calls ?? 0;
                    return (
                      <td
                        key={persona}
                        className={`py-1.5 px-2 text-center rounded transition-colors ${heatColor(pct)}`}
                      >
                        {calls > 0 ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-zinc-100 tabular-nums">{pct}%</div>
                            <div className="text-zinc-500 tabular-nums">{calls}c</div>
                          </div>
                        ) : (
                          <span className="text-zinc-700">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section 4: Funnel ────────────────────────────────────────────────────────

function FunnelSection({ funnel, loading }) {
  const empty = !loading && !funnel;

  return (
    <SectionCard title="Lead Funnel" loading={loading} skeletonHeight={140}>
      {empty ? (
        <EmptyState title="No funnel data" message="Funnel data appears once leads are imported." />
      ) : (
        <div className="overflow-x-auto">
          <div className="flex items-stretch gap-0 min-w-max">
            {FUNNEL_STAGES.map((stage, idx) => {
              const count = funnel?.[stage.key] ?? 0;
              const prevCount =
                idx > 0 ? (funnel?.[FUNNEL_STAGES[idx - 1].key] ?? 0) : null;
              const drop = dropOffPct(count, prevCount);

              return (
                <div key={stage.key} className="flex items-center">
                  {/* Box */}
                  <div className="flex flex-col items-center justify-center px-4 py-4 rounded-lg bg-zinc-900/60 border border-zinc-800 min-w-[90px] text-center">
                    <span className="text-2xl font-bold text-zinc-100 tabular-nums">
                      {count.toLocaleString()}
                    </span>
                    <span className="text-[10px] label-mono text-zinc-500 mt-1">{stage.label}</span>
                    {drop !== null && (
                      <span
                        className={`text-[10px] font-mono mt-1.5 ${
                          drop > 50 ? "text-red-400" : "text-zinc-500"
                        }`}
                      >
                        {drop > 0 ? `-${drop}%` : "—"}
                      </span>
                    )}
                  </div>

                  {/* Arrow between boxes */}
                  {idx < FUNNEL_STAGES.length - 1 && (
                    <div className="flex items-center px-1">
                      <svg
                        className="w-4 h-4 text-zinc-700 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <p className="text-[10px] text-zinc-600 mt-3 font-mono">
            Drop-off % is relative to previous stage. Red = &gt;50% drop.
          </p>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Section 5: Objection Frequency ──────────────────────────────────────────

function ObjectionsSection({ objections, loading }) {
  const empty = !loading && (!objections || objections.length === 0);
  const chartHeight = Math.max(80, (objections?.length ?? 0) * 40 + 40);

  return (
    <SectionCard title="Objection Frequency" loading={loading} skeletonHeight={200}>
      {empty ? (
        <EmptyState
          title="No objection data"
          message="Objection tracking begins after John handles his first objections."
        />
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={objections} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis type="number" tick={{ fill: "#71717a", fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="objection"
              tick={{ fill: "#a1a1aa", fontSize: 12 }}
              width={180}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar
              dataKey="resolved_to_commit"
              stackId="a"
              fill="#22c55e"
              name="Resolved → Commit"
            />
            <Bar
              dataKey="resolved_to_follow_up"
              stackId="a"
              fill="#f59e0b"
              name="Resolved → Follow-up"
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </SectionCard>
  );
}

// ─── Section 6: Revenue ───────────────────────────────────────────────────────

function RevenueSection({ revenue, loading }) {
  const empty = !loading && !revenue;

  const potential = revenue?.potential ?? null;
  const confirmed = revenue?.confirmed ?? null;

  return (
    <SectionCard title="Revenue Estimate" loading={loading} skeletonHeight={120}>
      {empty ? (
        <EmptyState title="No revenue data" message="Revenue estimates appear once commitments are logged." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Potential */}
          <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 px-6 py-5 flex flex-col gap-2">
            <p className="label-mono text-zinc-500 text-xs">Potential Revenue</p>
            <p className="text-3xl font-bold text-green-400 tabular-nums">
              {formatCurrency(potential?.estimated_revenue)}
            </p>
            <p className="text-xs text-zinc-500 font-mono">
              {potential?.count ?? 0} committed lead{potential?.count !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Confirmed */}
          <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 px-6 py-5 flex flex-col gap-2">
            <p className="label-mono text-zinc-500 text-xs">Confirmed Revenue</p>
            <p className="text-3xl font-bold text-emerald-300 tabular-nums">
              {formatCurrency(confirmed?.estimated_revenue)}
            </p>
            <p className="text-xs text-zinc-500 font-mono">
              {confirmed?.count ?? 0} enrolled lead{confirmed?.count !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Main Analytics Page ──────────────────────────────────────────────────────

export default function Analytics() {
  const [activeRange, setActiveRange] = useState("30d");

  const [trends, setTrends] = useState(null);
  const [strategies, setStrategies] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [objections, setObjections] = useState(null);
  const [revenue, setRevenue] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [trendsRes, strategiesRes, heatmapRes, funnelRes, objectionsRes, revenueRes] =
        await Promise.allSettled([
          apiFetch("/analytics/trends"),
          apiFetch("/analytics/strategies"),
          apiFetch("/analytics/heatmap"),
          apiFetch("/analytics/funnel"),
          apiFetch("/analytics/objections"),
          apiFetch("/analytics/revenue"),
        ]);

      if (trendsRes.status === "fulfilled" && trendsRes.value) {
        setTrends(trendsRes.value.trends ?? []);
      }
      if (strategiesRes.status === "fulfilled" && strategiesRes.value) {
        setStrategies(strategiesRes.value.strategies ?? []);
      }
      if (heatmapRes.status === "fulfilled" && heatmapRes.value) {
        setHeatmapData(heatmapRes.value.cells ?? []);
      }
      if (funnelRes.status === "fulfilled" && funnelRes.value) {
        setFunnel(funnelRes.value);
      }
      if (objectionsRes.status === "fulfilled" && objectionsRes.value) {
        setObjections(objectionsRes.value.objections ?? []);
      }
      if (revenueRes.status === "fulfilled" && revenueRes.value) {
        setRevenue(revenueRes.value);
      }
    } catch (err) {
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-50">Analytics</h1>
          <p className="text-xs text-zinc-600 mt-0.5">Last 30 days · all time zones</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Date range quick buttons — visual only, data always last 30d */}
          {DATE_RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setActiveRange(r.label)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors ${
                activeRange === r.label
                  ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
                  : "bg-zinc-900/60 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
              }`}
            >
              {r.label}
            </button>
          ))}

          <button
            onClick={fetchAll}
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium border bg-zinc-900/60 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="glass-card border-red-500/30 px-4 py-3 text-sm flex items-center justify-between">
          <span className="text-red-400 font-mono text-xs">{error}</span>
          <button
            onClick={fetchAll}
            className="ml-4 text-red-400 hover:text-red-300 font-mono text-xs underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Legend row */}
      {!loading && (
        <div className="flex items-center gap-4 text-[11px] font-mono text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 bg-blue-500 rounded" />
            Calls
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 bg-green-500 rounded" />
            Commitments
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 bg-amber-500 rounded" />
            Follow-ups
          </span>
        </div>
      )}

      {/* ── Section 1: Daily Trends ── */}
      <TrendsSection trends={trends} loading={loading} />

      {/* ── Section 2: Strategy Performance ── */}
      <StrategySection strategies={strategies} loading={loading} />

      {/* ── Section 3: Strategy × Persona Heatmap ── */}
      <HeatmapSection heatmapData={heatmapData} loading={loading} />

      {/* ── Section 4: Lead Funnel ── */}
      <FunnelSection funnel={funnel} loading={loading} />

      {/* ── Section 5: Objection Frequency ── */}
      <ObjectionsSection objections={objections} loading={loading} />

      {/* ── Section 6: Revenue ── */}
      <RevenueSection revenue={revenue} loading={loading} />
    </div>
  );
}
