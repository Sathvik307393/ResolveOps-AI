"use client";

import DashboardLayout from "@/components/DashboardLayout";
import { AppWindow, Activity } from "lucide-react";

export default function AzureAppServiceExplorer() {
  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-6 font-sans">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold tracking-wide text-white">Azure App Service Explorer</h2>
            <p className="text-sm text-slate-500 mt-1">
              Active telemetry context for App Services in your connected Azure environment.
            </p>
          </div>
          <div className="bg-slate-800/80 px-3 py-1.5 rounded-lg border border-white/5 text-xs text-teal-400 font-semibold font-mono flex items-center space-x-2">
            <AppWindow size={14} />
            <span>Azure App Service</span>
          </div>
        </div>

        <div className="glass-panel rounded-xl border border-slate-800/80 flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Activity className="text-teal-500/50 w-12 h-12 mx-auto animate-pulse" />
            <h3 className="text-lg font-medium text-slate-300">App Service Telemetry Module Initializing</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              We are currently establishing the Azure Monitor logs connection to fetch your App Service metrics and logs. Please check back shortly.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
