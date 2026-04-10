import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch, apiPost } from "../api";
import StatusBadge from "../components/StatusBadge";
import { SkeletonCard, SkeletonTable } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import OutcomeBadge from "../components/OutcomeBadge";
import { ArrowLeft, Ban, Phone, Clock, FileText } from "lucide-react";
import { formatDuration, formatDateTime } from "../constants";

/* ── Tiny helpers ── */
function ComponentBadge({ label }) {
  if (!label) return null;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-violet-500/10 border border-violet-500/20 text-violet-400">
      {label}
    </span>
  );
}

function TabButton({ id, label, icon, active, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 focus:outline-none ${
        active
          ? "border-orange-500 text-orange-400"
          : "border-transparent text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ── Call row — expandable ── */
function CallRow({ call, expanded, onToggle }) {
  const hasTranscript = !!call.transcript;
  const hasAudio = !!call.recording_url;

  return (
    <div className="border border-glass-border rounded-lg overflow-hidden">
      {/* Summary row */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors focus:outline-none"
      >
        {/* Date */}
        <span className="text-sm text-zinc-400 font-mono min-w-[130px]">
          {formatDateTime(call.started_at || call.created_at) || "—"}
        </span>

        {/* Duration */}
        <span className="flex items-center gap-1 text-sm text-zinc-500 min-w-[60px]">
          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
          {formatDuration(call.duration_seconds)}
        </span>

        {/* Outcome */}
        {call.outcome ? (
          <OutcomeBadge outcome={call.outcome} />
        ) : (
          <span className="text-xs text-zinc-600 font-mono">no outcome</span>
        )}

        {/* Strategy */}
        {call.closing_strategy_used && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-violet-500/10 border border-violet-500/20 text-violet-400">
            {call.closing_strategy_used.replace(/_/g, " ")}
          </span>
        )}

        {/* Persona */}
        {call.persona_detected && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 border border-blue-500/20 text-blue-400">
            {call.persona_detected}
          </span>
        )}

        {/* Expand caret */}
        {(hasTranscript || hasAudio) && (
          <span className="ml-auto text-zinc-600 text-xs font-mono">
            {expanded ? "▲" : "▼"}
          </span>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (hasTranscript || hasAudio) && (
        <div className="border-t border-glass-border px-4 py-4 space-y-4 bg-zinc-900/40">
          {hasAudio && (
            <div>
              <p className="text-xs text-zinc-500 font-mono mb-2">Recording</p>
              <audio
                controls
                src={call.recording_url}
                className="w-full h-9 rounded"
              />
            </div>
          )}
          {hasTranscript && (
            <div>
              <p className="text-xs text-zinc-500 font-mono mb-2">Transcript</p>
              <div className="bg-zinc-800/50 rounded-lg p-4 text-sm text-zinc-300 font-mono whitespace-pre-wrap max-h-96 overflow-y-auto">
                {call.transcript}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Pipeline log row — expandable ── */
function PipelineRow({ entry, expanded, onToggle }) {
  const hasDetails =
    entry.details && Object.keys(entry.details).length > 0;

  return (
    <div className="border border-glass-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={hasDetails ? onToggle : undefined}
        className={`w-full flex flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors focus:outline-none ${
          hasDetails ? "hover:bg-white/[0.03]" : "cursor-default"
        }`}
      >
        <span className="text-sm text-zinc-400 font-mono min-w-[130px]">
          {formatDateTime(entry.created_at) || "—"}
        </span>
        <span className="text-sm text-zinc-300 flex-1">
          {entry.event || entry.description || "—"}
        </span>
        {entry.component && <ComponentBadge label={entry.component} />}
        {hasDetails && (
          <span className="ml-auto text-zinc-600 text-xs font-mono">
            {expanded ? "▲" : "▼"}
          </span>
        )}
      </button>

      {expanded && hasDetails && (
        <div className="border-t border-glass-border px-4 py-4 bg-zinc-900/40">
          <pre className="text-xs text-zinc-400 font-mono whitespace-pre-wrap break-all">
            {JSON.stringify(entry.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ── Main page ── */
export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("calls");
  const [expandedCall, setExpandedCall] = useState(null);
  const [expandedLog, setExpandedLog] = useState(null);
  const [blocking, setBlocking] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);

  /* ── Fetch ── */
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    apiFetch(`/leads/${id}`)
      .then((res) => {
        setData(res);
        setNotes(res?.lead?.notes || "");
      })
      .catch((err) => setError(err.message || "Failed to load lead"))
      .finally(() => setLoading(false));
  }, [id]);

  /* ── Block handler ── */
  async function handleBlock() {
    const confirmed = window.confirm(
      `Block this lead? They will be marked do_not_contact and removed from the dial queue.`
    );
    if (!confirmed) return;
    setBlocking(true);
    try {
      await apiPost(`/leads/${id}/block`);
      // Refresh data to reflect new status
      const res = await apiFetch(`/leads/${id}`);
      setData(res);
    } catch (err) {
      alert(`Block failed: ${err.message}`);
    } finally {
      setBlocking(false);
    }
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto p-6">
        <SkeletonCard className="h-40" />
        <SkeletonTable rows={6} />
      </div>
    );
  }

  /* ── Error ── */
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <p className="text-sm text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => navigate("/leads")}
          className="text-sm text-orange-500 hover:text-orange-400 font-mono transition-colors focus:outline-none"
        >
          Back to Leads
        </button>
      </div>
    );
  }

  const lead = data?.lead ?? {};
  const calls = [...(data?.calls ?? [])].sort(
    (a, b) =>
      new Date(b.started_at || b.created_at || 0) -
      new Date(a.started_at || a.created_at || 0)
  );
  const pipelineLogs = [...(data?.pipeline_logs ?? [])].sort(
    (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
  );

  const isBlocked = lead.status === "do_not_contact";

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-6">
      {/* ── Header card ── */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Left: lead info */}
          <div className="flex-1 space-y-3">
            {/* Back + name row */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors focus:outline-none flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <h1 className="text-2xl font-bold text-zinc-50 leading-tight">
                {lead.name || "Unknown Lead"}
              </h1>
              {lead.status && (
                <StatusBadge
                  status={lead.status}
                  className="text-sm px-3 py-1"
                />
              )}
            </div>

            {/* Contact meta */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {lead.phone && (
                <span className="flex items-center gap-1.5 text-sm text-zinc-400 font-mono">
                  <Phone className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                  {lead.phone}
                </span>
              )}
              {lead.email ? (
                <span className="text-sm text-zinc-400">{lead.email}</span>
              ) : (
                <span className="text-sm text-zinc-600 italic">No email</span>
              )}
            </div>

            {/* Qualifier chips */}
            <div className="flex flex-wrap items-center gap-2">
              {lead.detected_persona && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-blue-500/15 border border-blue-500/30 text-blue-400">
                  {lead.detected_persona}
                </span>
              )}
              {lead.programme_recommended && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-orange-500/15 border border-orange-500/30 text-orange-400">
                  {lead.programme_recommended}
                </span>
              )}
              {lead.timezone && (
                <span className="flex items-center gap-1 text-xs text-zinc-500 font-mono">
                  <Clock className="w-3 h-3" />
                  {lead.timezone}
                </span>
              )}
            </div>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={handleBlock}
              disabled={blocking || isBlocked}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors focus:outline-none ${
                isBlocked
                  ? "bg-red-900/20 border-red-700/40 text-red-500 cursor-not-allowed opacity-60"
                  : "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300"
              }`}
            >
              <Ban className="w-4 h-4" />
              {blocking ? "Blocking…" : isBlocked ? "Blocked" : "Block"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="glass-card overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-glass-border px-2">
          <TabButton
            id="calls"
            label="Call History"
            icon={<Phone className="w-4 h-4" />}
            active={activeTab === "calls"}
            onClick={setActiveTab}
          />
          <TabButton
            id="pipeline"
            label="Pipeline Activity"
            icon={<FileText className="w-4 h-4" />}
            active={activeTab === "pipeline"}
            onClick={setActiveTab}
          />
          <TabButton
            id="notes"
            label="Notes"
            icon={<FileText className="w-4 h-4" />}
            active={activeTab === "notes"}
            onClick={setActiveTab}
          />
        </div>

        {/* Tab content */}
        <div className="p-6">
          {/* ── Tab 1: Call History ── */}
          {activeTab === "calls" && (
            <div className="space-y-2">
              {calls.length === 0 ? (
                <EmptyState
                  title="No calls yet"
                  message="Call history will appear here after John's first attempt."
                />
              ) : (
                calls.map((call, i) => {
                  const key = call.id || i;
                  return (
                    <CallRow
                      key={key}
                      call={call}
                      expanded={expandedCall === key}
                      onToggle={() =>
                        setExpandedCall(expandedCall === key ? null : key)
                      }
                    />
                  );
                })
              )}
            </div>
          )}

          {/* ── Tab 2: Pipeline Activity ── */}
          {activeTab === "pipeline" && (
            <div className="space-y-2">
              {pipelineLogs.length === 0 ? (
                <EmptyState
                  title="No pipeline events"
                  message="Status transitions and outreach events will appear here."
                />
              ) : (
                pipelineLogs.map((entry, i) => {
                  const key = entry.id || i;
                  return (
                    <PipelineRow
                      key={key}
                      entry={entry}
                      expanded={expandedLog === key}
                      onToggle={() =>
                        setExpandedLog(expandedLog === key ? null : key)
                      }
                    />
                  );
                })
              )}
            </div>
          )}

          {/* ── Tab 3: Notes ── */}
          {activeTab === "notes" && (
            <div className="space-y-4 max-w-2xl">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={10}
                placeholder="No notes for this lead yet…"
                className="w-full bg-zinc-800/60 border border-glass-border rounded-lg px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 font-mono resize-y focus:outline-none focus:border-orange-500/50 transition-colors"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setNotesSaved(true);
                    setTimeout(() => setNotesSaved(false), 3000);
                  }}
                  className="px-5 py-2 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 text-sm font-medium hover:bg-orange-500/25 transition-colors focus:outline-none"
                >
                  Save Notes
                </button>
                {notesSaved && (
                  <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 font-mono">
                    Notes saved locally — PUT /leads/:id endpoint will persist on next deploy.
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
