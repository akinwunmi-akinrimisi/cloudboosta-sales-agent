import { useState } from "react";
import { formatTime, formatDuration } from "../constants";
import OutcomeBadge from "./OutcomeBadge";
import EmptyState from "./EmptyState";

export default function RecentCallsTable({ calls }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!calls || calls.length === 0) {
    return (
      <div className="glass-card">
        <EmptyState
          title="No calls yet today"
          message="Recent calls will appear here once the auto-dialer starts."
        />
      </div>
    );
  }

  function toggleRow(id) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-glass-border">
        <h3 className="label-mono text-zinc-400">Recent Calls</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="table-auto w-full text-sm">
          <thead>
            <tr className="border-b border-glass-border text-left">
              <th className="px-4 py-2 label-mono">Time</th>
              <th className="px-4 py-2 label-mono">Lead</th>
              <th className="px-4 py-2 label-mono">Duration</th>
              <th className="px-4 py-2 label-mono">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => (
              <CallRow
                key={call.id}
                call={call}
                expanded={expandedId === call.id}
                onToggle={() => toggleRow(call.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CallRow({ call, expanded, onToggle }) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-glass-border cursor-pointer hover:bg-white/[0.02] transition-colors"
      >
        <td className="px-4 py-2.5 text-zinc-400 font-mono text-xs whitespace-nowrap">
          {formatTime(call.started_at)}
        </td>
        <td className="px-4 py-2.5 font-medium text-zinc-200">
          {call.lead_name || "Unknown"}
        </td>
        <td className="px-4 py-2.5 text-zinc-400 font-mono tabular-nums text-xs">
          {formatDuration(call.duration_seconds)}
        </td>
        <td className="px-4 py-2.5">
          <OutcomeBadge outcome={call.outcome} />
        </td>
      </tr>

      {expanded && (
        <tr className="bg-white/[0.02]">
          <td colSpan={4} className="px-4 py-3">
            <div className="space-y-3 text-sm">
              <div>
                <p className="label-mono mb-1">Summary</p>
                <p className="text-zinc-400 text-xs">{call.summary || "No summary available"}</p>
              </div>
              {call.recording_url && (
                <div>
                  <p className="label-mono mb-1">Recording</p>
                  <audio controls src={call.recording_url} className="w-full max-w-md" preload="none">
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}
              <div className="flex flex-wrap gap-4 text-xs text-zinc-600">
                {call.closing_strategy_used && (
                  <span>Strategy: <span className="text-zinc-400">{call.closing_strategy_used}</span></span>
                )}
                {call.detected_persona && (
                  <span>Persona: <span className="text-zinc-400">{call.detected_persona}</span></span>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
