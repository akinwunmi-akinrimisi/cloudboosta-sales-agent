import { Phone } from "lucide-react";

export default function Topbar({ title, dialerRunning = false, callActive = false }) {
  return (
    <header className="h-14 flex-shrink-0 border-b border-glass-border flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold text-zinc-100">{title}</h1>

      <div className="flex items-center gap-4">
        {callActive && (
          <div className="flex items-center gap-1.5 text-orange-500 text-sm">
            <Phone size={14} className="animate-pulse" />
            <span className="font-mono text-xs">LIVE</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-sm">
          <span
            className={`w-2 h-2 rounded-full ${
              dialerRunning ? "bg-green-500 animate-pulse" : "bg-zinc-600"
            }`}
          />
          <span className={dialerRunning ? "text-green-500" : "text-zinc-500"}>
            {dialerRunning ? "Dialer Active" : "Dialer Idle"}
          </span>
        </div>
      </div>
    </header>
  );
}
