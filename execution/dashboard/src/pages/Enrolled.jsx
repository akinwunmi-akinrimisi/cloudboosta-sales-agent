import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";
import StatusBadge from "../components/StatusBadge";
import { SkeletonTable } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import { Download, GraduationCap } from "lucide-react";
import { formatDateTime } from "../constants";

/**
 * Parse a payment amount + currency from a notes string.
 * Matches patterns like "Payment: 2500 GBP" or "Payment: £1200".
 * Returns a formatted string or "—" if no match found.
 */
function parsePaymentInfo(notes) {
  if (!notes) return "—";

  // Match "Payment: <amount> <currency>" e.g. "Payment: 2500 GBP"
  const match = notes.match(/Payment:\s*([\d,]+(?:\.\d+)?)\s*([A-Z]{3})/i);
  if (match) {
    const amount = match[1];
    const currency = match[2].toUpperCase();
    return `${amount} ${currency}`;
  }

  // Match "Payment: £<amount>" or "$<amount>"
  const symbolMatch = notes.match(/Payment:\s*([£$€])([\d,]+(?:\.\d+)?)/i);
  if (symbolMatch) {
    return `${symbolMatch[1]}${symbolMatch[2]}`;
  }

  return "—";
}

/**
 * Generate and trigger a CSV download of enrolled leads.
 */
function exportCSV(leads) {
  const headers = ["Name", "Programme", "Email", "Phone", "Enrolled Date"];
  const rows = leads.map((l) => [
    l.name,
    l.programme_recommended || "",
    l.email || "",
    l.phone,
    l.updated_at ? new Date(l.updated_at).toLocaleDateString() : "",
  ]);
  const csv = [headers, ...rows]
    .map((r) =>
      r.map((c) => `"${(c || "").replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `enrolled-students-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function EnrolledTable({ leads, loading }) {
  if (loading) {
    return (
      <div className="glass-card px-4 py-3">
        <SkeletonTable rows={8} />
      </div>
    );
  }

  if (!leads || leads.length === 0) {
    return (
      <div className="glass-card">
        <EmptyState
          icon={<GraduationCap className="w-10 h-10 text-zinc-600" />}
          title="No enrolled students yet"
          message="Leads who complete enrolment will appear here."
        />
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table-auto w-full text-sm">
          <thead>
            <tr className="border-b border-glass-border text-left">
              <th className="px-4 py-2.5 label-mono text-zinc-500 whitespace-nowrap">
                Name
              </th>
              <th className="px-4 py-2.5 label-mono text-zinc-500 whitespace-nowrap">
                Programme
              </th>
              <th className="px-4 py-2.5 label-mono text-zinc-500 whitespace-nowrap">
                Email
              </th>
              <th className="px-4 py-2.5 label-mono text-zinc-500 whitespace-nowrap">
                Phone
              </th>
              <th className="px-4 py-2.5 label-mono text-zinc-500 whitespace-nowrap">
                Payment Info
              </th>
              <th className="px-4 py-2.5 label-mono text-zinc-500 whitespace-nowrap">
                Enrolled Date
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, index) => {
              const displayName =
                lead.name ||
                [lead.first_name, lead.last_name].filter(Boolean).join(" ") ||
                "Unknown";

              return (
                <tr
                  key={lead.id ?? index}
                  className="border-b border-glass-border transition-colors hover:bg-white/[0.02]"
                >
                  {/* Name — links to /leads/:id */}
                  <td className="px-4 py-2.5 text-sm">
                    {lead.id ? (
                      <Link
                        to={`/leads/${lead.id}`}
                        className="text-orange-400 hover:text-orange-300 transition-colors font-medium"
                      >
                        {displayName}
                      </Link>
                    ) : (
                      <span className="text-zinc-300">{displayName}</span>
                    )}
                  </td>

                  {/* Programme */}
                  <td className="px-4 py-2.5 text-sm text-zinc-300">
                    {lead.programme_recommended ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        {lead.programme_recommended}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>

                  {/* Email */}
                  <td className="px-4 py-2.5 text-sm text-zinc-400">
                    {lead.email ? (
                      <a
                        href={`mailto:${lead.email}`}
                        className="hover:text-zinc-300 transition-colors"
                      >
                        {lead.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>

                  {/* Phone */}
                  <td className="px-4 py-2.5 text-sm text-zinc-400 tabular-nums">
                    {lead.phone || "—"}
                  </td>

                  {/* Payment Info — parsed from notes */}
                  <td className="px-4 py-2.5 text-sm tabular-nums">
                    {(() => {
                      const info = parsePaymentInfo(lead.notes);
                      return info !== "—" ? (
                        <span className="text-green-400 font-mono font-medium">
                          {info}
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      );
                    })()}
                  </td>

                  {/* Enrolled Date — from updated_at */}
                  <td className="px-4 py-2.5 text-sm text-zinc-400 tabular-nums whitespace-nowrap">
                    {lead.updated_at
                      ? new Date(lead.updated_at).toLocaleDateString([], {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      <div className="border-t border-glass-border px-4 py-2.5">
        <span className="text-xs text-zinc-500 tabular-nums">
          {leads.length} student{leads.length !== 1 ? "s" : ""} enrolled
        </span>
      </div>
    </div>
  );
}

export default function Enrolled() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch("/leads/enrolled")
      .then((data) => {
        if (!cancelled) setLeads(data.leads ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load enrolled students");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-zinc-50 flex items-center gap-2">
              Enrolled Students
              {!loading && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/15 border border-green-500/30 text-green-400 tabular-nums">
                  {leads.length}
                </span>
              )}
            </h1>
            <p className="text-xs text-zinc-600 mt-0.5">
              {loading
                ? "Loading…"
                : `${leads.length} student${leads.length !== 1 ? "s" : ""} enrolled`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Error indicator */}
          {error && (
            <span className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg">
              {error}
            </span>
          )}

          {/* Export CSV button */}
          <button
            type="button"
            onClick={() => exportCSV(leads)}
            disabled={loading || leads.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors
              bg-orange-500/15 border border-orange-500/30 text-orange-400
              hover:bg-orange-500/25 active:scale-95
              disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <EnrolledTable leads={leads} loading={loading} />
    </div>
  );
}
