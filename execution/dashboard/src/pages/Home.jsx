import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Play, Pause, Square, Phone } from "lucide-react";
import { apiFetch, apiPost } from "../api";
import { useInterval } from "../hooks/useInterval";
import { formatDuration, formatTime } from "../constants";
import StatusBadge from "../components/StatusBadge";
import { SkeletonCard, SkeletonTable } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";

const POLL_INTERVAL = 10_000;

const STAT_DEFS = [
  { key: "calls_today",        label: "Calls Today",      color: "text-zinc-100" },
  { key: "pickup_rate_pct",    label: "Pickup Rate",      color: "text-green-400",  format: (v) => `${Number(v ?? 0).toFixed(1)}%` },
  { key: "commitments_today",  label: "Commitments",      color: "text-emerald-400" },
  { key: "follow_ups_today",   label: "Follow-Ups",       color: "text-blue-400" },
  { key: "declines_today",     label: "Declines",         color: "text-red-400" },
  { key: "avg_duration_sec",   label: "Avg Duration",     color: "text-violet-400", format: (v) => formatDuration(v) },
  { key: "outreach_sent_today",label: "Outreach Sent",    color: "text-cyan-400" },
  { key: "bookings_today",     label: "Bookings",         color: "text-orange-400" },
];

const SERVICE_NAMES = ["supabase", "retell", "n8n", "evolution", "calcom"];

function ServicePill({ name, status }) {
  const up = status === "up";
  const unknown = status == null || status === "unknown";
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-glass-fill border border-glass-border">
      <span
        className={`h-2 w-2 rounded-full flex-shrink-0 ${
          unknown ? "bg-zinc-600" : up ? "bg-green-500" : "bg-red-500"
        }`}
        style={up ? { boxShadow: "0 0 6px #22c55e" } : {}}
      />
      <span className="text-[11px] font-mono font-medium tracking-wide text-zinc-400 uppercase">
        {name}
      </span>
    </div>
  );
}

function StatCardItem({ label, value, color, loading }) {
  if (loading) return <SkeletonCard />;
  return (
    <div className="glass-card p-4">
      <p className="label-mono">{label}</p>
      <p className={`text-2xl font-semibold mt-1 tabular-nums ${color}`}>
        {value ?? "—"}
      </p>
    </div>
  );
}

function DialerControls({ status, loading, onStart, onPause, onStop }) {
  const running = status?.running;

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="label-mono">Dialer Controls</span>
        {!loading && (
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono border ${
              running
                ? "bg-green-500/15 border-green-500/30 text-green-400"
                : "bg-zinc-500/15 border-zinc-500/30 text-zinc-400"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${running ? "bg-green-500 animate-pulse" : "bg-zinc-500"}`}
            />
            {running ? "Running" : "Stopped"}
          </span>
        )}
      </div>

      {/* Dialer meta */}
      {!loading && status && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="label-mono mb-0.5">Calls Today</p>
            <p className="text-zinc-200 font-semibold tabular-nums">{status.calls_today ?? "—"}</p>
          </div>
          <div>
            <p className="label-mono mb-0.5">Remaining</p>
            <p className="text-zinc-200 font-semibold tabular-nums">{status.calls_remaining != null ? status.calls_remaining : "∞"}</p>
          </div>
          <div>
            <p className="label-mono mb-0.5">Active Calls</p>
            <p className="text-orange-400 font-semibold tabular-nums">
              {status.active_calls ?? 0}
              <span className="text-zinc-600 font-normal"> / {status.max_concurrent ?? 18}</span>
            </p>
          </div>
          <div>
            <p className="label-mono mb-0.5">Slots Free</p>
            <p className="text-zinc-200 font-semibold tabular-nums">
              {status.max_concurrent != null && status.active_calls != null
                ? status.max_concurrent - status.active_calls
                : "—"}
            </p>
          </div>
          {status.next_lead && (
            <div className="col-span-2">
              <p className="label-mono mb-0.5">Next Lead</p>
              <p className="text-zinc-400 text-xs truncate">{status.next_lead.name} — {status.next_lead.phone}</p>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onStart}
          disabled={loading || running}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium
            bg-green-500/15 border border-green-500/30 text-green-400
            hover:bg-green-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
          Start
        </button>

        <button
          onClick={onPause}
          disabled={loading || !running}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium
            bg-amber-500/15 border border-amber-500/30 text-amber-400
            hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Pause className="w-3.5 h-3.5" />
          Pause
        </button>

        <button
          onClick={onStop}
          disabled={loading || !running}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium
            bg-red-500/15 border border-red-500/30 text-red-400
            hover:bg-red-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Square className="w-3.5 h-3.5" />
          Stop
        </button>
      </div>
    </div>
  );
}

function LiveCallCard({ call }) {
  const displayName = call.first_name
    ? `${call.first_name} ${call.last_name || ""}`.trim()
    : call.name || "Unknown";

  return (
    <div className="glass-card p-4 border-orange-500/30 shadow-lg shadow-orange-500/5">
      <div className="flex items-center gap-2 mb-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" style={{ boxShadow: "0 0 6px #22c55e" }} />
        </span>
        <span className="label-mono text-orange-500 text-[11px]">
          {call.status === "in_call" ? "In Call" : "Connecting"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="label-mono mb-0.5">Lead</p>
          <p className="text-zinc-100 font-semibold truncate">{displayName}</p>
        </div>
        <div>
          <p className="label-mono mb-0.5">Phone</p>
          <p className="text-zinc-400 font-mono">{call.phone}</p>
        </div>
        {call.programme_recommended && (
          <div className="col-span-2">
            <p className="label-mono mb-0.5">Programme</p>
            <p className="text-zinc-300 truncate">{call.programme_recommended}</p>
          </div>
        )}
        {call.detected_persona && (
          <div className="col-span-2">
            <p className="label-mono mb-0.5">Persona</p>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-violet-500/15 border border-violet-500/30 text-violet-400">
              {call.detected_persona}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function LiveCallPanel({ activeCall, loading }) {
  if (loading) return <SkeletonCard className="min-h-[120px]" />;

  const calls = Array.isArray(activeCall) ? activeCall : (activeCall ? [activeCall] : []);

  if (calls.length === 0) {
    return (
      <div className="glass-card p-5 flex items-center justify-center min-h-[120px]">
        <div className="flex items-center gap-2 text-zinc-600">
          <Phone className="w-4 h-4" />
          <span className="text-sm">No active calls</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="label-mono text-orange-500">Live Calls</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono bg-orange-500/15 border border-orange-500/30 text-orange-400">
          {calls.length} active
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {calls.map((call) => (
          <LiveCallCard key={call.id} call={call} />
        ))}
      </div>
    </div>
  );
}

function RecentCallsSection({ calls, loading }) {
  if (loading) {
    return (
      <div className="glass-card p-5">
        <p className="label-mono mb-4">Recent Calls</p>
        <SkeletonTable rows={5} />
      </div>
    );
  }

  if (!calls || calls.length === 0) {
    return (
      <div className="glass-card p-5">
        <p className="label-mono mb-4">Recent Calls</p>
        <EmptyState
          title="No calls yet"
          message="Recent calls will appear here once the dialer has run."
        />
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <p className="label-mono mb-4">Recent Calls</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-glass-border">
              <th className="text-left label-mono pb-2 pr-4 font-normal">Time</th>
              <th className="text-left label-mono pb-2 pr-4 font-normal">Lead</th>
              <th className="text-left label-mono pb-2 pr-4 font-normal">Duration</th>
              <th className="text-left label-mono pb-2 pr-4 font-normal">Outcome</th>
              <th className="text-left label-mono pb-2 font-normal">Strategy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-glass-border">
            {calls.map((call) => (
              <tr key={call.id} className="hover:bg-glass-fill transition-colors">
                <td className="py-2.5 pr-4 text-zinc-500 font-mono text-xs tabular-nums whitespace-nowrap">
                  {formatTime(call.started_at)}
                </td>
                <td className="py-2.5 pr-4">
                  {call.id ? (
                    <Link
                      to={`/calls/${call.id}`}
                      className="text-zinc-200 hover:text-orange-400 font-mono text-xs transition-colors"
                    >
                      {call.lead_phone || call.phone || "—"}
                    </Link>
                  ) : (
                    <span className="text-zinc-400 font-mono text-xs">
                      {call.lead_phone || call.phone || "—"}
                    </span>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-zinc-400 font-mono text-xs tabular-nums">
                  {formatDuration(call.duration_sec)}
                </td>
                <td className="py-2.5 pr-4">
                  <StatusBadge status={call.outcome || call.status} />
                </td>
                <td className="py-2.5">
                  {call.strategy ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-violet-500/15 border border-violet-500/30 text-violet-400">
                      {call.strategy}
                    </span>
                  ) : (
                    <span className="text-zinc-600 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Home() {
  const [stats, setStats]           = useState(null);
  const [activeCall, setActiveCall] = useState([]);
  const [dialerStatus, setDialerStatus] = useState(null);
  const [health, setHealth]         = useState(null);
  const [calls, setCalls]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [dialerBusy, setDialerBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [todayData, liveData, dialerData, healthData, callsData] = await Promise.allSettled([
        apiFetch("/analytics/today"),
        apiFetch("/calls/live"),
        apiFetch("/dialer/status"),
        apiFetch("/health/services"),
        apiFetch("/calls?per_page=10&sort_by=started_at&sort_order=desc"),
      ]);

      if (todayData.status === "fulfilled" && todayData.value) {
        setStats(todayData.value);
      }
      if (liveData.status === "fulfilled" && liveData.value) {
        setActiveCall(liveData.value.active_calls || []);
      }
      if (dialerData.status === "fulfilled" && dialerData.value) {
        setDialerStatus(dialerData.value);
      }
      if (healthData.status === "fulfilled" && healthData.value) {
        setHealth(healthData.value);
      }
      if (callsData.status === "fulfilled" && callsData.value) {
        setCalls(callsData.value.calls ?? []);
      }

      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useState(() => { fetchAll(); });

  // Poll every 10s
  useInterval(fetchAll, POLL_INTERVAL);

  async function handleDialerAction(action) {
    setDialerBusy(true);
    try {
      await apiPost(`/dialer/${action}`);
      await fetchAll();
    } catch (err) {
      setError(err.message || `Dialer ${action} failed`);
    } finally {
      setDialerBusy(false);
    }
  }

  // Build stat values
  const statItems = STAT_DEFS.map((def) => ({
    ...def,
    value: stats
      ? def.format
        ? def.format(stats[def.key])
        : String(stats[def.key] ?? 0)
      : null,
  }));

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-50">Home</h1>
          <p className="text-xs text-zinc-600 mt-0.5">Today's overview · refreshes every 10s</p>
        </div>
        {error && (
          <span className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg">
            {error}
          </span>
        )}
      </div>

      {/* Today's Stats — 4-column grid of 8 cards */}
      <section>
        <p className="label-mono mb-3">Today's Stats</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statItems.map((item) => (
            <StatCardItem
              key={item.key}
              label={item.label}
              value={item.value}
              color={item.color}
              loading={loading}
            />
          ))}
        </div>
      </section>

      {/* Live Call + Dialer Controls — 2-column */}
      <section>
        <p className="label-mono mb-3">Live Call &amp; Dialer</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LiveCallPanel activeCall={activeCall} loading={loading} />
          <DialerControls
            status={dialerStatus}
            loading={loading || dialerBusy}
            onStart={() => handleDialerAction("start")}
            onPause={() => handleDialerAction("pause")}
            onStop={() => handleDialerAction("stop")}
          />
        </div>
      </section>

      {/* Service Health — horizontal pill row */}
      <section>
        <p className="label-mono mb-3">Service Health</p>
        <div className="flex flex-wrap gap-2">
          {SERVICE_NAMES.map((name) => (
            <ServicePill
              key={name}
              name={name}
              status={loading ? null : health?.[name]}
            />
          ))}
        </div>
      </section>

      {/* Recent Calls */}
      <section>
        <RecentCallsSection calls={calls} loading={loading} />
      </section>
    </div>
  );
}
