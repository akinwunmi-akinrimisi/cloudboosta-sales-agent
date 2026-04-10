import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, UserPlus, X } from "lucide-react";
import { apiFetch, apiUpload } from "../api";
import DataTable from "../components/DataTable";
import FilterBar from "../components/FilterBar";
import StatusBadge from "../components/StatusBadge";
import { STATUS_COLORS } from "../constants";

// Build status options from all keys in STATUS_COLORS
const STATUS_OPTIONS = Object.keys(STATUS_COLORS).map((key) => ({
  value: key,
  label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
}));

const COLUMNS = [
  { key: "name", label: "Name", sortable: true },
  { key: "phone", label: "Phone", sortable: false },
  {
    key: "email",
    label: "Email",
    sortable: false,
    render: (v) => v || "—",
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    render: (v) => <StatusBadge status={v} />,
  },
  {
    key: "detected_persona",
    label: "Persona",
    sortable: false,
    render: (v) => v || "—",
  },
  {
    key: "last_call_at",
    label: "Last Call",
    sortable: true,
    render: (v) => (v ? new Date(v).toLocaleDateString() : "—"),
  },
  {
    key: "source",
    label: "Source",
    sortable: false,
    render: (v) => v || "—",
  },
];

function ImportResultCard({ result, onDismiss }) {
  if (!result) return null;

  const hasErrors = result.errors > 0;
  const hasImports = result.imported > 0;
  const isSuccess = hasImports && !hasErrors;

  return (
    <div
      className={[
        "flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm",
        isSuccess
          ? "bg-green-500/10 border-green-500/30 text-green-400"
          : hasErrors && !hasImports
          ? "bg-red-500/10 border-red-500/30 text-red-400"
          : "bg-amber-500/10 border-amber-500/30 text-amber-400",
      ].join(" ")}
    >
      <div className="space-y-1">
        <p className="font-medium">
          {hasImports
            ? `Imported ${result.imported} lead${result.imported !== 1 ? "s" : ""}`
            : "No new leads imported"}
          {result.duplicates > 0 && `, ${result.duplicates} duplicate${result.duplicates !== 1 ? "s" : ""} skipped`}
          {result.errors > 0 && `, ${result.errors} error${result.errors !== 1 ? "s" : ""}`}
        </p>
        {result.error_details && result.error_details.length > 0 && (
          <ul className="text-xs opacity-80 space-y-0.5 list-disc list-inside">
            {result.error_details.slice(0, 5).map((detail, i) => (
              <li key={i}>{detail}</li>
            ))}
            {result.error_details.length > 5 && (
              <li>…and {result.error_details.length - 5} more</li>
            )}
          </ul>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-0.5 text-current opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function Leads() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(null);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/leads?page=${page}&per_page=${perPage}&sort_by=${sortBy}&sort_order=${sortOrder}`;
      if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

      const data = await apiFetch(url);
      setLeads(data.leads ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err.message || "Failed to load leads");
      setLeads([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  function handleSort(key) {
    if (key === sortBy) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(key);
      setSortOrder("desc");
    }
    setPage(1);
  }

  function handleSearchChange(value) {
    setSearch(value);
    setPage(1);
  }

  function handleFilterChange(key, value) {
    if (key === "status") {
      setStatusFilter(value || null);
      setPage(1);
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset so the same file can be re-uploaded
    e.target.value = "";

    setImporting(true);
    setImportResult(null);
    try {
      const result = await apiUpload("/leads/import", file);
      setImportResult(result);
      // Refresh lead list after import
      await fetchLeads();
    } catch (err) {
      setImportResult({
        imported: 0,
        duplicates: 0,
        errors: 1,
        error_details: [err.message || "Import failed"],
      });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-50">Leads</h1>
          <p className="text-xs text-zinc-600 mt-0.5">
            {total > 0 ? `${total.toLocaleString()} leads total` : "Manage your lead pipeline"}
          </p>
        </div>
        {error && (
          <span className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg">
            {error}
          </span>
        )}
      </div>

      {/* Filter Bar */}
      <FilterBar
        searchValue={search}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search leads by name, phone, or email..."
        filters={[
          {
            key: "status",
            label: "Status",
            value: statusFilter,
            options: STATUS_OPTIONS,
          },
        ]}
        onFilterChange={handleFilterChange}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
        />

        {/* Import CSV */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-medium transition-colors
            bg-orange-500/15 border border-orange-500/30 text-orange-500
            hover:bg-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload className="w-3.5 h-3.5" />
          {importing ? "Importing…" : "Import CSV"}
        </button>

        {/* Add Lead (placeholder) */}
        <button
          type="button"
          disabled
          title="Coming soon"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-medium transition-colors
            bg-zinc-800 border border-zinc-700 text-zinc-500
            opacity-50 cursor-not-allowed"
        >
          <UserPlus className="w-3.5 h-3.5" />
          Add Lead
        </button>
      </FilterBar>

      {/* Import Result Banner */}
      <ImportResultCard
        result={importResult}
        onDismiss={() => setImportResult(null)}
      />

      {/* Data Table */}
      <DataTable
        columns={COLUMNS}
        data={leads}
        total={total}
        page={page}
        perPage={perPage}
        onPageChange={setPage}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onRowClick={(row) => navigate(`/leads/${row.id}`)}
        loading={loading}
        emptyMessage="No leads found"
      />
    </div>
  );
}
