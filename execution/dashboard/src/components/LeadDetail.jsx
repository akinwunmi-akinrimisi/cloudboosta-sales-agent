import { useState, useEffect, useCallback } from "react";
import { legacyFetch as apiFetch } from "../api";
import {
  maskPhone,
  formatDuration,
  formatRelativeTime,
  formatDateTime,
  STATUS_COLORS,
} from "../constants";
import OutcomeBadge from "./OutcomeBadge";
import CallTimeline from "./CallTimeline";
import QuickActions from "./QuickActions";

function InfoRow({ icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-zinc-500">
      {icon}
      {children}
    </span>
  );
}

function DetailRow({ label, children }) {
  if (!children && children !== 0) return null;
  return (
    <>
      <dt className="text-xs text-zinc-500 font-mono">{label}</dt>
      <dd className="text-sm text-zinc-200">{children}</dd>
    </>
  );
}

export default function LeadDetail({ leadId, onBack, onNavigateToLead }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/lead/${leadId}`);
      setData(res);
    } catch (err) {
      setError(err.message || "Failed to load lead");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-zinc-700 border-t-orange-500" />
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-sm text-red-400">{error}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchData}
            className="text-sm text-orange-500 hover:text-orange-400 font-mono transition-colors focus:outline-none"
          >
            Retry
          </button>
          <span className="text-zinc-700">·</span>
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-zinc-500 hover:text-zinc-300 font-mono transition-colors focus:outline-none"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const lead = data?.lead ?? {};
  const calls = data?.calls ?? [];
  const stats = data?.call_stats ?? {};

  const statusColor =
    STATUS_COLORS[lead.status] ??
    "bg-zinc-500/15 border-zinc-500/30 text-zinc-400";

  /* Webinars as array */
  const webinars = Array.isArray(lead.webinars_invited)
    ? lead.webinars_invited
    : lead.webinars_invited
    ? [lead.webinars_invited]
    : [];

  /* Objections */
  const objections = Array.isArray(stats.objections_seen)
    ? stats.objections_seen
    : [];

  /* Strategies seen from calls */
  const strategiesSeen = [
    ...new Set(
      calls
        .map((c) => c.closing_strategy_used)
        .filter(Boolean)
    ),
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="space-y-3">
        <div className="flex items-start gap-3 flex-wrap">
          {/* Back */}
          <button
            type="button"
            onClick={onBack}
            className="flex-shrink-0 inline-flex items-center gap-1.5 mt-0.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          {/* Name */}
          <h1 className="text-2xl font-bold text-zinc-50 leading-tight">
            {lead.name || "Unknown Lead"}
          </h1>

          {/* Outcome + status */}
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            {lead.outcome && <OutcomeBadge outcome={lead.outcome} />}
            {lead.status && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[11px] font-medium border ${statusColor}`}
              >
                {lead.status.replace(/_/g, " ")}
              </span>
            )}
          </div>
        </div>

        {/* Info line */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {lead.phone && (
            <InfoRow
              icon={
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              }
            >
              <span className="font-mono">{maskPhone(lead.phone)}</span>
            </InfoRow>
          )}
          {lead.email && (
            <InfoRow
              icon={
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
            >
              {lead.email}
            </InfoRow>
          )}
          {(lead.location || lead.country) && (
            <InfoRow
              icon={
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            >
              {[lead.location, lead.country].filter(Boolean).join(", ")}
            </InfoRow>
          )}
          {lead.source && (
            <InfoRow
              icon={
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              }
            >
              {lead.source}
            </InfoRow>
          )}
        </div>
      </div>

      {/* ── Two-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left — Profile */}
        <div className="glass-card p-5 space-y-4">
          <p className="label-mono">Profile</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 items-start">
            {lead.detected_persona && (
              <>
                <dt className="text-xs text-zinc-500 font-mono pt-0.5">Persona</dt>
                <dd>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-blue-500/15 border border-blue-500/30 text-blue-400">
                    {lead.detected_persona}
                  </span>
                </dd>
              </>
            )}
            <DetailRow label="Programme">{lead.programme_recommended}</DetailRow>
            <DetailRow label="Motivation">{lead.motivation}</DetailRow>
            <DetailRow label="Current Role">{lead.current_role}</DetailRow>
            <DetailRow label="Experience">{lead.experience_level}</DetailRow>
            <DetailRow label="Country">{lead.country}</DetailRow>
            <DetailRow label="Currency">{lead.currency}</DetailRow>
            <DetailRow label="Priority">{lead.priority != null ? lead.priority : null}</DetailRow>
            {lead.notes && (
              <>
                <dt className="text-xs text-zinc-500 font-mono">Notes</dt>
                <dd className="text-sm text-zinc-300 leading-relaxed">{lead.notes}</dd>
              </>
            )}
          </dl>
        </div>

        {/* Right — Call Intelligence */}
        <div className="glass-card p-5 space-y-4">
          <p className="label-mono">Call Intelligence</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 items-start">
            <DetailRow label="Total Calls">{stats.total_calls ?? calls.length}</DetailRow>
            <DetailRow label="Total Talk Time">
              {formatDuration(stats.total_duration_seconds)}
            </DetailRow>
            <DetailRow label="Last Called">
              {lead.last_called_at ? formatRelativeTime(lead.last_called_at) : null}
            </DetailRow>

            {/* Next call */}
            {lead.next_call_at && (
              <>
                <dt className="text-xs text-zinc-500 font-mono">Next Call</dt>
                <dd className="text-sm text-zinc-200">
                  {formatDateTime(lead.next_call_at)}
                  {lead.call_type && (
                    <span className="ml-2 text-xs text-zinc-500 font-mono">
                      {lead.call_type}
                    </span>
                  )}
                </dd>
              </>
            )}

            {/* Retries */}
            {lead.retry_count != null && lead.max_retries != null && (
              <>
                <dt className="text-xs text-zinc-500 font-mono">Retries</dt>
                <dd className="text-sm text-zinc-200 font-mono">
                  {lead.retry_count}/{lead.max_retries}
                </dd>
              </>
            )}

            {/* Last strategy */}
            {lead.last_strategy_used && (
              <>
                <dt className="text-xs text-zinc-500 font-mono pt-0.5">Last Strategy</dt>
                <dd>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-violet-500/15 border border-violet-500/30 text-violet-400">
                    {lead.last_strategy_used.replace(/_/g, " ")}
                  </span>
                </dd>
              </>
            )}

            <DetailRow label="Follow-up">
              {lead.follow_up_date ? formatDateTime(lead.follow_up_date) : null}
            </DetailRow>

            {/* Webinars */}
            {webinars.length > 0 && (
              <>
                <dt className="text-xs text-zinc-500 font-mono pt-0.5">Webinars Invited</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {webinars.map((w, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-orange-500/15 border border-orange-500/30 text-orange-400"
                    >
                      {w}
                    </span>
                  ))}
                </dd>
              </>
            )}

            {/* Strategies seen */}
            {strategiesSeen.length > 0 && (
              <>
                <dt className="text-xs text-zinc-500 font-mono pt-0.5">Strategies</dt>
                <dd className="flex flex-wrap gap-1">
                  {strategiesSeen.map((s, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-red-500/10 border border-red-500/20 text-red-400"
                    >
                      {s.replace(/_/g, " ")}
                    </span>
                  ))}
                </dd>
              </>
            )}

            {/* Objections seen */}
            {objections.length > 0 && (
              <>
                <dt className="text-xs text-zinc-500 font-mono pt-0.5">Objections</dt>
                <dd className="flex flex-wrap gap-1">
                  {objections.map((o, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-red-500/10 border border-red-500/20 text-red-400"
                    >
                      {String(o).replace(/_/g, " ")}
                    </span>
                  ))}
                </dd>
              </>
            )}
          </dl>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <QuickActions
        leadId={leadId}
        leadStatus={lead.status}
        onRefresh={fetchData}
      />

      {/* ── Call History Timeline ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <p className="label-mono">Call History</p>
          <span className="inline-flex items-center justify-center bg-white/[0.06] border border-glass-border rounded-full px-2 text-xs font-mono text-zinc-400">
            {calls.length}
          </span>
        </div>
        <CallTimeline calls={calls} />
      </div>
    </div>
  );
}
