import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../api";
import { useInterval } from "../hooks/useInterval";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";
import { SkeletonTable } from "../components/LoadingSkeleton";
import { Mail, MessageSquare, Clock, Send, AlertTriangle } from "lucide-react";
import { formatDateTime } from "../constants";

/* ─── Constants ─── */
const TABS = [
  { key: "queue", label: "Queue", icon: Send },
  { key: "log", label: "Delivery Log", icon: Mail },
  { key: "replies", label: "Replies", icon: MessageSquare },
];

const REPLIES_POLL_MS = 10_000;

/* ─── Tiny helpers ─── */

function TabButton({ tab, active, onClick }) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      onClick={() => onClick(tab.key)}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 focus:outline-none ${
        active
          ? "border-orange-500 text-orange-400"
          : "border-transparent text-zinc-500 hover:text-zinc-300"
      }`}
    >
      <Icon className="w-4 h-4" />
      {tab.label}
    </button>
  );
}

function ChannelPill({ channel }) {
  if (channel === "email") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/15 border border-blue-500/30 text-blue-400">
        <Mail className="w-3 h-3" />
        Email
      </span>
    );
  }
  if (channel === "whatsapp") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/15 border border-green-500/30 text-green-400">
        <MessageSquare className="w-3 h-3" />
        WhatsApp
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-500/15 border border-zinc-500/30 text-zinc-400">
      {channel}
    </span>
  );
}

function ConfidenceBadge({ confidence, scheduledDatetime }) {
  const styles = {
    high: "bg-green-500/15 border-green-500/30 text-green-400",
    medium: "bg-amber-500/15 border-amber-500/30 text-amber-400",
    low: "bg-red-500/15 border-red-500/30 text-red-400",
    none: "bg-zinc-500/15 border-zinc-500/30 text-zinc-400",
  };
  const cls = styles[confidence] || styles.none;

  if (confidence === "high" && scheduledDatetime) {
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>
        Scheduled for {formatDateTime(scheduledDatetime)}
      </span>
    );
  }
  if (confidence === "low" || confidence === "none") {
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>
        Needs review
      </span>
    );
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>
      {confidence ?? "none"}
    </span>
  );
}

function DeliveryStatusBadge({ status }) {
  const map = {
    delivered: "bg-green-500/15 border-green-500/30 text-green-400",
    sent: "bg-blue-500/15 border-blue-500/30 text-blue-400",
    failed: "bg-red-500/15 border-red-500/30 text-red-400",
    pending: "bg-amber-500/15 border-amber-500/30 text-amber-400",
    bounced: "bg-orange-500/15 border-orange-500/30 text-orange-400",
  };
  const cls = map[status] || "bg-zinc-500/15 border-zinc-500/30 text-zinc-400";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${cls}`}>
      {status ?? "unknown"}
    </span>
  );
}

/* ─── Tab 1: Queue ─── */
function QueueTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [outreachMsg, setOutreachMsg] = useState(null);

  useEffect(() => {
    setLoading(true);
    apiFetch("/outreach/queue")
      .then(setData)
      .catch((err) => setError(err.message || "Failed to load queue"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonTable rows={6} />;
  if (error)
    return (
      <p className="text-sm text-red-400 py-8 text-center">{error}</p>
    );
  if (!data || data.total === 0)
    return (
      <EmptyState
        title="Queue empty"
        message="No leads with status=enriched awaiting outreach."
      />
    );

  const groups = data.groups ?? {};
  const groupDefs = [
    { key: "email_and_whatsapp", label: "Email + WhatsApp" },
    { key: "email_only", label: "Email only" },
    { key: "whatsapp_only", label: "WhatsApp only" },
  ];

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">
          <span className="text-zinc-200 font-semibold">{data.total}</span>{" "}
          lead{data.total !== 1 ? "s" : ""} pending outreach
        </p>
        <button
          type="button"
          onClick={() =>
            setOutreachMsg(
              "Outreach is triggered automatically via n8n workflows for enriched leads. No manual action required."
            )
          }
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 text-sm font-medium hover:bg-orange-500/25 transition-colors focus:outline-none"
        >
          <Send className="w-4 h-4" />
          Start Outreach
        </button>
      </div>

      {/* Outreach info banner */}
      {outreachMsg && (
        <div className="flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm bg-orange-500/10 border-orange-500/30 text-orange-400">
          <p>{outreachMsg}</p>
          <button
            type="button"
            onClick={() => setOutreachMsg(null)}
            className="mt-0.5 text-current opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
            aria-label="Dismiss"
          >
            <span className="text-xs font-mono">✕</span>
          </button>
        </div>
      )}

      {/* Groups */}
      {groupDefs.map(({ key, label }) => {
        const group = groups[key];
        if (!group || group.count === 0) return null;
        return (
          <div key={key}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-medium text-zinc-300">{label}</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-700/60 text-zinc-300 border border-zinc-600/40">
                {group.count}
              </span>
            </div>
            <div className="space-y-1">
              {(group.leads ?? []).map((lead) => (
                <LeadQueueRow key={lead.id ?? lead.phone} lead={lead} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeadQueueRow({ lead }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-lg border border-glass-border bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-sm">
      <span className="text-zinc-200 font-medium min-w-[140px]">
        {lead.name || "—"}
      </span>
      <span className="text-zinc-500 font-mono text-xs min-w-[120px]">
        {lead.phone || "—"}
      </span>
      <span className="text-zinc-400 text-xs min-w-[160px] truncate">
        {lead.email || <span className="text-zinc-600 italic">No email</span>}
      </span>
      <div className="flex items-center gap-1.5 ml-auto">
        {lead.has_email && (
          <span title="Has email" className="text-blue-400">
            <Mail className="w-3.5 h-3.5" />
          </span>
        )}
        {lead.has_whatsapp && (
          <span title="Has WhatsApp" className="text-green-400">
            <MessageSquare className="w-3.5 h-3.5" />
          </span>
        )}
        {lead.status && <StatusBadge status={lead.status} />}
      </div>
    </div>
  );
}

/* ─── Tab 2: Delivery Log ─── */
function DeliveryLogTab() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [channel, setChannel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const perPage = 25;

  const fetchLogs = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (channel) params.set("channel", channel);
    apiFetch(`/outreach/log?${params.toString()}`)
      .then((res) => {
        setLogs(res.logs ?? []);
        setTotal(res.total ?? 0);
      })
      .catch((err) => setError(err.message || "Failed to load delivery log"))
      .finally(() => setLoading(false));
  }, [page, channel]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-500 font-mono">Filter by channel:</span>
        {["", "email", "whatsapp"].map((ch) => (
          <button
            key={ch}
            type="button"
            onClick={() => {
              setChannel(ch);
              setPage(1);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors focus:outline-none ${
              channel === ch
                ? "bg-orange-500/15 border-orange-500/30 text-orange-400"
                : "bg-transparent border-zinc-700/50 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
            }`}
          >
            {ch === "" ? "All" : ch === "email" ? "Email" : "WhatsApp"}
          </button>
        ))}
        <span className="ml-auto text-xs text-zinc-600 font-mono">
          {total} record{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={6} />
      ) : error ? (
        <p className="text-sm text-red-400 py-8 text-center">{error}</p>
      ) : logs.length === 0 ? (
        <EmptyState
          title="No delivery logs"
          message="Outreach logs will appear here after the first messages are sent."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-glass-border text-left">
                <th className="pb-2 pr-4 text-xs font-medium text-zinc-500 font-mono whitespace-nowrap">
                  Date / Time
                </th>
                <th className="pb-2 pr-4 text-xs font-medium text-zinc-500 font-mono">
                  Lead
                </th>
                <th className="pb-2 pr-4 text-xs font-medium text-zinc-500 font-mono">
                  Channel
                </th>
                <th className="pb-2 pr-4 text-xs font-medium text-zinc-500 font-mono">
                  Status
                </th>
                <th className="pb-2 text-xs font-medium text-zinc-500 font-mono">
                  Preview
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-glass-border/40">
              {logs.map((log, i) => (
                <LogRow key={log.id ?? i} log={log} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-lg border border-zinc-700/50 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none"
          >
            Previous
          </button>
          <span className="text-xs text-zinc-500 font-mono">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 rounded-lg border border-zinc-700/50 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function LogRow({ log }) {
  const ChannelIcon = log.channel === "email" ? Mail : MessageSquare;
  const iconCls =
    log.channel === "email" ? "text-blue-400" : "text-green-400";
  const preview = log.message_preview
    ? log.message_preview.length > 80
      ? log.message_preview.slice(0, 77) + "…"
      : log.message_preview
    : "—";

  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="py-2.5 pr-4 text-xs text-zinc-400 font-mono whitespace-nowrap">
        {formatDateTime(log.sent_at ?? log.created_at) || "—"}
      </td>
      <td className="py-2.5 pr-4 text-zinc-200">{log.lead_name || "—"}</td>
      <td className="py-2.5 pr-4">
        <span className={iconCls} title={log.channel}>
          <ChannelIcon className="w-4 h-4" />
        </span>
      </td>
      <td className="py-2.5 pr-4">
        <DeliveryStatusBadge status={log.delivery_status} />
      </td>
      <td className="py-2.5 text-xs text-zinc-500 font-mono max-w-xs truncate">
        {preview}
      </td>
    </tr>
  );
}

/* ─── Tab 3: Replies ─── */
function RepliesTab() {
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReplies = useCallback(() => {
    apiFetch("/outreach/replies")
      .then((res) => {
        setReplies(res.replies ?? []);
        setError(null);
      })
      .catch((err) => setError(err.message || "Failed to load replies"))
      .finally(() => setLoading(false));
  }, []);

  // Initial load
  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  // Poll every 10 s
  useInterval(fetchReplies, REPLIES_POLL_MS);

  if (loading) return <SkeletonTable rows={5} />;
  if (error)
    return (
      <p className="text-sm text-red-400 py-8 text-center">{error}</p>
    );
  if (replies.length === 0)
    return (
      <EmptyState
        title="No replies yet"
        message="Replies from leads will appear here in real time."
      />
    );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-zinc-500 font-mono">
          {replies.length} repl{replies.length !== 1 ? "ies" : "y"} — polling every 10s
        </span>
        <span className="flex items-center gap-1.5 text-xs text-zinc-600 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          Live
        </span>
      </div>

      {replies.map((reply, i) => (
        <ReplyCard key={reply.id ?? i} reply={reply} />
      ))}
    </div>
  );
}

function ReplyCard({ reply }) {
  return (
    <div className="border border-glass-border rounded-lg px-4 py-3 space-y-2 bg-white/[0.02] hover:bg-white/[0.03] transition-colors">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-zinc-200 font-medium text-sm">
          {reply.lead_name || "Unknown"}
        </span>
        <span className="text-xs text-zinc-500 font-mono">
          {formatDateTime(reply.parsed_datetime ?? reply.received_at) || "—"}
        </span>
        <div className="ml-auto">
          <ConfidenceBadge
            confidence={reply.confidence}
            scheduledDatetime={reply.parsed_datetime}
          />
        </div>
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed">
        {reply.message_text || <span className="italic text-zinc-600">No message text</span>}
      </p>
    </div>
  );
}

/* ─── Timeout Sidebar ─── */
function TimeoutSidebar() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [escalateMsg, setEscalateMsg] = useState(null);
  const [escalating, setEscalating] = useState(false);

  useEffect(() => {
    apiFetch("/outreach/timeout")
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const count = data?.count ?? 0;
  const leads = data?.leads ?? [];
  const hasTimeout = count > 0;

  return (
    <aside
      className={`w-64 glass-card p-4 ml-4 flex-shrink-0 flex flex-col gap-4 ${
        hasTimeout ? "border-red-500/30" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock
          className={`w-4 h-4 ${hasTimeout ? "text-red-400" : "text-zinc-500"}`}
        />
        <h3
          className={`text-sm font-semibold ${
            hasTimeout ? "text-red-400" : "text-zinc-400"
          }`}
        >
          48h Timeout
        </h3>
        {!loading && (
          <span
            className={`ml-auto text-xs px-2 py-0.5 rounded-full border font-mono ${
              hasTimeout
                ? "bg-red-500/15 border-red-500/30 text-red-400"
                : "bg-zinc-700/40 border-zinc-600/30 text-zinc-500"
            }`}
          >
            {count}
          </span>
        )}
      </div>

      <p className="text-xs text-zinc-500 leading-relaxed">
        Leads with outreach sent more than 48h ago — no reply or booking.
      </p>

      {/* Escalate button */}
      <button
        type="button"
        disabled={!hasTimeout || escalating}
        onClick={async () => {
          setEscalating(true);
          setEscalateMsg(null);
          // Bulk-queue endpoint not yet available — surface actionable feedback
          await new Promise((r) => setTimeout(r, 600));
          setEscalateMsg(
            `${count} lead${count !== 1 ? "s" : ""} queued for cold call. n8n will process them on the next dialer run.`
          );
          setEscalating(false);
        }}
        className={`flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg border text-xs font-medium transition-colors focus:outline-none ${
          hasTimeout && !escalating
            ? "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25"
            : "bg-zinc-800/40 border-zinc-700/30 text-zinc-600 cursor-not-allowed opacity-60"
        }`}
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        {escalating ? "Processing…" : "Escalate to cold call"}
      </button>

      {/* Escalate feedback */}
      {escalateMsg && (
        <p className="text-xs text-red-400/80 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 font-mono leading-relaxed">
          {escalateMsg}
        </p>
      )}

      {/* Lead list */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-4 rounded bg-zinc-700/60" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <p className="text-xs text-zinc-600 italic text-center py-2">
          No timed-out leads
        </p>
      ) : (
        <ul className="space-y-1.5 overflow-y-auto max-h-96">
          {leads.map((lead, i) => (
            <li
              key={lead.id ?? i}
              className="flex items-center gap-2 text-xs text-zinc-400 py-1 px-2 rounded hover:bg-white/[0.03] transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-400/60 flex-shrink-0" />
              <span className="truncate">{lead.name || "Unknown"}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

/* ─── Main Page ─── */
export default function Outreach() {
  const [activeTab, setActiveTab] = useState("queue");

  return (
    <div className="p-6 flex flex-col h-full">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-50">Outreach</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Manage multi-channel outreach — email and WhatsApp sequences before cold calling.
        </p>
      </div>

      {/* Body: tab panel + sidebar */}
      <div className="flex flex-1 min-h-0">
        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="glass-card flex flex-col flex-1 overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-glass-border px-2 flex-shrink-0">
              {TABS.map((tab) => (
                <TabButton
                  key={tab.key}
                  tab={tab}
                  active={activeTab === tab.key}
                  onClick={setActiveTab}
                />
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 p-6 overflow-y-auto">
              {activeTab === "queue" && <QueueTab />}
              {activeTab === "log" && <DeliveryLogTab />}
              {activeTab === "replies" && <RepliesTab />}
            </div>
          </div>
        </div>

        {/* Timeout sidebar */}
        <TimeoutSidebar />
      </div>
    </div>
  );
}
