import { useState } from "react";
import { maskPhone } from "../constants";
import { apiPost } from "../api";
import EmptyState from "./EmptyState";

function PriorityBadge({ priority }) {
  if (!priority || priority <= 1) return null;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-medium bg-orange-500/15 border border-orange-500/30 text-orange-400">
      P{priority}
    </span>
  );
}

function CallTypeBadge({ callType }) {
  if (!callType) return null;
  const label = callType === "retry" ? "Retry" : "New";
  const cls =
    callType === "retry"
      ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
      : "bg-blue-500/15 border-blue-500/30 text-blue-400";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[10px] font-medium border ${cls}`}
    >
      {label}
    </span>
  );
}

function RetryCount({ count }) {
  if (!count || count === 0) return null;
  return (
    <span className="font-mono text-[10px] text-zinc-600">
      {count}x tried
    </span>
  );
}

function QueueRow({ lead, onNavigateToLead }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleCall() {
    setLoading(true);
    setError(null);
    try {
      await apiPost(`/call-now/${lead.id}`);
    } catch (err) {
      setError(err.message || "Call failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-glass-border last:border-0 group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => onNavigateToLead?.(lead.id)}
            className="text-sm font-medium text-zinc-200 hover:text-orange-400 transition-colors truncate text-left"
          >
            {lead.name || "Unknown"}
          </button>
          <PriorityBadge priority={lead.priority} />
          <CallTypeBadge callType={lead.call_type} />
          <RetryCount count={lead.retry_count} />
        </div>
        <p className="font-mono text-[11px] text-zinc-600 mt-0.5">
          {maskPhone(lead.phone)}
        </p>
        {error && (
          <p className="text-[11px] text-red-400 mt-0.5">{error}</p>
        )}
      </div>

      <button
        onClick={handleCall}
        disabled={loading}
        className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
          loading
            ? "bg-zinc-700/50 text-zinc-500 cursor-not-allowed"
            : "bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 hover:text-green-300"
        }`}
      >
        {loading ? (
          <>
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Calling
          </>
        ) : (
          <>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Call
          </>
        )}
      </button>
    </div>
  );
}

export default function CallQueuePanel({ queue, onNavigateToLead }) {
  const leads = queue?.slice(0, 10) ?? [];

  return (
    <div className="glass-card flex flex-col">
      <div className="px-4 py-3 border-b border-glass-border flex items-center justify-between">
        <h3 className="label-mono text-zinc-400">Call Queue</h3>
        {leads.length > 0 && (
          <span className="font-mono text-xs text-zinc-500">
            {leads.length} ready
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ maxHeight: "320px" }}>
        {leads.length === 0 ? (
          <EmptyState
            title="Queue is empty"
            message="Leads will appear here when the auto-dialer queues them."
          />
        ) : (
          <div className="px-4">
            {leads.map((lead) => (
              <QueueRow
                key={lead.id}
                lead={lead}
                onNavigateToLead={onNavigateToLead}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
