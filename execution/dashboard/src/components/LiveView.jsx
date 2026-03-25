/**
 * LiveView -- Primary monitoring tab for the Sarah Dashboard.
 *
 * Displays the active call (hero card with pulse), today's stats in a
 * responsive grid, and a recent calls table with expandable details.
 * Data is fetched from /api/dashboard/live and refreshed every 5 seconds.
 */

import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "../api";
import { useInterval } from "../hooks/useInterval";
import { POLL_LIVE } from "../constants";
import ActiveCallCard from "./ActiveCallCard";
import StatCard from "./StatCard";
import RecentCallsTable from "./RecentCallsTable";

const DEFAULT_DATA = {
  active_call: null,
  recent_calls: [],
  today_stats: {
    total_calls: 0,
    connected: 0,
    committed: 0,
    conversion_rate: 0,
  },
};

export default function LiveView() {
  const [data, setData] = useState(DEFAULT_DATA);
  const [error, setError] = useState(null);

  const fetchLive = useCallback(async () => {
    try {
      const result = await apiFetch("/live");
      if (result) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      setError(err.message || "Failed to fetch live data");
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchLive();
  }, [fetchLive]);

  // Poll every 5 seconds
  useInterval(fetchLive, POLL_LIVE);

  const stats = data.today_stats;

  return (
    <div className="space-y-4">
      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2.5 text-sm">
          <span className="text-red-700 dark:text-red-400">{error}</span>
          <button
            onClick={fetchLive}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium text-xs ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Active call hero card */}
      <ActiveCallCard call={data.active_call} />

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Calls"
          value={stats.total_calls}
          color="blue"
        />
        <StatCard
          label="Connected"
          value={stats.connected}
          color="green"
        />
        <StatCard
          label="Committed"
          value={stats.committed}
          color="yellow"
        />
        <StatCard
          label="Conversion Rate"
          value={`${stats.conversion_rate}%`}
          color="purple"
        />
      </div>

      {/* Recent calls table */}
      <RecentCallsTable calls={data.recent_calls} />
    </div>
  );
}
