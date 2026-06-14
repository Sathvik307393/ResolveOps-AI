"use client";

import React, { useState } from "react";
import { ShieldAlert, Filter, Search } from "lucide-react";
import AksRiskDetailsDrawer from "../AksRiskDetailsDrawer";

export default function AksRisksTab({ risks, clusterId }) {
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRisk, setSelectedRisk] = useState(null);

  if (!risks || risks.length === 0) {
    return (
      <div className="glass-panel p-10 rounded-xl text-center text-slate-400 border border-slate-800">
        <ShieldAlert size={48} className="mx-auto mb-4 text-emerald-500/50" />
        <p className="text-lg text-slate-300">No active workload risks detected.</p>
        <p className="text-sm mt-2">The cluster is currently healthy with no severe warnings or misconfigurations.</p>
      </div>
    );
  }

  const filteredRisks = risks.filter(r => {
    if (filterSeverity !== "all" && r.severity !== filterSeverity) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return r.resource.toLowerCase().includes(q) || r.namespace.toLowerCase().includes(q) || r.type.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="animate-in fade-in duration-300">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-lg border border-slate-800">
          <Filter size={16} className="text-slate-500 ml-2" />
          <select 
            className="bg-transparent text-sm text-white focus:outline-none py-1 pr-4 cursor-pointer"
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search risks..." 
            className="w-full bg-slate-900/50 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredRisks.length === 0 ? (
          <div className="text-center p-8 text-slate-400 border border-slate-800/50 rounded-xl bg-slate-900/20">
            No risks match the current filters.
          </div>
        ) : (
          filteredRisks.map((risk, idx) => (
            <div key={idx} className="bg-black/40 border border-slate-800 hover:border-slate-700 transition-colors p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <span className={`px-2 py-0.5 mt-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                  risk.severity === 'critical' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                  risk.severity === 'high' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                  'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {risk.severity}
                </span>
                <div>
                  <h4 className="text-white font-bold text-sm flex items-center gap-2">
                    {risk.type} 
                    <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[10px] rounded font-mono">{risk.resource}</span>
                  </h4>
                  <p className="text-xs text-slate-500 font-mono mt-1 mb-2">Namespace: {risk.namespace}</p>
                  <p className="text-xs text-slate-400 line-clamp-1 max-w-2xl">{risk.recommendation}</p>
                </div>
              </div>
              
              <button 
                onClick={() => setSelectedRisk(risk)}
                className="shrink-0 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors"
              >
                View Details
              </button>
            </div>
          ))
        )}
      </div>

      <AksRiskDetailsDrawer 
        risk={selectedRisk} 
        clusterId={clusterId}
        onClose={() => setSelectedRisk(null)} 
      />
    </div>
  );
}
