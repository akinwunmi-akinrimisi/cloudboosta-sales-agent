import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api";
import StatusBadge from "../components/StatusBadge";
import { SkeletonTable } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import { List, CalendarDays } from "lucide-react";
import { formatDateTime } from "../constants";

function CalendarView({ bookings }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7; // Monday start
  const totalDays = lastDay.getDate();

  // Map bookings to dates
  const bookingsByDate = {};
  for (const b of bookings) {
    if (b.call_scheduled_at) {
      const dateKey = b.call_scheduled_at.slice(0, 10); // YYYY-MM-DD
      if (!bookingsByDate[dateKey]) bookingsByDate[dateKey] = [];
      bookingsByDate[dateKey].push(b);
    }
  }

  // Build cells array
  const cells = [];
  // Previous month padding
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startPad - 1; i >= 0; i--) {
    cells.push({ day: prevMonthLastDay - i, current: false, dateKey: null });
  }
  // Current month
  for (let d = 1; d <= totalDays; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, current: true, dateKey, bookings: bookingsByDate[dateKey] || [] });
  }
  // Next month padding
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, current: false, dateKey: null });
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const monthName = currentDate.toLocaleDateString("en", { month: "long", year: "numeric" });
  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Selected day bookings
  const selectedBookings = selectedDay ? (bookingsByDate[selectedDay] || []) : [];

  return (
    <div className="glass-card p-6">
      {/* Nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
          className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
        >
          ← Prev
        </button>
        <h3 className="text-sm font-semibold text-zinc-200">{monthName}</h3>
        <button
          onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
          className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
        >
          Next →
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[11px] font-mono text-zinc-600 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          const isToday = cell.dateKey === today;
          const hasBookings = cell.bookings && cell.bookings.length > 0;
          const isSelected = cell.dateKey === selectedDay;

          return (
            <button
              key={i}
              onClick={() =>
                cell.current &&
                cell.dateKey &&
                setSelectedDay(cell.dateKey === selectedDay ? null : cell.dateKey)
              }
              disabled={!cell.current}
              className={`relative h-10 rounded-lg text-sm transition-colors ${
                !cell.current
                  ? "text-zinc-700 cursor-default"
                  : isSelected
                  ? "bg-orange-500/20 border border-orange-500/40 text-orange-400"
                  : isToday
                  ? "ring-1 ring-orange-500/50 text-zinc-100"
                  : "text-zinc-400 hover:bg-white/[0.04]"
              }`}
            >
              {cell.day}
              {hasBookings && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-orange-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day bookings */}
      {selectedDay && (
        <div className="mt-4 p-4 rounded-lg bg-zinc-800/50 border border-white/[0.06]">
          <h4 className="text-[11px] font-mono uppercase tracking-widest text-zinc-500 mb-3">
            Bookings for{" "}
            {new Date(selectedDay + "T00:00:00").toLocaleDateString("en", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h4>
          {selectedBookings.length === 0 ? (
            <p className="text-sm text-zinc-500">No bookings on this day</p>
          ) : (
            <div className="space-y-2">
              {selectedBookings.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/60 border border-white/[0.06]"
                >
                  <div>
                    <p className="text-sm text-zinc-200 font-medium">{b.name}</p>
                    <p className="text-xs text-zinc-500 font-mono">{b.email || b.phone}</p>
                  </div>
                  <p className="text-xs text-zinc-400 font-mono">
                    {new Date(b.call_scheduled_at).toLocaleTimeString("en", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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
        <CalendarView bookings={bookings} />
      )}
    </div>
  );
}
