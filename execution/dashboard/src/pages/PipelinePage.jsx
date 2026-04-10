import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api";
import StatusBadge from "../components/StatusBadge";
import { SkeletonCard } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import { KANBAN_COLUMNS, maskPhone, formatRelativeTime } from "../constants";
import { useInterval } from "../hooks/useInterval";

// Core statuses that always show even at 0
const ALWAYS_SHOW = new Set(["new", "queued"]);

export default function PipelinePage() {
  const navigate = useNavigate();
  const [statusCounts, setStatusCounts] = useState([]);
  const [columnLeads, setColumnLeads] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedColumn, setExpandedColumn] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      // Get status counts
      const countsData = await apiFetch("/leads/by-status");
      setStatusCounts(countsData.statuses || []);

      // For each kanban column, fetch a sample of leads per sub-status
      const leadsMap = {};
      for (const col of KANBAN_COLUMNS) {
        for (const s of col.statuses) {
          const result = await apiFetch(
            `/leads?status=${s}&per_page=10&sort_by=updated_at&sort_order=desc`
          );
          if (!leadsMap[col.key]) leadsMap[col.key] = [];
          leadsMap[col.key].push(...(result.leads || []));
        }
      }
      setColumnLeads(leadsMap);
    } catch (err) {
      console.error("Pipeline fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useInterval(fetchData, 30000);

  // Compute total count for a kanban column from statusCounts
  function getColumnCount(col) {
    return col.statuses.reduce((sum, s) => {
      const found = statusCounts.find((sc) => sc.status === s);
      return sum + (found ? found.count : 0);
    }, 0);
  }

  const visibleColumns = KANBAN_COLUMNS.filter(
    (col) => ALWAYS_SHOW.has(col.key) || getColumnCount(col) > 0
  );

  const totalLeads = statusCounts.reduce((sum, sc) => sum + (sc.count || 0), 0);

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <div className="h-7 w-36 bg-zinc-700 rounded animate-pulse mb-1" />
          <div className="h-4 w-52 bg-zinc-800 rounded animate-pulse" />
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="min-w-[220px] max-w-[260px] flex-shrink-0">
              <SkeletonCard className="h-48" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Pipeline</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {totalLeads.toLocaleString()} lead{totalLeads !== 1 ? "s" : ""} across{" "}
            {visibleColumns.length} stage{visibleColumns.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-3 py-1.5 rounded-md border border-glass-border hover:border-glass-border-hover"
        >
          Refresh
        </button>
      </div>

      {/* Empty state */}
      {visibleColumns.length === 0 ? (
        <EmptyState
          title="No leads yet"
          message="Leads will appear here once they are added to the system."
        />
      ) : (
        /* Kanban board — horizontal scroll */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {visibleColumns.map((col) => {
            const count = getColumnCount(col);
            const leads = columnLeads[col.key] || [];
            const isExpanded = expandedColumn === col.key;
            const displayLeads = isExpanded ? leads : leads.slice(0, 10);

            return (
              <div
                key={col.key}
                className="glass-card p-3 flex-shrink-0 min-w-[220px] max-w-[260px] flex flex-col"
              >
                {/* Column header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-zinc-200">
                    {col.label}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300 tabular-nums">
                    {count}
                  </span>
                </div>

                {/* Lead cards */}
                <div className="flex flex-col gap-2 flex-1">
                  {leads.length === 0 ? (
                    <div className="text-xs text-zinc-600 text-center py-6">
                      No leads
                    </div>
                  ) : (
                    <>
                      {displayLeads.map((lead) => (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          onClick={() => navigate(`/leads/${lead.id}`)}
                        />
                      ))}

                      {/* "View all" link when there are more leads than shown */}
                      {count > 10 && (
                        <button
                          onClick={() =>
                            navigate(`/leads?status=${col.statuses.join(",")}`)
                          }
                          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors text-center py-1 mt-1"
                        >
                          View all {count}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LeadCard({ lead, onClick }) {
  const name =
    [lead.first_name, lead.last_name].filter(Boolean).join(" ") ||
    lead.full_name ||
    lead.name ||
    "Unknown";

  const lastActivity = lead.updated_at || lead.last_called_at || lead.created_at;

  return (
    <div
      onClick={onClick}
      className="p-3 rounded-lg bg-zinc-800/50 border border-glass-border hover:border-glass-border-hover cursor-pointer transition-colors mb-0"
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-sm text-zinc-200 font-medium leading-tight truncate flex-1">
          {name}
        </span>
        {lead.status && (
          <StatusBadge status={lead.status} />
        )}
      </div>

      {lead.phone && (
        <p className="text-xs text-zinc-500 font-mono mt-1">
          {maskPhone(lead.phone)}
        </p>
      )}

      {lastActivity && (
        <p className="text-xs text-zinc-600 mt-1.5">
          {formatRelativeTime(lastActivity)}
        </p>
      )}
    </div>
  );
}
