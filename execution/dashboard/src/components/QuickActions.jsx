import { useState } from "react";
import { apiPost } from "../api";

export default function QuickActions({ leadId, leadStatus, onRefresh }) {
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState(null);

  const disableCallNow =
    calling ||
    leadStatus === "do_not_contact" ||
    leadStatus === "calling" ||
    leadStatus === "in_call";

  async function handleCallNow() {
    setError(null);
    setCalling(true);
    try {
      await apiPost(`/call-now/${leadId}`);
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message || "Failed to initiate call");
    } finally {
      setCalling(false);
    }
  }

  return (
    <div className="glass-card p-5 space-y-4">
      <p className="label-mono">Quick Actions</p>

      <div className="space-y-2">
        {/* Call Now */}
        <button
          type="button"
          onClick={handleCallNow}
          disabled={disableCallNow}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-green-500/30 ${
            disableCallNow
              ? "bg-green-500/10 border border-green-500/20 text-green-700 cursor-not-allowed"
              : "bg-green-500/15 border border-green-500/30 text-green-500 hover:bg-green-500/25 hover:border-green-500/50"
          }`}
        >
          {calling ? (
            <>
              <span className="h-3.5 w-3.5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
              Calling...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Call Now
            </>
          )}
        </button>

        {/* Schedule Follow-up — coming soon */}
        <button
          type="button"
          disabled
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-500/10 border border-blue-500/20 text-blue-700 cursor-not-allowed transition-colors"
          title="Coming soon"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Schedule Follow-up
          <span className="ml-auto text-[10px] font-mono text-blue-800/60">soon</span>
        </button>

        {/* Add Note — coming soon */}
        <button
          type="button"
          disabled
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-zinc-500/10 border border-zinc-500/20 text-zinc-600 cursor-not-allowed transition-colors"
          title="Coming soon"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Add Note
          <span className="ml-auto text-[10px] font-mono text-zinc-700/60">soon</span>
        </button>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
