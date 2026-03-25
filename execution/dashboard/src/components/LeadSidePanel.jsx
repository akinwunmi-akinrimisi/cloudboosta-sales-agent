/**
 * LeadSidePanel — Slide-in detail panel with call history.
 *
 * Fetches full lead details and call history from /api/dashboard/lead/{id}.
 * Shows lead info, call timeline with expandable transcripts, and HTML5
 * audio player for recordings.  Closes on overlay click or Escape key.
 */

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../api";
import { maskPhone, formatDuration, formatTime } from "../constants";
import OutcomeBadge from "./OutcomeBadge";

/** Sort calls descending by started_at. */
function sortCallsDesc(calls) {
  return [...calls].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  );
}

/** Format ISO timestamp as a short date + time string. */
function formatDateTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + formatTime(iso);
  } catch {
    return "";
  }
}

/** Expandable transcript viewer. Shows first 200 chars with toggle. */
function TranscriptViewer({ transcript }) {
  const [expanded, setExpanded] = useState(false);

  if (!transcript) {
    return (
      <p className="text-xs text-gray-400 dark:text-gray-500 italic">
        No transcript available
      </p>
    );
  }

  const isLong = transcript.length > 200;
  const displayText = expanded || !isLong ? transcript : transcript.slice(0, 200) + "...";

  return (
    <div>
      <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap bg-gray-50 dark:bg-gray-800/50 rounded p-2 max-h-64 overflow-y-auto">
        {displayText}
      </pre>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline focus:outline-none"
        >
          {expanded ? "Show less" : "Show full transcript"}
        </button>
      )}
    </div>
  );
}

/** Single call record card with transcript and recording player. */
function CallRecord({ call }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
      {/* Header row: date/time + duration + outcome */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {formatDateTime(call.started_at)}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatDuration(call.duration_seconds)}
          </span>
        </div>
        <OutcomeBadge outcome={call.outcome} />
      </div>

      {/* Strategy + persona */}
      {(call.closing_strategy_used || call.detected_persona) && (
        <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
          {call.closing_strategy_used && (
            <span>
              Strategy: <span className="font-medium text-gray-700 dark:text-gray-300">{call.closing_strategy_used.replace(/_/g, " ")}</span>
            </span>
          )}
          {call.detected_persona && (
            <span>
              Persona: <span className="font-medium text-gray-700 dark:text-gray-300">{call.detected_persona}</span>
            </span>
          )}
        </div>
      )}

      {/* Summary */}
      {call.summary && (
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          {call.summary}
        </p>
      )}

      {/* Transcript */}
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Transcript</p>
        <TranscriptViewer transcript={call.transcript} />
      </div>

      {/* Recording player */}
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Recording</p>
        {call.recording_url ? (
          <audio controls src={call.recording_url} className="w-full h-8" preload="none">
            Your browser does not support the audio element.
          </audio>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">
            No recording available
          </p>
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

  // Fetch on mount and when leadId changes.
  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  // Close on Escape key.
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        onClose();
      }
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
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white dark:bg-gray-900 shadow-xl z-50 transform translate-x-0 transition-transform duration-300 overflow-y-auto">
        {/* Sticky header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-5 py-4 z-10">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                {loading ? "Loading..." : lead?.name || "Unknown"}
              </h2>
              {lead && (
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {maskPhone(lead.phone)}
                  </span>
                  <OutcomeBadge outcome={lead.outcome || lead.status} />
                </div>
              )}
              {lead?.email && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {lead.email}
                </p>
              )}
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="ml-4 p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
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
          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <button
                type="button"
                onClick={fetchLead}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline focus:outline-none"
              >
                Retry
              </button>
            </div>
          )}

          {/* Lead detail section */}
          {lead && !loading && !error && (
            <>
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Lead Details
                </h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {lead.location && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Location</dt>
                      <dd className="text-gray-900 dark:text-gray-100">{lead.location}</dd>
                    </>
                  )}
                  {lead.country && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Country</dt>
                      <dd className="text-gray-900 dark:text-gray-100">{lead.country}</dd>
                    </>
                  )}
                  {lead.programme_recommended && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Programme</dt>
                      <dd className="text-gray-900 dark:text-gray-100">{lead.programme_recommended}</dd>
                    </>
                  )}
                  {lead.outcome && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Outcome</dt>
                      <dd><OutcomeBadge outcome={lead.outcome} /></dd>
                    </>
                  )}
                  {lead.priority != null && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Priority</dt>
                      <dd className="text-gray-900 dark:text-gray-100">{lead.priority}</dd>
                    </>
                  )}
                  {lead.retry_count != null && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Retries</dt>
                      <dd className="text-gray-900 dark:text-gray-100">{lead.retry_count}</dd>
                    </>
                  )}
                  {lead.source && (
                    <>
                      <dt className="text-gray-500 dark:text-gray-400">Source</dt>
                      <dd className="text-gray-900 dark:text-gray-100">{lead.source}</dd>
                    </>
                  )}
                </dl>
              </section>

              {/* Call history section */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Call History
                  </h3>
                  <span className="inline-flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full px-2 text-xs font-medium">
                    {sortedCalls.length}
                  </span>
                </div>

                {sortedCalls.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                    No call records yet
                  </p>
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
