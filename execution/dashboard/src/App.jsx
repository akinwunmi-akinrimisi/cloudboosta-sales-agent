import { useState } from "react";
import { getToken, clearToken } from "./api";
import Login from "./components/Login";
import LiveView from "./components/LiveView";
import Pipeline from "./components/Pipeline";
import StrategyAnalytics from "./components/StrategyAnalytics";

const TABS = [
  {
    label: "Live",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    label: "Pipeline",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 4v16M15 4v16M4 9h16M4 15h16" />
      </svg>
    ),
  },
  {
    label: "Strategy",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l3-9 4 18 3-9h4" />
      </svg>
    ),
  },
];

export default function App() {
  const [authenticated, setAuthenticated] = useState(!!getToken());
  const [activeTab, setActiveTab] = useState(0);

  if (!authenticated) {
    return <Login onLogin={() => setAuthenticated(true)} />;
  }

  function handleLogout() {
    clearToken();
    setAuthenticated(false);
  }

  return (
    <div className="flex h-screen bg-base overflow-hidden">
      {/* Icon Sidebar */}
      <nav className="w-14 flex-shrink-0 bg-surface border-r border-glass-border flex flex-col items-center py-4 gap-3">
        {/* Logo */}
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold mb-4">
          S
        </div>

        {/* Tab icons */}
        {TABS.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActiveTab(i)}
            title={tab.label}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              activeTab === i
                ? "bg-orange-500/15 border border-orange-500/30 text-orange-500"
                : "text-zinc-600 hover:text-zinc-400 hover:bg-glass-fill"
            }`}
          >
            {tab.icon}
          </button>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Logout"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-600 hover:text-zinc-400 hover:bg-glass-fill transition-colors"
        >
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </nav>

      {/* Content area */}
      <main className="flex-1 overflow-y-auto p-6">
        {activeTab === 0 && <LiveView />}
        {activeTab === 1 && <Pipeline />}
        {activeTab === 2 && <StrategyAnalytics />}
      </main>
    </div>
  );
}
