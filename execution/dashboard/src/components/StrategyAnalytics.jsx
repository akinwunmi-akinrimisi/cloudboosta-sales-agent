/**
 * StrategyAnalytics -- Closing strategy performance charts and tables.
 *
 * Horizontal bar chart showing conversion rate per closing strategy (Recharts 3)
 * and a totals table with per-strategy and aggregate metrics.
 * Data auto-refreshes every 30 seconds via the /api/dashboard/strategy endpoint.
 */

import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { apiFetch } from "../api";
import { useInterval } from "../hooks/useInterval";
import { POLL_STRATEGY } from "../constants";
import EmptyState from "./EmptyState";

/** Return a bar color based on conversion rate performance. */
function rateColor(rate) {
  if (rate >= 40) return "#22c55e"; // green-500 -- high performer
  if (rate >= 20) return "#3b82f6"; // blue-500 -- mid performer
  return "#9ca3af"; // gray-400 -- needs improvement
}

/** Return a Tailwind text color class for conversion rate display. */
function rateTextClass(rate) {
  if (rate >= 40) return "text-green-600";
  if (rate >= 20) return "text-blue-600";
  return "text-gray-500";
}

/** Custom tooltip for the bar chart. */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-gray-900 dark:text-gray-100">{label}</p>
      <p className="text-gray-600 dark:text-gray-400">
        Conversion: <span className="font-semibold">{d.conversion_rate}%</span>
      </p>
      <p className="text-gray-600 dark:text-gray-400">
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

  // Initial fetch on mount.
  useEffect(() => {
    fetchStrategy();
  }, [fetchStrategy]);

  // Poll every POLL_STRATEGY ms (30 s).
  useInterval(fetchStrategy, POLL_STRATEGY);

  /* ---- Error banner ---- */
  const errorBanner = error ? (
    <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400">
      <span>{error}</span>
      <button
        onClick={fetchStrategy}
        className="ml-4 font-medium underline hover:no-underline"
      >
        Retry
      </button>
    </div>
  ) : null;

  /* ---- Empty state ---- */
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

  /* ---- Aggregate row for footer ---- */
  const totalCalls = strategies.reduce((sum, s) => sum + s.total_calls, 0);
  const totalCommitted = strategies.reduce(
    (sum, s) => sum + s.committed_count,
    0,
  );
  const weightedRate =
    totalCalls > 0
      ? Number(((totalCommitted / totalCalls) * 100).toFixed(1))
      : 0;
  const totalPersonas = strategies.reduce(
    (sum, s) => sum + (s.personas_seen || 0),
    0,
  );

  return (
    <div className="space-y-6">
      {errorBanner}

      {/* ---- Bar chart card ---- */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">
          Conversion Rate by Strategy
        </h2>
        <ResponsiveContainer
          width="100%"
          height={Math.max(200, strategies.length * 50)}
        >
          <BarChart
            layout="vertical"
            data={strategies}
            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              unit="%"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="strategy"
              width={160}
              tick={{ fontSize: 12 }}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar
              dataKey="conversion_rate"
              radius={[0, 4, 4, 0]}
              barSize={24}
            >
              {strategies.map((entry, idx) => (
                <Cell key={idx} fill={rateColor(entry.conversion_rate)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ---- Totals table card ---- */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">
          Strategy Performance Summary
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                  Strategy
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                  Total Calls
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                  Committed
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                  Conversion Rate
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">
                  Personas Seen
                </th>
              </tr>
            </thead>
            <tbody>
              {strategies.map((s, idx) => (
                <tr
                  key={s.strategy}
                  className={
                    idx % 2 === 0
                      ? "bg-white dark:bg-gray-800"
                      : "bg-gray-50/50 dark:bg-gray-800/30"
                  }
                >
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100">
                    {s.strategy}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                    {s.total_calls}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                    {s.committed_count}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${rateTextClass(s.conversion_rate)}`}
                  >
                    {s.conversion_rate}%
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                    {s.personas_seen}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 font-semibold">
                <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                  All Strategies
                </td>
                <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                  {totalCalls}
                </td>
                <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                  {totalCommitted}
                </td>
                <td
                  className={`px-4 py-3 text-right ${rateTextClass(weightedRate)}`}
                >
                  {weightedRate}%
                </td>
                <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                  {totalPersonas}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
