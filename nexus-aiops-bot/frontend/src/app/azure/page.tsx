"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { Cloud, Server, Database, AppWindow, Hexagon, Activity, CheckCircle, AlertTriangle, AlertCircle, RefreshCw } from "lucide-react";
import { fetchApi } from "@/lib/api";

interface CloudResource {
  id: string;
  name: string;
  type: string;
  provider: string;
  region: string;
  status: string;
}

interface CloudLog {
  resource_id: string;
  timestamp: string;
  level: string;
  message: string;
}

export default function AzureHub() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState<CloudResource[]>([]);
  const [logs, setLogs] = useState<CloudLog[]>([]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetchApi("/api/v1/cloud/resources").catch(() => []),
      fetchApi("/api/v1/cloud/logs").catch(() => [])
    ]).then(([resData, logsData]) => {
      // Filter for Azure resources only
      const azureResources = Array.isArray(resData) ? resData.filter(r => r.provider === "Azure") : [];
      setResources(azureResources);
      
      const azureResourceIds = new Set(azureResources.map(r => r.id));
      const azureLogs = Array.isArray(logsData) ? logsData.filter(l => azureResourceIds.has(l.resource_id)) : [];
      setLogs(azureLogs);
      
      setLoading(false);
    });
  };

  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchData();
  }, [router]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Activity className="animate-spin text-sky-500 w-8 h-8" />
        </div>
      </DashboardLayout>
    );
  }

  const getResourceIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes("virtualmachine") || t.includes("compute")) return <Server size={18} />;
    if (t.includes("database") || t.includes("sql") || t.includes("storage")) return <Database size={18} />;
    if (t.includes("web") || t.includes("app")) return <AppWindow size={18} />;
    return <Hexagon size={18} />;
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-6 font-sans">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold tracking-wide text-white flex items-center gap-2">
              <Cloud className="text-sky-400" /> Azure Hub
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Comprehensive telemetry, infrastructure state, and operational logs for your Azure environment.
            </p>
          </div>
          <button
            onClick={() => fetchData()}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg transition-colors border border-slate-700"
          >
            <RefreshCw size={14} /> Refresh Data
          </button>
        </div>

        {/* Top Section: Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel border border-slate-800 rounded-xl p-5 flex flex-col justify-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total Azure Resources</span>
            <div className="text-3xl font-bold text-white">{resources.length}</div>
          </div>
          <div className="glass-panel border border-slate-800 rounded-xl p-5 flex flex-col justify-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Active Services</span>
            <div className="text-3xl font-bold text-emerald-400">
              {resources.filter(r => r.status.toLowerCase() === 'active' || r.status.toLowerCase() === 'running').length}
            </div>
          </div>
          <div className="glass-panel border border-slate-800 rounded-xl p-5 flex flex-col justify-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Recent Anomalies/Alerts</span>
            <div className="text-3xl font-bold text-rose-400">
              {logs.filter(l => l.level === 'ERROR' || l.level === 'WARNING').length}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 items-start">
          {/* Left Column: Resources Table */}
          <div className="glass-panel rounded-xl border border-slate-800/80 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-800 bg-black/30 flex justify-between items-center">
              <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase flex items-center gap-2">
                <Server size={14} className="text-sky-400" /> Discovered Resources
              </h3>
            </div>
            
            {resources.length === 0 ? (
              <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                <Cloud size={32} className="opacity-30 mb-3" />
                <p className="text-sm">No Azure resources synchronized.</p>
                <p className="text-xs mt-1">Check your integration credentials.</p>
              </div>
            ) : (
              <div className="divide-y divide-border bg-background/20 max-h-[500px] overflow-y-auto">
                {resources.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((r, i) => (
                  <div key={i} className="p-4 flex justify-between items-center hover:bg-white/[0.04] transition-colors group cursor-default">
                    <div className="flex items-start gap-3 overflow-hidden pr-4">
                      <div className="p-2 bg-slate-800 rounded-md text-sky-400 shrink-0 mt-0.5">
                        {getResourceIcon(r.type)}
                      </div>
                      <div className="truncate">
                        <h4 className="font-semibold text-sm text-slate-200 truncate" title={r.name}>{r.name}</h4>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase tracking-wider">{r.type}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{r.region}</span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-semibold border flex items-center gap-1.5 shadow-sm capitalize ${
                        r.status.toLowerCase() === 'active' || r.status.toLowerCase() === 'running'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : r.status.toLowerCase() === 'unknown'
                        ? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {r.status.toLowerCase() === 'active' || r.status.toLowerCase() === 'running' ? <CheckCircle size={10} /> : <Activity size={10} />}
                        {r.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Pagination Controls */}
            {resources.length > itemsPerPage && (
              <div className="p-3 border-t border-border bg-black/10 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                  {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, resources.length)} of {resources.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2 py-1 rounded bg-card border border-border text-[10px] font-semibold text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5 transition-colors"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => (p * itemsPerPage < resources.length ? p + 1 : p))}
                    disabled={currentPage * itemsPerPage >= resources.length}
                    className="px-2 py-1 rounded bg-card border border-border text-[10px] font-semibold text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Telemetry Logs */}
          <div className="glass-panel rounded-xl border border-slate-800/80 overflow-hidden flex flex-col max-h-[550px]">
            <div className="p-4 border-b border-slate-800 bg-black/30 flex justify-between items-center">
              <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase flex items-center gap-2">
                <Activity size={14} className="text-indigo-400" /> Operational Log Feed
              </h3>
            </div>
            
            {logs.length === 0 ? (
              <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                <Activity size={32} className="opacity-30 mb-3" />
                <p className="text-sm">No recent telemetry logs.</p>
              </div>
            ) : (
              <div className="divide-y divide-border bg-background/20 overflow-y-auto">
                {logs.map((log, idx) => {
                  const resource = resources.find(r => r.id === log.resource_id);
                  const isError = log.level === "ERROR" || log.level === "CRITICAL" || log.level === "FATAL";
                  const isWarning = log.level === "WARNING" || log.level === "WARN";

                  return (
                    <div key={idx} className="p-4 hover:bg-white/[0.02] transition-colors flex flex-col space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          {isError ? <AlertCircle size={14} className="text-rose-400 shrink-0" /> 
                           : isWarning ? <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                           : <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                          }
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            isError ? 'bg-rose-500/10 text-rose-400' 
                            : isWarning ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {log.level}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      
                      <p className="text-sm text-slate-300 leading-relaxed font-mono mt-1 break-words">
                        {log.message}
                      </p>
                      
                      <div className="mt-2 text-[10px] text-slate-500 font-mono truncate bg-black/20 p-1.5 rounded inline-block max-w-max">
                        Ref: {resource ? resource.name : log.resource_id.split('/').pop()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
