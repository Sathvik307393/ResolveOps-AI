"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { Cloud, Server, Database, AppWindow, Hexagon, Activity, CheckCircle, AlertTriangle, AlertCircle, RefreshCw, Network, Zap } from "lucide-react";
import { fetchApi } from "@/lib/api";
import Link from "next/link";

export default function AzureHub() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [resources, setResources] = useState([]);
  const [logs, setLogs] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetchApi("/api/v1/cloud/resources").catch(() => []),
      fetchApi("/api/v1/cloud/logs").catch(() => [])
    ]).then(([resData, logsData]) => {
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
        <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <div className="absolute inset-0 bg-sky-500 blur-xl opacity-50 rounded-full animate-pulse"></div>
            <Activity className="animate-spin text-sky-400 w-12 h-12 relative z-10" />
          </div>
          <p className="text-slate-400 font-mono text-sm tracking-widest uppercase">Syncing Azure Environment...</p>
        </div>
      </DashboardLayout>
    );
  }

  const getResourceIcon = (type) => {
    if (!type) return <Hexagon size={18} />;
    const t = type.toLowerCase();
    if (t.includes("virtualmachine") || t.includes("compute")) return <Server size={18} />;
    if (t.includes("database") || t.includes("sql") || t.includes("storage")) return <Database size={18} />;
    if (t.includes("web") || t.includes("app")) return <AppWindow size={18} />;
    if (t.includes("network") || t.includes("vnet")) return <Network size={18} />;
    return <Hexagon size={18} />;
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-6 font-sans animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="relative rounded-3xl overflow-hidden glass-panel border border-slate-800/80 p-8 lg:p-10">
          <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-sky-600/10 rounded-full blur-[100px] -mr-40 -mt-40 pointer-events-none"></div>
          
          <div className="relative z-10 flex justify-between items-end">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-500/10 text-sky-400 text-xs font-bold uppercase tracking-wider rounded-full border border-sky-500/20 mb-4">
                <Cloud size={12} className="text-sky-400" /> Azure Intelligence
              </div>
              <h2 className="text-3xl font-bold tracking-wide text-white mb-2">
                Azure Platform Hub
              </h2>
              <p className="text-sm text-slate-400 max-w-xl">
                Comprehensive telemetry, infrastructure state, relationship graphs, and operational logs for your entire Azure environment.
              </p>
            </div>
            <button
              onClick={() => fetchData()}
              className="bg-white/5 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all border border-white/10 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] backdrop-blur-md"
            >
              <RefreshCw size={16} /> Sync Resources
            </button>
          </div>
        </div>

        {/* Top Section: Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel border border-slate-800 rounded-2xl p-6 flex flex-col justify-center relative overflow-hidden group hover:border-sky-500/30 transition-all cursor-default">
            <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-sky-500/20 duration-500"></div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Cloud size={14} className="text-sky-500" /> Total Resources
            </span>
            <div className="text-4xl font-black text-white tracking-tight">{resources.length}</div>
          </div>
          <div className="glass-panel border border-slate-800 rounded-2xl p-6 flex flex-col justify-center relative overflow-hidden group hover:border-emerald-500/30 transition-all cursor-default">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-emerald-500/20 duration-500"></div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <CheckCircle size={14} className="text-emerald-500" /> Active Services
            </span>
            <div className="text-4xl font-black text-emerald-400 tracking-tight">
              {resources.filter(r => (r.status || '').toLowerCase() === 'active' || (r.status || '').toLowerCase() === 'running').length}
            </div>
          </div>
          <div className="glass-panel border border-slate-800 rounded-2xl p-6 flex flex-col justify-center relative overflow-hidden group hover:border-rose-500/30 transition-all cursor-default">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-all group-hover:bg-rose-500/20 duration-500"></div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <AlertTriangle size={14} className="text-rose-500" /> Anomalies/Alerts
            </span>
            <div className="text-4xl font-black text-rose-400 tracking-tight">
              {logs.filter(l => l.level === 'ERROR' || l.level === 'WARNING').length}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 items-start">
          {/* Left Column: Resources Table */}
          <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-800 bg-black/30 flex justify-between items-center">
              <h3 className="text-sm font-bold tracking-wider text-white uppercase flex items-center gap-2">
                <Server size={16} className="text-sky-400" /> Discovered Resources
              </h3>
            </div>
            
            {resources.length === 0 ? (
              <div className="p-16 text-center text-slate-500 flex flex-col items-center">
                <Cloud size={40} className="opacity-30 mb-4" />
                <p className="text-sm font-semibold">No Azure resources synchronized.</p>
                <p className="text-xs mt-2">Connect your Service Principal in Integrations.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/50 bg-background/20 max-h-[500px] overflow-y-auto">
                {resources.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((r, i) => {
                  const formattedType = (r.type || '').replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase()) || 'Resource';
                  const rStatus = (r.status || 'unknown').toLowerCase();
                  
                  return (
                    <Link href={`/azure/resource/${encodeURIComponent(r.id)}`} key={i} className="p-4 flex justify-between items-center hover:bg-white/[0.04] transition-colors group cursor-pointer border-l-2 border-transparent hover:border-sky-500 block">
                      <div className="flex items-start gap-3 overflow-hidden pr-4">
                        <div className="p-2.5 bg-slate-800/80 rounded-lg border border-slate-700/50 text-sky-400 shrink-0 mt-0.5 group-hover:bg-sky-500/10 group-hover:border-sky-500/20 group-hover:text-sky-300 transition-colors shadow-sm">
                          {getResourceIcon(r.type)}
                        </div>
                        <div className="truncate flex flex-col justify-center">
                          <h4 className="font-semibold text-sm text-slate-200 truncate group-hover:text-white transition-colors" title={r.name}>{r.name}</h4>
                          <div className="flex items-center space-x-2 mt-1.5">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800/80 text-sky-200/70 border border-slate-700/50 uppercase tracking-widest">{formattedType}</span>
                            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1 before:content-['•'] before:text-slate-700 before:mr-1">{r.region}</span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold border flex items-center gap-1.5 shadow-sm capitalize tracking-wide ${
                          rStatus === 'active' || rStatus === 'running'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : rStatus === 'unknown'
                          ? 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {rStatus === 'active' || rStatus === 'running' ? <CheckCircle size={12} /> : <Activity size={12} />}
                          {r.status}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
            
            {resources.length > itemsPerPage && (
              <div className="p-4 border-t border-border bg-black/10 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">
                  Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, resources.length)} of {resources.length}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 rounded bg-card border border-border text-xs font-semibold text-slate-300 disabled:opacity-50 hover:bg-white/5 transition-colors">Prev</button>
                  <button onClick={() => setCurrentPage(p => (p * itemsPerPage < resources.length ? p + 1 : p))} disabled={currentPage * itemsPerPage >= resources.length} className="px-3 py-1.5 rounded bg-card border border-border text-xs font-semibold text-slate-300 disabled:opacity-50 hover:bg-white/5 transition-colors">Next</button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Telemetry Logs */}
          <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col max-h-[550px]">
            <div className="p-5 border-b border-slate-800 bg-black/30 flex justify-between items-center">
              <h3 className="text-sm font-bold tracking-wider text-white uppercase flex items-center gap-2">
                <Activity size={16} className="text-indigo-400" /> Operational Log Feed
              </h3>
            </div>
            
            {logs.length === 0 ? (
              <div className="p-16 text-center flex flex-col items-center justify-center text-slate-500 bg-background/20 h-full">
                <div className="relative">
                  <Activity size={40} className="text-slate-700/50 mb-4 animate-pulse relative z-10" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-slate-800/30 rounded-full blur-xl"></div>
                </div>
                <p className="font-semibold text-slate-400">No recent telemetry logs</p>
                <p className="text-xs text-slate-600 mt-2 max-w-[250px]">
                  When active operations or anomalies occur on your Azure resources, logs will stream here automatically.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border bg-background/20 overflow-y-auto">
                {logs.map((log, idx) => {
                  const resource = resources.find(r => r.id === log.resource_id);
                  const isError = log.level === "ERROR" || log.level === "CRITICAL" || log.level === "FATAL";
                  const isWarning = log.level === "WARNING" || log.level === "WARN";

                  return (
                    <div key={idx} className="p-5 hover:bg-white/[0.02] transition-colors flex flex-col space-y-2">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          {isError ? <AlertCircle size={14} className="text-rose-400 shrink-0" /> 
                           : isWarning ? <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                           : <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                          }
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
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
