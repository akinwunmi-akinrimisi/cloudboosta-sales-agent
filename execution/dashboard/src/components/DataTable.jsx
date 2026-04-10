import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { SkeletonTable } from "./LoadingSkeleton";
import EmptyState from "./EmptyState";

export default function DataTable({
  columns,
  data,
  total = 0,
  page = 1,
  perPage = 25,
  onPageChange,
  sortBy,
  sortOrder = "desc",
  onSort,
  onRowClick,
  loading = false,
  emptyMessage = "No data",
}) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const startIndex = total === 0 ? 0 : (page - 1) * perPage + 1;
  const endIndex = Math.min(page * perPage, total);

  const isFirstPage = page <= 1;
  const isLastPage = page >= totalPages;

  function handleHeaderClick(col) {
    if (col.sortable && onSort) {
      onSort(col.key);
    }
  }

  function renderSortIcon(col) {
    if (!col.sortable) return null;

    const isActive = sortBy === col.key;
    const iconClass = `w-3 h-3 ml-1 flex-shrink-0 ${isActive ? "text-orange-400" : "text-zinc-600"}`;

    if (isActive && sortOrder === "asc") {
      return <ChevronUp className={iconClass} />;
    }
    return <ChevronDown className={iconClass} />;
  }

  return (
    <div className="glass-card overflow-hidden flex flex-col">
      {/* Table body */}
      <div className="overflow-x-auto flex-1">
        {loading ? (
          <div className="px-4 py-3">
            <SkeletonTable rows={perPage > 10 ? 10 : perPage} />
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState title={emptyMessage} message="" />
        ) : (
          <table className="table-auto w-full text-sm">
            <thead>
              <tr className="border-b border-glass-border text-left">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleHeaderClick(col)}
                    className={[
                      "px-4 py-2.5 label-mono text-zinc-500 whitespace-nowrap select-none",
                      col.sortable ? "cursor-pointer hover:text-zinc-300 transition-colors" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="inline-flex items-center">
                      {col.label}
                      {renderSortIcon(col)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIndex) => (
                <tr
                  key={row.id ?? rowIndex}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={[
                    "border-b border-glass-border transition-colors",
                    onRowClick ? "cursor-pointer hover:bg-glass-fill" : "hover:bg-white/[0.02]",
                  ].join(" ")}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-2.5 text-sm text-zinc-300">
                      {col.render
                        ? col.render(row[col.key], row)
                        : row[col.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination footer */}
      <div className="border-t border-glass-border px-4 py-2.5 flex items-center justify-between gap-4">
        <span className="text-xs text-zinc-500 tabular-nums">
          {total === 0
            ? "No results"
            : `Showing ${startIndex}–${endIndex} of ${total}`}
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={isFirstPage || loading}
            onClick={() => !isFirstPage && onPageChange && onPageChange(page - 1)}
            className={[
              "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
              isFirstPage || loading
                ? "text-zinc-600 cursor-not-allowed"
                : "text-zinc-300 hover:bg-glass-fill hover:text-zinc-100 cursor-pointer",
            ].join(" ")}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Previous
          </button>

          <span className="px-2 text-xs text-zinc-600 tabular-nums select-none">
            {page} / {totalPages}
          </span>

          <button
            type="button"
            disabled={isLastPage || loading}
            onClick={() => !isLastPage && onPageChange && onPageChange(page + 1)}
            className={[
              "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
              isLastPage || loading
                ? "text-zinc-600 cursor-not-allowed"
                : "text-zinc-300 hover:bg-glass-fill hover:text-zinc-100 cursor-pointer",
            ].join(" ")}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
