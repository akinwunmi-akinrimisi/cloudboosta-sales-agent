import { useState, useCallback } from "react";
import { legacyFetch as apiFetch } from "../api";
import { POLL_COMMAND } from "../constants";
import { useInterval } from "../hooks/useInterval";
import StatCard from "./StatCard";
import ActiveCallCard from "./ActiveCallCard";
import RecentCallsTable from "./RecentCallsTable";
import CallQueuePanel from "./CallQueuePanel";
import LeadFunnel from "./LeadFunnel";
import ActivityFeed from "./ActivityFeed";

const DEFAULT_DATA = {
  stats: {
    total_leads: 0,
    queued: 0,
    todays_calls: 0,
    connected: 0,
    committed: 0,
    conversion_rate: 0,
  },
  active_call: null,
  queue: [],
  funnel: {
    new: 0,
    queued: 0,
    in_progress: 0,
    follow_up: 0,
    committed: 0,
    closed: 0,
  },
  activity: [],
  recent_calls: [],
};

export default function CommandCentre({ onNavigateToLead }) {
  const [data, setData] = useState(DEFAULT_DATA);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await apiFetch("/command-centre");
      if (result) {
        setData((prev) => ({ ...DEFAULT_DATA, ...prev, ...result }));
        setError(null);
      }
    } catch (err) {
      setError(err.message || "Failed to load data");
    }
  }, []);

  // Initial fetch + polling
  useState(() => {
    fetchData();
  });
  useInterval(fetchData, POLL_COMMAND);

  const { stats, active_call, queue, funnel, activity, recent_calls } = data;

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-50">Command Centre</h1>
          <p className="text-xs text-zinc-600 mt-0.5">Live overview · refreshes every 5s</p>
        </div>
        {error && (
          <span className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg">
            {error}
          </span>
        )}
      </div>

      {/* Stat cards — 3 cols mobile, 6 cols desktop */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Total Leads"
          value={stats.total_leads.toLocaleString()}
          color="blue"
        />
        <StatCard
          label="Queued"
          value={stats.queued.toLocaleString()}
          color="purple"
        />
        <StatCard
          label="Today's Calls"
          value={stats.todays_calls.toLocaleString()}
          color="blue"
        />
        <StatCard
          label="Connected"
          value={stats.connected.toLocaleString()}
          color="green"
        />
        <StatCard
          label="Committed"
          value={stats.committed.toLocaleString()}
          color="yellow"
        />
        <StatCard
          label="Conversion"
          value={`${Number(stats.conversion_rate ?? 0).toFixed(1)}%`}
          color="purple"
        />
      </div>

      {/* Active call + Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="flex flex-col gap-4">
          {active_call ? (
            <ActiveCallCard call={active_call} />
          ) : (
            <div className="glass-card p-5 flex items-center justify-center text-zinc-600 text-sm min-h-[100px]">
              No active call right now
            </div>
          )}
        </div>
        <CallQueuePanel queue={queue} onNavigateToLead={onNavigateToLead} />
      </div>

      {/* Funnel + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LeadFunnel funnel={funnel} />
        <ActivityFeed activity={activity} />
      </div>

      {/* Recent calls */}
      <RecentCallsTable calls={recent_calls} onNavigateToLead={onNavigateToLead} />
    </div>
  );
}
