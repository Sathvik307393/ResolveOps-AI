"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { Server, Activity } from "lucide-react";

export default function AzureVMExplorer() {
  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-6 font-sans">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold tracking-wide text-white">Azure Virtual Machines Explorer</h2>
            <p className="text-sm text-slate-500 mt-1">
              Active telemetry context for Virtual Machines in your connected Azure environment.
            </p>
          </div>
          <div className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-white/5 text-xs text-blue-400 font-semibold font-mono flex items-center space-x-2">
            <Server size={14} />
            <span>Azure VM</span>
          </div>
        </div>

        <div className="glass-panel rounded-xl border border-slate-800/80 flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Activity className="text-blue-500/50 w-12 h-12 mx-auto animate-pulse" />
            <h3 className="text-lg font-medium text-slate-300">VM Telemetry Module Initializing</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              We are currently establishing the Azure Monitor logs connection to fetch your VM metrics and logs. Please check back shortly.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
