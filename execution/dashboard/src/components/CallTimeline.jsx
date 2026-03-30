import { useState } from "react";
import { formatDuration, formatDateTime } from "../constants";
import OutcomeBadge from "./OutcomeBadge";

function TranscriptViewer({ transcript }) {
  const [expanded, setExpanded] = useState(false);

  if (!transcript) {
    return <p className="text-xs text-zinc-600 italic">No transcript</p>;
  }

  const isLong = transcript.length > 300;
  const displayText =
    expanded || !isLong ? transcript : transcript.slice(0, 300) + "...";

  return (
    <div>
      <pre className="text-xs text-zinc-400 whitespace-pre-wrap bg-white/[0.02] border border-glass-border rounded-lg p-3 max-h-80 overflow-y-auto">
        {displayText}
      </pre>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-1.5 text-xs text-orange-500 hover:text-orange-400 font-mono focus:outline-none transition-colors"
        >
          {expanded ? "Collapse transcript" : "Show full transcript"}
        </button>
      )}
    </div>
  );
}

function CallCard({ call, index, total }) {
  const [open, setOpen] = useState(false);
  const callNumber = total - index;

  return (
    <div className="glass-card overflow-hidden">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors focus:outline-none text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Call number badge */}
          <span className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/[0.06] border border-glass-border font-mono text-[11px] text-zinc-400">
            #{callNumber}
          </span>

          {/* Date + duration */}
          <span className="text-sm text-zinc-300 font-medium truncate">
            {formatDateTime(call.created_at || call.started_at)}
          </span>
          <span className="flex-shrink-0 text-xs text-zinc-500 font-mono">
            {formatDuration(call.duration_seconds)}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <OutcomeBadge outcome={call.outcome} />
          {/* Chevron */}
          <svg
            className={`w-4 h-4 text-zinc-600 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded details */}
      {open && (
        <div className="border-t border-glass-border px-4 py-4 space-y-4">
          {/* Strategy / persona / disconnection badges */}
          <div className="flex flex-wrap gap-2">
            {call.closing_strategy_used && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-violet-500/15 border border-violet-500/30 text-violet-400">
                {call.closing_strategy_used.replace(/_/g, " ")}
              </span>
            )}
            {call.detected_persona && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-blue-500/15 border border-blue-500/30 text-blue-400">
                {call.detected_persona}
              </span>
            )}
            {call.disconnection_reason && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-zinc-500/15 border border-zinc-500/30 text-zinc-400">
                {call.disconnection_reason.replace(/_/g, " ")}
              </span>
            )}
          </div>

          {/* Summary */}
          {call.summary && (
            <div>
              <p className="label-mono mb-1.5">Summary</p>
              <p className="text-sm text-zinc-400 leading-relaxed">{call.summary}</p>
            </div>
          )}

          {/* Recording */}
          {call.recording_url && (
            <div>
              <p className="label-mono mb-1.5">Recording</p>
              <audio
                controls
                src={call.recording_url}
                className="w-full h-8"
                preload="none"
              >
                Your browser does not support the audio element.
              </audio>
            </div>
          )}

          {/* Transcript */}
          <div>
            <p className="label-mono mb-1.5">Transcript</p>
            <TranscriptViewer transcript={call.transcript} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function CallTimeline({ calls }) {
  if (!calls || calls.length === 0) {
    return (
      <div className="glass-card px-5 py-8 text-center">
        <svg
          className="w-8 h-8 text-zinc-700 mx-auto mb-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
        <p className="text-sm text-zinc-600 italic">No call records yet</p>
      </div>
    );
  }

  const sorted = [...calls].sort(
    (a, b) =>
      new Date(b.created_at || b.started_at).getTime() -
      new Date(a.created_at || a.started_at).getTime()
  );

  return (
    <div className="space-y-2">
      {sorted.map((call, index) => (
        <CallCard key={call.id} call={call} index={index} total={sorted.length} />
      ))}
    </div>
  );
}
