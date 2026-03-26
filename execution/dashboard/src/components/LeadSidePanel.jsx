import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../api";
import { maskPhone, formatDuration, formatTime } from "../constants";
import OutcomeBadge from "./OutcomeBadge";

function sortCallsDesc(calls) {
  return [...calls].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  );
}

function formatDateTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + formatTime(iso);
  } catch {
    return "";
  }
}

function TranscriptViewer({ transcript }) {
  const [expanded, setExpanded] = useState(false);
  if (!transcript) {
    return <p className="text-xs text-zinc-600 italic">No transcript available</p>;
  }
  const isLong = transcript.length > 200;
  const displayText = expanded || !isLong ? transcript : transcript.slice(0, 200) + "...";

  return (
    <div>
      <pre className="text-xs text-zinc-400 whitespace-pre-wrap bg-white/[0.02] border border-glass-border rounded-lg p-3 max-h-64 overflow-y-auto">
        {displayText}
      </pre>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-1 text-xs text-orange-500 hover:text-orange-400 font-mono focus:outline-none"
        >
          {expanded ? "Show less" : "Show full transcript"}
        </button>
      )}
    </div>
  );
}

function CallRecord({ call }) {
  return (
    <div className="glass-card p-3 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-300">{formatDateTime(call.started_at)}</span>
          <span className="text-xs text-zinc-500 font-mono">{formatDuration(call.duration_seconds)}</span>
        </div>
        <OutcomeBadge outcome={call.outcome} />
      </div>

      {(call.closing_strategy_used || call.detected_persona) && (
        <div className="flex flex-wrap gap-3 text-xs text-zinc-600">
          {call.closing_strategy_used && (
            <span>Strategy: <span className="text-zinc-400">{call.closing_strategy_used.replace(/_/g, " ")}</span></span>
          )}
          {call.detected_persona && (
            <span>Persona: <span className="text-zinc-400">{call.detected_persona}</span></span>
          )}
        </div>
      )}

      {call.summary && (
        <p className="text-xs text-zinc-400 leading-relaxed">{call.summary}</p>
      )}

      <div>
        <p className="label-mono mb-1">Transcript</p>
        <TranscriptViewer transcript={call.transcript} />
      </div>

      <div>
        <p className="label-mono mb-1">Recording</p>
        {call.recording_url ? (
          <audio controls src={call.recording_url} className="w-full h-8" preload="none">
            Your browser does not support the audio element.
          </audio>
        ) : (
          <p className="text-xs text-zinc-600 italic">No recording available</p>
        )}
      </div>
    </div>
  );
}

export default function LeadSidePanel({ leadId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLead = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/lead/" + leadId);
      setData(res);
    } catch (err) {
      setError(err.message || "Failed to load lead details");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { fetchLead(); }, [fetchLead]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const lead = data?.lead;
  const calls = data?.calls || [];
  const sortedCalls = sortCallsDesc(calls);

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-surface border-l border-glass-border shadow-2xl z-50 overflow-y-auto"
           style={{ backdropFilter: "blur(12px)" }}>
        {/* Header */}
        <div className="sticky top-0 bg-surface/90 border-b border-glass-border px-5 py-4 z-10"
             style={{ backdropFilter: "blur(12px)" }}>
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-zinc-50 truncate">
                {loading ? "Loading..." : lead?.name || "Unknown"}
              </h2>
              {lead && (
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-sm text-zinc-500 font-mono">{maskPhone(lead.phone)}</span>
                  <OutcomeBadge outcome={lead.outcome || lead.status} />
                </div>
              )}
              {lead?.email && (
                <p className="text-sm text-zinc-500 mt-0.5">{lead.email}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-4 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-glass-fill focus:outline-none transition-colors"
              aria-label="Close panel"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-700 border-t-orange-500" />
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-red-400">{error}</p>
              <button onClick={fetchLead} className="text-sm text-orange-500 hover:text-orange-400 font-mono focus:outline-none">
                Retry
              </button>
            </div>
          )}

          {lead && !loading && !error && (
            <>
              <section className="space-y-2">
                <h3 className="label-mono text-zinc-400">Lead Details</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {lead.location && (
                    <>
                      <dt className="text-zinc-500">Location</dt>
                      <dd className="text-zinc-200">{lead.location}</dd>
                    </>
                  )}
                  {lead.country && (
                    <>
                      <dt className="text-zinc-500">Country</dt>
                      <dd className="text-zinc-200">{lead.country}</dd>
                    </>
                  )}
                  {lead.programme_recommended && (
                    <>
                      <dt className="text-zinc-500">Programme</dt>
                      <dd className="text-zinc-200">{lead.programme_recommended}</dd>
                    </>
                  )}
                  {lead.outcome && (
                    <>
                      <dt className="text-zinc-500">Outcome</dt>
                      <dd><OutcomeBadge outcome={lead.outcome} /></dd>
                    </>
                  )}
                  {lead.priority != null && (
                    <>
                      <dt className="text-zinc-500">Priority</dt>
                      <dd className="text-zinc-200">{lead.priority}</dd>
                    </>
                  )}
                  {lead.retry_count != null && (
                    <>
                      <dt className="text-zinc-500">Retries</dt>
                      <dd className="text-zinc-200">{lead.retry_count}</dd>
                    </>
                  )}
                  {lead.source && (
                    <>
                      <dt className="text-zinc-500">Source</dt>
                      <dd className="text-zinc-200">{lead.source}</dd>
                    </>
                  )}
                </dl>
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="label-mono text-zinc-400">Call History</h3>
                  <span className="inline-flex items-center justify-center bg-white/[0.06] border border-glass-border rounded-full px-2 text-xs font-mono text-zinc-400">
                    {sortedCalls.length}
                  </span>
                </div>

                {sortedCalls.length === 0 ? (
                  <p className="text-sm text-zinc-600 italic">No call records yet</p>
                ) : (
                  <div className="space-y-3">
                    {sortedCalls.map((call) => (
                      <CallRecord key={call.id} call={call} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
