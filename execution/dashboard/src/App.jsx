import { useState } from "react";
import { getToken, clearToken } from "./api";
import Login from "./components/Login";
import CommandCentre from "./components/CommandCentre";
import Pipeline from "./components/Pipeline";
import StrategyAnalytics from "./components/StrategyAnalytics";
import LeadDetail from "./components/LeadDetail";

const TABS = [
  {
    key: "command",
    label: "Command Centre",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" />
      </svg>
    ),
  },
  {
    key: "pipeline",
    label: "Pipeline",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 4v16M15 4v16M4 9h16M4 15h16" />
      </svg>
    ),
  },
  {
    key: "strategy",
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
  const [activeTab, setActiveTab] = useState("command");
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [previousTab, setPreviousTab] = useState("command");

  if (!authenticated) {
    return <Login onLogin={() => setAuthenticated(true)} />;
  }

  function handleLogout() {
    clearToken();
    setAuthenticated(false);
  }

  function navigateToLead(leadId) {
    setPreviousTab(activeTab);
    setSelectedLeadId(leadId);
    setActiveTab("lead-detail");
  }

  function navigateBack() {
    setSelectedLeadId(null);
    setActiveTab(previousTab);
  }

  function handleTabClick(tabKey) {
    setSelectedLeadId(null);
    setActiveTab(tabKey);
  }

  return (
    <div className="flex h-screen bg-base overflow-hidden">
      <nav className="w-14 flex-shrink-0 bg-surface border-r border-glass-border flex flex-col items-center py-4 gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold mb-4">
          C
        </div>

        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabClick(tab.key)}
            title={tab.label}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              activeTab === tab.key
                ? "bg-orange-500/15 border border-orange-500/30 text-orange-500"
                : "text-zinc-600 hover:text-zinc-400 hover:bg-glass-fill"
            }`}
          >
            {tab.icon}
          </button>
        ))}

        <div className="flex-1" />

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

      <main className="flex-1 overflow-y-auto p-6">
        {activeTab === "command" && <CommandCentre onNavigateToLead={navigateToLead} />}
        {activeTab === "pipeline" && <Pipeline onNavigateToLead={navigateToLead} />}
        {activeTab === "strategy" && <StrategyAnalytics />}
        {activeTab === "lead-detail" && selectedLeadId && (
          <LeadDetail leadId={selectedLeadId} onBack={navigateBack} onNavigateToLead={navigateToLead} />
        )}
      </main>
    </div>
  );
}
