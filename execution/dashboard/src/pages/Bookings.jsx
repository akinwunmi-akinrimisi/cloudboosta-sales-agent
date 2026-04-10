import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";
import StatusBadge from "../components/StatusBadge";
import { SkeletonTable } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import { List, CalendarDays } from "lucide-react";
import { formatDateTime } from "../constants";

function CalendarPlaceholder() {
  return (
    <div className="glass-card flex flex-col items-center justify-center py-20 px-8">
      <CalendarDays className="w-12 h-12 text-zinc-600 mb-4" />
      <p className="text-sm text-zinc-500 font-mono">Calendar view — coming in Phase 3</p>
    </div>
  );
}

function BookingsTable({ bookings, loading }) {
  if (loading) {
    return (
      <div className="glass-card px-4 py-3">
        <SkeletonTable rows={8} />
      </div>
    );
  }

  if (!bookings || bookings.length === 0) {
    return (
      <div className="glass-card">
        <EmptyState
          title="No bookings yet"
          message="Scheduled calls will appear here once leads book a time slot."
        />
      </div>
    );
  }

  const now = new Date();
  const upcoming = bookings.filter((b) => b.call_scheduled_at && new Date(b.call_scheduled_at) > now);
  const past = bookings.filter((b) => !b.call_scheduled_at || new Date(b.call_scheduled_at) <= now);
  const sorted = [...upcoming, ...past];

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table-auto w-full text-sm">
          <thead>
            <tr className="border-b border-glass-border text-left">
              <th className="px-4 py-2.5 label-mono text-zinc-500 whitespace-nowrap">Date / Time</th>
              <th className="px-4 py-2.5 label-mono text-zinc-500 whitespace-nowrap">Lead Name</th>
              <th className="px-4 py-2.5 label-mono text-zinc-500 whitespace-nowrap">Email</th>
              <th className="px-4 py-2.5 label-mono text-zinc-500 whitespace-nowrap">Phone</th>
              <th className="px-4 py-2.5 label-mono text-zinc-500 whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((booking, index) => {
              const isPast =
                !booking.call_scheduled_at ||
                new Date(booking.call_scheduled_at) <= now;

              return (
                <tr
                  key={booking.id ?? index}
                  className={[
                    "border-b border-glass-border transition-colors hover:bg-white/[0.02]",
                    isPast ? "opacity-50" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {/* Date / Time */}
                  <td className="px-4 py-2.5 text-sm text-zinc-300 tabular-nums whitespace-nowrap">
                    {booking.call_scheduled_at
                      ? formatDateTime(booking.call_scheduled_at)
                      : "—"}
                  </td>

                  {/* Lead Name — links to /leads/:id */}
                  <td className="px-4 py-2.5 text-sm">
                    {booking.id ? (
                      <Link
                        to={`/leads/${booking.id}`}
                        className="text-orange-400 hover:text-orange-300 transition-colors font-medium"
                      >
                        {booking.name ||
                          [booking.first_name, booking.last_name]
                            .filter(Boolean)
                            .join(" ") ||
                          "Unknown"}
                      </Link>
                    ) : (
                      <span className="text-zinc-300">
                        {booking.name ||
                          [booking.first_name, booking.last_name]
                            .filter(Boolean)
                            .join(" ") ||
                          "Unknown"}
                      </span>
                    )}
                  </td>

                  {/* Email */}
                  <td className="px-4 py-2.5 text-sm text-zinc-400">
                    {booking.email || "—"}
                  </td>

                  {/* Phone */}
                  <td className="px-4 py-2.5 text-sm text-zinc-400 tabular-nums">
                    {booking.phone || "—"}
                  </td>

                  {/* Status badge */}
                  <td className="px-4 py-2.5">
                    <StatusBadge status={booking.status} />
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
          {upcoming.length} upcoming · {past.length} past
        </span>
      </div>
    </div>
  );
}

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [view, setView] = useState("list"); // "list" | "calendar"

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch("/bookings")
      .then((data) => {
        if (!cancelled) setBookings(data.bookings ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load bookings");
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
        <div>
          <h1 className="text-xl font-bold text-zinc-50">Bookings</h1>
          <p className="text-xs text-zinc-600 mt-0.5">
            {loading
              ? "Loading…"
              : `${bookings.length} booking${bookings.length !== 1 ? "s" : ""} total`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Error indicator */}
          {error && (
            <span className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg">
              {error}
            </span>
          )}

          {/* View toggle */}
          <div className="inline-flex items-center rounded-lg border border-glass-border overflow-hidden">
            <button
              type="button"
              onClick={() => setView("list")}
              aria-label="List view"
              aria-pressed={view === "list"}
              className={[
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium transition-colors",
                view === "list"
                  ? "bg-orange-500/15 text-orange-400 border-r border-glass-border"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03] border-r border-glass-border",
              ].join(" ")}
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
            <button
              type="button"
              onClick={() => setView("calendar")}
              aria-label="Calendar view"
              aria-pressed={view === "calendar"}
              className={[
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium transition-colors",
                view === "calendar"
                  ? "bg-orange-500/15 text-orange-400"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]",
              ].join(" ")}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Calendar
            </button>
          </div>
        </div>
      </div>

      {/* View Content */}
      {view === "list" ? (
        <BookingsTable bookings={bookings} loading={loading} />
      ) : (
        <CalendarPlaceholder />
      )}
    </div>
  );
}
