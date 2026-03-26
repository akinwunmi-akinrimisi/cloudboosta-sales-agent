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
  today_stats: { total_calls: 0, connected: 0, committed: 0, conversion_rate: 0 },
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

  useEffect(() => { fetchLive(); }, [fetchLive]);
  useInterval(fetchLive, POLL_LIVE);

  const stats = data.today_stats;

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center justify-between glass-card border-red-500/30 px-4 py-2.5 text-sm">
          <span className="text-red-400">{error}</span>
          <button onClick={fetchLive} className="text-red-400 hover:text-red-300 font-mono text-xs ml-4">
            Retry
          </button>
        </div>
      )}

      <ActiveCallCard call={data.active_call} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Calls" value={stats.total_calls} color="blue" />
        <StatCard label="Connected" value={stats.connected} color="green" />
        <StatCard label="Committed" value={stats.committed} color="yellow" />
        <StatCard label="Conversion Rate" value={`${stats.conversion_rate}%`} color="purple" />
      </div>

      <RecentCallsTable calls={data.recent_calls} />
    </div>
  );
}
