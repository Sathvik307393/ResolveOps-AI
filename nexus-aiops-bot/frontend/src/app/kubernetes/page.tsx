"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { Server, Box, Terminal, Activity, Wifi, WifiOff } from "lucide-react";
import { fetchApi } from "@/lib/api";

type Service = {
  name: string;
  level: string;
  count: number;
};

export default function KubernetesExplorer() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedLogs, setSelectedLogs] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
      router.push("/login");
      return;
    }

    fetchApi("/v1/logs")
      .then((data: any[]) => {
        const allLogs = Array.isArray(data) ? data : [];
        setLogs(allLogs);

        // Aggregate by service
        const serviceMap: Record<string, { level: string; count: number }> = {};
        allLogs.forEach((log) => {
          const svc = log.service || "unknown";
          if (!serviceMap[svc]) {
            serviceMap[svc] = { level: log.level, count: 0 };
          }
          serviceMap[svc].count++;
          // Escalate severity if we see errors
          const levels = ["INFO", "WARNING", "ERROR", "CRITICAL", "FATAL"];
          const existing = levels.indexOf(serviceMap[svc].level);
          const incoming = levels.indexOf(log.level);
          if (incoming > existing) {
            serviceMap[svc].level = log.level;
          }
        });

        setServices(
          Object.entries(serviceMap).map(([name, { level, count }]) => ({
            name,
            level,
            count,
          }))
        );

        if (Object.keys(serviceMap).length > 0) {
          const firstService = Object.keys(serviceMap)[0];
          setSelectedService(firstService);
          setSelectedLogs(allLogs.filter((l) => l.service === firstService));
        }

        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  const handleSelectService = (name: string) => {
    setSelectedService(name);
    setSelectedLogs(logs.filter((l) => l.service === name));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Activity className="animate-spin text-indigo-500 w-8 h-8" />
      </div>
    );
  }

  const getLevelColor = (level: string) => {
    switch (level?.toUpperCase()) {
      case "CRITICAL":
      case "FATAL":
      case "ERROR":
        return { text: "text-rose-400", border: "border-rose-500/50", bg: "bg-rose-500/20" };
      case "WARNING":
        return { text: "text-amber-400", border: "border-amber-500/40", bg: "bg-amber-500/20" };
      default:
        return { text: "text-emerald-400", border: "border-white/5", bg: "bg-emerald-500/10" };
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-6">
        <div>
          <h2 className="text-xl font-medium tracking-wide text-white">Service Log Explorer</h2>
          <p className="text-sm text-slate-500 mt-1">
            Real-time view of active services ingesting telemetry into Nexus AI
          </p>
        </div>

        {services.length === 0 ? (
          /* Empty State */
          <div className="flex-1 glass-panel rounded-xl flex flex-col items-center justify-center text-center p-12">
            <WifiOff className="w-16 h-16 text-slate-600 mb-6" />
            <h3 className="text-xl font-medium text-white mb-3">No Services Detected</h3>
            <p className="text-slate-400 max-w-md mb-6">
              No telemetry has been ingested yet. Once your services start sending logs to the{" "}
              <code className="text-indigo-400 bg-indigo-400/10 px-1 rounded">/api/v1/ingest</code> endpoint, they will appear here automatically.
            </p>
            <div className="bg-[#0a0a0f] border border-slate-800 rounded-lg p-4 text-left text-xs font-mono text-slate-400 max-w-md w-full">
              <p className="text-emerald-400 mb-2"># Example ingest call</p>
              <p>curl -X POST https://nexusai.sathvikdevops.online/api/v1/ingest \</p>
              <p className="pl-4">-H "Authorization: Bearer &lt;your-token&gt;" \</p>
              <p className="pl-4">-d {'\'{"service":"my-api","level":"INFO","message":"started"}\''}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-[500px]">
            {/* Services List (replaces fake Nodes) */}
            <div className="lg:col-span-1 glass-panel rounded-xl flex flex-col overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase flex items-center">
                  <Server size={14} className="mr-2 text-indigo-400" /> Active Services
                </h3>
                <span className="w-5 h-5 rounded bg-white/10 flex items-center justify-center text-[10px] font-bold text-white">
                  {services.length}
                </span>
              </div>
              <div className="p-3 space-y-2 overflow-y-auto flex-1">
                {services.map((svc) => {
                  const colors = getLevelColor(svc.level);
                  const isSelected = selectedService === svc.name;
                  return (
                    <button
                      key={svc.name}
                      onClick={() => handleSelectService(svc.name)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        isSelected
                          ? "bg-indigo-600/20 border-indigo-500/40"
                          : `bg-white/5 hover:bg-white/10 ${colors.border}`
                      }`}
                    >
                      <div className="font-mono text-sm text-white truncate">{svc.name}</div>
                      <div className="flex items-center justify-between mt-1">
                        <div className={`text-[10px] font-bold ${colors.text}`}>{svc.level}</div>
                        <div className="text-[10px] text-slate-500">{svc.count} logs</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recent Log Events (replaces fake Pods) */}
            <div className="lg:col-span-1 glass-panel rounded-xl flex flex-col overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase flex items-center">
                  <Box size={14} className="mr-2 text-rose-400" /> Recent Events
                </h3>
              </div>
              <div className="p-3 space-y-2 overflow-y-auto flex-1">
                {selectedLogs.slice(0, 20).map((log, i) => {
                  const colors = getLevelColor(log.level);
                  return (
                    <div key={i} className={`p-2 bg-white/5 border ${colors.border} rounded-lg`}>
                      <div className={`text-[10px] font-bold ${colors.text}`}>{log.level}</div>
                      <div className="font-mono text-xs text-slate-300 truncate mt-0.5">{log.message}</div>
                      <div className="text-[10px] text-slate-600 mt-1">{new Date(log.timestamp).toLocaleTimeString()}</div>
                    </div>
                  );
                })}
                {selectedLogs.length === 0 && (
                  <p className="text-slate-500 text-sm text-center mt-6">No events for this service</p>
                )}
              </div>
            </div>

            {/* Terminal Viewer */}
            <div className="lg:col-span-2 glass-panel rounded-xl flex flex-col overflow-hidden border border-slate-700/50 relative">
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
                <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase flex items-center">
                  <Terminal size={14} className="mr-2 text-emerald-400" />
                  {selectedService ? `${selectedService} — stdout` : "Select a service"}
                </h3>
                <div className="flex items-center space-x-1">
                  {selectedService && (
                    <span className="flex items-center space-x-1 text-[10px] text-emerald-400">
                      <Wifi size={10} className="animate-pulse" />
                      <span>LIVE</span>
                    </span>
                  )}
                  <div className="flex space-x-1 ml-3">
                    <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  </div>
                </div>
              </div>
              <div className="flex-1 p-4 font-mono text-xs text-slate-300 bg-[#0a0a0f] overflow-y-auto">
                {selectedLogs.length === 0 && (
                  <p className="text-slate-600 italic">No log output available.</p>
                )}
                {selectedLogs.map((log, i) => {
                  const levelColors: Record<string, string> = {
                    ERROR: "text-rose-400",
                    CRITICAL: "text-rose-500",
                    FATAL: "text-rose-600",
                    WARNING: "text-amber-400",
                    INFO: "text-indigo-400",
                    DEBUG: "text-slate-500",
                  };
                  const color = levelColors[log.level?.toUpperCase()] || "text-slate-400";
                  return (
                    <p key={i} className="mt-0.5">
                      <span className={`${color} font-bold`}>{log.level?.padEnd(8)}</span>{" "}
                      <span className="text-slate-600">
                        [{new Date(log.timestamp).toLocaleTimeString()}]
                      </span>{" "}
                      {log.message}
                    </p>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
