"use client";

import React from "react";
import { ShieldAlert, AlertTriangle, Activity, AlertCircle, Layout, HardDrive, Server, Cpu } from "lucide-react";

export default function AksRiskSummaryCards({ summary, risks }) {
  const criticalCount = risks?.filter(r => r.severity === 'critical').length || 0;
  const highCount = risks?.filter(r => r.severity === 'high').length || 0;
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="glass-panel p-4 rounded-xl border border-rose-500/30 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-rose-400 uppercase font-bold tracking-wider">Critical Risks</p>
          <p className="text-2xl text-white font-bold">{criticalCount}</p>
        </div>
        <div className="p-2 bg-rose-500/10 rounded-lg"><ShieldAlert className="text-rose-500" size={20} /></div>
      </div>
      <div className="glass-panel p-4 rounded-xl border border-orange-500/30 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-orange-400 uppercase font-bold tracking-wider">High Risks</p>
          <p className="text-2xl text-white font-bold">{highCount}</p>
        </div>
        <div className="p-2 bg-orange-500/10 rounded-lg"><AlertTriangle className="text-orange-500" size={20} /></div>
      </div>
      <div className="glass-panel p-4 rounded-xl border border-amber-500/30 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-amber-400 uppercase font-bold tracking-wider">Pending Pods</p>
          <p className="text-2xl text-white font-bold">{summary.pending_pods || 0}</p>
        </div>
        <div className="p-2 bg-amber-500/10 rounded-lg"><Activity className="text-amber-500" size={20} /></div>
      </div>
      <div className="glass-panel p-4 rounded-xl border border-slate-700 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Failed Pods</p>
          <p className="text-2xl text-white font-bold">{summary.failed_pods || 0}</p>
        </div>
        <div className="p-2 bg-slate-800 rounded-lg"><AlertCircle className="text-slate-400" size={20} /></div>
      </div>
    </div>
  );
}
