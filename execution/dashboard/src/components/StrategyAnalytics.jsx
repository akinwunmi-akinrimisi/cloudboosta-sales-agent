import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Cell,
} from "recharts";
import { apiFetch } from "../api";
import { useInterval } from "../hooks/useInterval";
import { POLL_STRATEGY } from "../constants";
import EmptyState from "./EmptyState";

function rateColor(rate) {
  if (rate >= 40) return "#22c55e";
  if (rate >= 20) return "#3b82f6";
  return "#71717a";
}

function rateTextClass(rate) {
  if (rate >= 40) return "text-green-500";
  if (rate >= 20) return "text-blue-500";
  return "text-zinc-500";
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-zinc-800 border border-glass-border rounded-lg shadow-xl px-3 py-2 text-sm">
      <p className="font-medium text-zinc-100">{label}</p>
      <p className="text-zinc-400">
        Conversion: <span className="font-semibold text-zinc-200">{d.conversion_rate}%</span>
      </p>
      <p className="text-zinc-400">
        {d.committed_count} committed / {d.total_calls} calls
      </p>
    </div>
  );
}

export default function StrategyAnalytics() {
  const [strategies, setStrategies] = useState([]);
  const [error, setError] = useState(null);

  const fetchStrategy = useCallback(async () => {
    try {
      const data = await apiFetch("/strategy");
      setStrategies(data.strategies || []);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load strategy data");
    }
  }, []);

  useEffect(() => { fetchStrategy(); }, [fetchStrategy]);
  useInterval(fetchStrategy, POLL_STRATEGY);

  const errorBanner = error ? (
    <div className="glass-card border-red-500/30 px-4 py-3 text-sm flex items-center justify-between">
      <span className="text-red-400">{error}</span>
      <button onClick={fetchStrategy} className="ml-4 text-red-400 hover:text-red-300 font-mono text-xs">Retry</button>
    </div>
  ) : null;

  if (strategies.length === 0 && !error) {
    return (
      <div className="space-y-6">
        {errorBanner}
        <EmptyState
          title="No call data yet"
          message="Analytics will appear after Sarah's first calls. Start the auto-dialer to begin collecting data."
        />
      </div>
    );
  }

  const totalCalls = strategies.reduce((sum, s) => sum + s.total_calls, 0);
  const totalCommitted = strategies.reduce((sum, s) => sum + s.committed_count, 0);
  const weightedRate = totalCalls > 0 ? Number(((totalCommitted / totalCalls) * 100).toFixed(1)) : 0;
  const totalPersonas = strategies.reduce((sum, s) => sum + (s.personas_seen || 0), 0);

  return (
    <div className="space-y-6">
      {errorBanner}

      {/* Bar chart card */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4 text-zinc-100">Conversion Rate by Strategy</h2>
        <ResponsiveContainer width="100%" height={Math.max(200, strategies.length * 50)}>
          <BarChart layout="vertical" data={strategies} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 12, fill: "#71717a" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
            <YAxis type="category" dataKey="strategy" width={160} tick={{ fontSize: 12, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey="conversion_rate" radius={[0, 4, 4, 0]} barSize={24}>
              {strategies.map((entry, idx) => (
                <Cell key={idx} fill={rateColor(entry.conversion_rate)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Totals table card */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4 text-zinc-100">Strategy Performance Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-glass-border">
                <th className="text-left px-4 py-3 label-mono">Strategy</th>
                <th className="text-right px-4 py-3 label-mono">Total Calls</th>
                <th className="text-right px-4 py-3 label-mono">Committed</th>
                <th className="text-right px-4 py-3 label-mono">Conversion</th>
                <th className="text-right px-4 py-3 label-mono">Personas</th>
              </tr>
            </thead>
            <tbody>
              {strategies.map((s, idx) => (
                <tr key={s.strategy} className={`border-b border-glass-border ${idx % 2 === 1 ? "bg-white/[0.01]" : ""}`}>
                  <td className="px-4 py-3 font-semibold text-zinc-200">{s.strategy}</td>
                  <td className="px-4 py-3 text-right text-zinc-400 font-mono">{s.total_calls}</td>
                  <td className="px-4 py-3 text-right text-zinc-400 font-mono">{s.committed_count}</td>
                  <td className={`px-4 py-3 text-right font-mono font-medium ${rateTextClass(s.conversion_rate)}`}>{s.conversion_rate}%</td>
                  <td className="px-4 py-3 text-right text-zinc-400 font-mono">{s.personas_seen}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-700 font-semibold">
                <td className="px-4 py-3 text-zinc-100">All Strategies</td>
                <td className="px-4 py-3 text-right text-zinc-200 font-mono">{totalCalls}</td>
                <td className="px-4 py-3 text-right text-zinc-200 font-mono">{totalCommitted}</td>
                <td className={`px-4 py-3 text-right font-mono ${rateTextClass(weightedRate)}`}>{weightedRate}%</td>
                <td className="px-4 py-3 text-right text-zinc-200 font-mono">{totalPersonas}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
