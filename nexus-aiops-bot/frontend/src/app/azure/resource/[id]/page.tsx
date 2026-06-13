"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { fetchApi } from "@/lib/api";
import { Activity, AlertCircle, ArrowLeft, Cpu, Hexagon, Info, Server, Sparkles, AlertTriangle } from "lucide-react";
import MarkdownRenderer from "@/components/MarkdownRenderer";

interface ResourceDetails {
  id: string;
  name: string;
  type: string;
  location: string;
  tags?: Record<string, string>;
  tenant_id?: string;
  user_email?: string;
}

interface ActivityLog {
  id: string;
  operationName: string;
  status: string;
  eventTimestamp: string;
  level: string;
  description: string;
}

export default function ResourceDetailsPage() {
  const params = useParams();
  const router = useRouter();
  
  const rawId = params.id as string;
  const resourceId = decodeURIComponent(rawId);
  
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<ResourceDetails | null>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  
  const [analyzingLogId, setAnalyzingLogId] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!resourceId) return;
    
    Promise.all([
      fetchApi(`/api/v1/cloud/azure/resource?resource_id=${encodeURIComponent(resourceId)}`).catch(() => ({ details: null, children: [] })),
      fetchApi(`/api/v1/cloud/azure/activity?resource_id=${encodeURIComponent(resourceId)}`).catch(() => [])
    ]).then(([resData, activityData]) => {
      if (resData.details) {
        setDetails({
          ...resData.details,
          tenant_id: resData.tenant_id,
          user_email: resData.user_email
        });
        setChildren(resData.children || []);
      }
      setActivities(Array.isArray(activityData) ? activityData : []);
      setLoading(false);
    });
  }, [resourceId]);

  const handleAnalyzeFailure = async (log: ActivityLog) => {
    if (aiAnalysis[log.id]) return; // Already analyzed
    
    setAnalyzingLogId(log.id);
    try {
      const result = await fetchApi("/api/v1/ai/analyze-failure", {
        method: "POST",
        body: JSON.stringify({
          log_message: log.description || log.operationName,
          resource_id: resourceId
        })
      });
      setAiAnalysis(prev => ({ ...prev, [log.id]: result.analysis }));
    } catch (err) {
      setAiAnalysis(prev => ({ ...prev, [log.id]: "Failed to analyze failure with AI Copilot." }));
    } finally {
      setAnalyzingLogId(null);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[70vh] flex items-center justify-center">
          <Activity className="animate-spin text-indigo-500 w-8 h-8" />
        </div>
      </DashboardLayout>
    );
  }

  if (!details) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full text-slate-400">
          Resource not found or failed to load.
        </div>
      </DashboardLayout>
    );
  }

  const isResourceGroup = details.type === "Resource Group";

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full font-sans pb-10 max-w-6xl mx-auto w-full">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 w-fit transition-colors"
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>

        <div className="glass-panel rounded-2xl p-8 mb-8 border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Hexagon size={120} />
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-bold px-2 py-1 rounded-md bg-indigo-500/20 text-indigo-400 uppercase tracking-wider">
                {details.type}
              </span>
              <span className="text-xs text-slate-500 font-mono bg-slate-900/50 px-2 py-1 rounded-md">
                {details.location}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">{details.name}</h1>
            
            <div className="flex items-center gap-2 mb-6">
              <span className="text-[11px] text-slate-400 bg-slate-800/80 px-2 py-1 rounded border border-slate-700/50">
                Connected User: <strong className="text-slate-200">{details.user_email || "Unknown"}</strong>
              </span>
              <span className="text-[11px] text-slate-400 bg-slate-800/80 px-2 py-1 rounded border border-slate-700/50">
                Tenant: <strong className="text-slate-200">{details.tenant_id ? details.tenant_id.substring(0, 8) + "..." : "Unknown"}</strong>
              </span>
            </div>
            
            {details.tags && Object.keys(details.tags).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(details.tags).map(([k, v]) => (
                  <span key={k} className="text-[11px] text-slate-400 bg-slate-800 px-2 py-1 rounded border border-slate-700">
                    <span className="text-slate-500">{k}:</span> {v}
                  </span>
                ))}
              </div>
            )}
            
            <div className="mt-4 text-xs text-slate-600 font-mono break-all">
              {details.id}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Activity className="text-sky-400" /> Activity Logs & Failures
            </h3>
            
            {activities.length === 0 ? (
              <div className="glass-panel p-8 rounded-xl text-center text-slate-400 border border-slate-800">
                No recent activity logs found for this resource.
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((log) => {
                  const isFailure = log.status === "Failed" || log.level === "Error";
                  return (
                    <div key={log.id} className={`glass-panel p-5 rounded-xl border ${isFailure ? 'border-red-500/30 bg-red-500/5' : 'border-slate-800'}`}>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          {isFailure ? <AlertCircle className="text-red-400" size={18} /> : <Info className="text-sky-400" size={18} />}
                          <h4 className="text-white font-semibold">{log.operationName}</h4>
                        </div>
                        <span className="text-xs text-slate-500 font-mono">
                          {log.eventTimestamp ? new Date(log.eventTimestamp).toLocaleString() : 'Unknown Time'}
                        </span>
                      </div>
                      
                      <div className="text-sm text-slate-300 bg-slate-900/50 p-3 rounded border border-slate-800/50 mb-3 font-mono">
                        {log.description || "No detailed description provided."}
                      </div>

                      {isFailure && (
                        <div className="mt-4 pt-4 border-t border-red-500/20">
                          {!aiAnalysis[log.id] ? (
                            <button
                              onClick={() => handleAnalyzeFailure(log)}
                              disabled={analyzingLogId === log.id}
                              className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
                            >
                              {analyzingLogId === log.id ? (
                                <><Activity size={16} className="animate-spin" /> Analyzing with AI...</>
                              ) : (
                                <><Sparkles size={16} /> Analyze Failure with AI Copilot</>
                              )}
                            </button>
                          ) : (
                            <div className="bg-slate-900/80 rounded-xl border border-indigo-500/30 overflow-hidden relative">
                              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500"></div>
                              <div className="p-4 bg-indigo-500/5 border-b border-indigo-500/10 flex items-center gap-2">
                                <Sparkles className="text-indigo-400" size={18} />
                                <span className="font-bold text-indigo-300">AI Copilot Analysis</span>
                              </div>
                              <div className="p-5 prose prose-invert prose-sm max-w-none prose-headings:text-indigo-300 prose-a:text-sky-400">
                                <MarkdownRenderer content={aiAnalysis[log.id]} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Server className="text-emerald-400" /> 
              {isResourceGroup ? "Child Resources" : "Related Information"}
            </h3>
            
            {isResourceGroup ? (
              children.length === 0 ? (
                <div className="glass-panel p-6 rounded-xl text-center text-slate-400 border border-slate-800 text-sm">
                  This resource group is currently empty.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {children.map(child => {
                    const isCompute = child.type.includes("VirtualMachines") || child.type.includes("managedClusters");
                    const ChildIcon = isCompute ? Cpu : Hexagon;
                    return (
                      <div key={child.id} className="glass-panel p-4 rounded-xl border border-slate-800 flex items-start gap-3 hover:border-slate-700 transition-colors cursor-pointer" onClick={() => router.push(`/azure/resource/${encodeURIComponent(child.id)}`)}>
                        <div className="p-2 rounded bg-slate-800 text-slate-300">
                          <ChildIcon size={16} />
                        </div>
                        <div className="overflow-hidden">
                          <h5 className="text-white text-sm font-medium truncate">{child.name}</h5>
                          <p className="text-[10px] text-slate-500 uppercase mt-1 truncate">{child.type.split('/').pop()}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="glass-panel p-6 rounded-xl border border-slate-800">
                <div className="flex items-start gap-3 mb-4">
                  <AlertTriangle className="text-amber-400 shrink-0" size={20} />
                  <p className="text-sm text-slate-300">
                    To view deeper application logs, metrics, and terminal access for this specific resource, use the <strong>Azure Hub</strong> directly.
                  </p>
                </div>
                <button 
                  onClick={() => router.push("/azure")}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                >
                  Go to Azure Hub
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
