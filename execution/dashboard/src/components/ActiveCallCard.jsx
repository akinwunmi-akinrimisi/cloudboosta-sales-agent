import { useState, useEffect } from "react";
import { maskPhone, formatDuration } from "../constants";

export default function ActiveCallCard({ call }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!call?.last_call_at) {
      setElapsed(0);
      return;
    }

    function tick() {
      const start = new Date(call.last_call_at).getTime();
      const now = Date.now();
      setElapsed(Math.max(0, Math.floor((now - start) / 1000)));
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [call?.last_call_at]);

  if (!call) {
    return null;
  }

  const isInCall = call.status === "in_call";

  return (
    <div
      className={`glass-card p-5 ${
        isInCall
          ? "border-orange-500/30 shadow-lg shadow-orange-500/5"
          : "border-amber-500/20"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Pulse dot */}
          <span className="relative flex h-3 w-3 mt-1.5">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isInCall ? "bg-green-500 animate-ping" : "bg-amber-400 animate-pulse"
              }`}
            />
            <span
              className={`relative inline-flex h-3 w-3 rounded-full ${
                isInCall ? "bg-green-500" : "bg-amber-400"
              }`}
              style={isInCall ? { boxShadow: "0 0 8px #22c55e" } : {}}
            />
          </span>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="label-mono text-orange-500">
                {isInCall ? "LIVE CALL" : "CALLING"}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-zinc-50">
              {call.name || "Unknown Lead"}
            </h2>
            <p className="text-sm text-zinc-500">
              {maskPhone(call.phone)}
            </p>

            <div className="flex flex-wrap items-center gap-2 mt-2">
              {call.programme_recommended && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-blue-500/15 border border-blue-500/30 text-blue-500">
                  {call.programme_recommended}
                </span>
              )}
              {call.last_strategy_used && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-violet-500/15 border border-violet-500/30 text-violet-500">
                  {call.last_strategy_used}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Duration timer */}
        <div className="text-right">
          <p className="text-2xl font-mono font-bold text-zinc-50 tabular-nums">
            {formatDuration(elapsed)}
          </p>
          <p className="label-mono mt-1">Duration</p>
        </div>
      </div>
    </div>
  );
}
