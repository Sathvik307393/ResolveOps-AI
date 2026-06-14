"use client";

import React, { useState } from "react";
import { Activity, AlertTriangle, CheckCircle, Clock, Cpu, HardDrive, Layout, Server, ShieldAlert, Sparkles, XCircle, AlertCircle } from "lucide-react";
import MarkdownRenderer from "@/components/common/MarkdownRenderer";
import { fetchApi } from "@/lib/api";

export default function AksWorkloadSummary({ k8sData, clusterId }) {
  const [analyzingRisk, setAnalyzingRisk] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState({});

  if (!k8sData || !k8sData.enabled) {
    return (
      <div className="glass-panel p-8 rounded-xl border border-rose-500/30 bg-rose-500/5 mb-8">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-rose-500/20 rounded-full text-rose-400">
            <XCircle size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Kubernetes Connection Failed</h3>
            <p className="text-sm text-slate-300 mb-4">{k8sData?.message || "Failed to establish connection to the Kubernetes API server."}</p>
            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-lg">
              <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2">Recommended Action</h4>
              <p className="text-sm text-rose-300/80">{k8sData?.recommended_action || "Check cluster permissions and network connectivity."}</p>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-4">Reason: {k8sData?.reason || "unknown"}</p>
          </div>
        </div>
      </div>
    );
  }

  const { summary, namespaces, nodes, pods, deployments, services, events, risks } = k8sData;

  const handleAnalyzeRisk = async (risk, index) => {
    if (aiAnalysis[index]) return;
    setAnalyzingRisk(index);
    try {
      const result = await fetchApi("/api/v1/ai/analyze-failure", {
        method: "POST",
        body: JSON.stringify({
          log_message: `AKS Workload Risk: ${risk.type} on ${risk.resource} in namespace ${risk.namespace}. Evidence: ${risk.evidence}. Recommendation: ${risk.recommendation}`,
          resource_id: clusterId
        })
      });
      setAiAnalysis(prev => ({ ...prev, [index]: result.analysis }));
    } catch (err) {
      setAiAnalysis(prev => ({ ...prev, [index]: "Failed to generate AKS RCA." }));
    } finally {
      setAnalyzingRisk(null);
    }
  };

  return (
    <div className="space-y-8 mb-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <Layout className="text-emerald-400" size={28} />
        <h2 className="text-2xl font-bold text-white">Kubernetes Workloads</h2>
        <span className="ml-auto px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold uppercase tracking-widest rounded-full">Connected</span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 uppercase font-bold">Namespaces</p>
            <p className="text-2xl text-white font-bold">{summary.namespaces}</p>
          </div>
          <Layout className="text-slate-600" size={24} />
        </div>
        <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 uppercase font-bold">Nodes</p>
            <p className="text-2xl text-white font-bold">{summary.nodes}</p>
          </div>
          <Server className="text-sky-600" size={24} />
        </div>
        <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 uppercase font-bold">Total Pods</p>
            <p className="text-2xl text-white font-bold">{summary.pods}</p>
          </div>
          <Cpu className="text-indigo-600" size={24} />
        </div>
        <div className="glass-panel p-4 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 uppercase font-bold">Deployments</p>
            <p className="text-2xl text-white font-bold">{summary.deployments}</p>
          </div>
          <HardDrive className="text-emerald-600" size={24} />
        </div>
      </div>

      {/* Pod Status Bar */}
      <div className="glass-panel p-5 rounded-xl border border-slate-800">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-4">Pod Health</h3>
        <div className="flex gap-2 h-4 rounded-full overflow-hidden mb-3">
          {summary.running_pods > 0 && <div style={{ width: `${(summary.running_pods / summary.pods) * 100}%` }} className="bg-emerald-500" title={`Running: ${summary.running_pods}`} />}
          {summary.pending_pods > 0 && <div style={{ width: `${(summary.pending_pods / summary.pods) * 100}%` }} className="bg-amber-500" title={`Pending: ${summary.pending_pods}`} />}
          {summary.failed_pods > 0 && <div style={{ width: `${(summary.failed_pods / summary.pods) * 100}%` }} className="bg-rose-500" title={`Failed: ${summary.failed_pods}`} />}
        </div>
        <div className="flex gap-6 text-xs font-bold text-slate-400">
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Running: {summary.running_pods}</span>
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500" /> Pending: {summary.pending_pods}</span>
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500" /> Failed: {summary.failed_pods}</span>
        </div>
      </div>

      {/* AKS Risks Panel */}
      {risks && risks.length > 0 && (
        <div className="glass-panel p-6 rounded-xl border border-rose-500/30 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><ShieldAlert className="text-rose-500" /> Detected Workload Risks</h3>
          <div className="space-y-4">
            {risks.map((risk, idx) => (
              <div key={idx} className="bg-black/40 border border-slate-800 p-4 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      risk.severity === 'critical' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                      risk.severity === 'high' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                      'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {risk.severity}
                    </span>
                    <h4 className="text-white font-bold text-sm">{risk.type} on {risk.resource}</h4>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">{risk.namespace}</span>
                </div>
                <p className="text-sm text-slate-300 mb-2 font-mono bg-slate-900/50 p-2 rounded">{risk.evidence}</p>
                <p className="text-xs text-slate-400 mb-4">Recommendation: {risk.recommendation}</p>
                
                <div className="pt-3 border-t border-slate-800">
                  {!aiAnalysis[idx] ? (
                    <button
                      onClick={() => handleAnalyzeRisk(risk, idx)}
                      disabled={analyzingRisk === idx}
                      className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                      {analyzingRisk === idx ? <><Activity size={12} className="animate-spin" /> Generating RCA...</> : <><Sparkles size={12} /> Generate AKS RCA</>}
                    </button>
                  ) : (
                    <div className="bg-indigo-500/5 rounded-lg border border-indigo-500/20 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="text-indigo-400" size={14} />
                        <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">AI Root Cause Analysis</span>
                      </div>
                      <div className="prose prose-invert prose-sm max-w-none">
                        <MarkdownRenderer content={aiAnalysis[idx]} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nodes Table */}
      <div className="glass-panel p-6 rounded-xl border border-slate-800">
        <h3 className="text-lg font-bold text-white mb-4">Cluster Nodes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-500 font-bold">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Node Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Instance / OS</th>
                <th className="px-4 py-3 rounded-tr-lg">Capacity (CPU/Mem)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {nodes.map((n, i) => (
                <tr key={i} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{n.name}</td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1.5 ${n.ready_status === 'True' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {n.ready_status === 'True' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      {n.ready_status === 'True' ? 'Ready' : 'NotReady'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{n.kubernetes_version}</td>
                  <td className="px-4 py-3 text-xs">
                    <div>{n.instance_type}</div>
                    <div className="text-[10px] text-slate-500">{n.os_image}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{n.cpu_capacity} / {n.memory_capacity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pods Table */}
      <div className="glass-panel p-6 rounded-xl border border-slate-800">
        <h3 className="text-lg font-bold text-white mb-4">Running Pods</h3>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-500 font-bold sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Namespace</th>
                <th className="px-4 py-3">Pod Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Node</th>
                <th className="px-4 py-3">Restarts</th>
                <th className="px-4 py-3 rounded-tr-lg">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {pods.map((p, i) => (
                <tr key={i} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-xs text-slate-400">{p.namespace}</td>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-slate-200">{p.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      p.status === 'Running' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      p.status === 'Pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-500 truncate max-w-[150px]" title={p.node_name}>{p.node_name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${p.restart_count > 0 ? (p.restart_count > 5 ? 'text-rose-400 bg-rose-500/10' : 'text-amber-400 bg-amber-500/10') : 'text-slate-500'}`}>
                      {p.restart_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-500">
                    {p.start_time ? new Date(p.start_time).toLocaleDateString() : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deployments Table */}
      <div className="glass-panel p-6 rounded-xl border border-slate-800">
        <h3 className="text-lg font-bold text-white mb-4">Deployments</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-500 font-bold">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Namespace</th>
                <th className="px-4 py-3">Deployment</th>
                <th className="px-4 py-3">Desired</th>
                <th className="px-4 py-3">Available</th>
                <th className="px-4 py-3">Unavailable</th>
                <th className="px-4 py-3 rounded-tr-lg">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {deployments.map((d, i) => (
                <tr key={i} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-xs text-slate-400">{d.namespace}</td>
                  <td className="px-4 py-3 font-mono text-xs font-bold text-slate-200">{d.name}</td>
                  <td className="px-4 py-3 text-xs">{d.desired_replicas}</td>
                  <td className="px-4 py-3 text-xs text-emerald-400">{d.available_replicas}</td>
                  <td className="px-4 py-3 text-xs text-rose-400">{d.unavailable_replicas}</td>
                  <td className="px-4 py-3">
                    {d.unavailable_replicas > 0 ? (
                      <span className="text-rose-400 flex items-center gap-1 text-[10px] uppercase font-bold"><AlertTriangle size={12} /> Degraded</span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1 text-[10px] uppercase font-bold"><CheckCircle size={12} /> Healthy</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Events Panel */}
      {events && events.length > 0 && (
        <div className="glass-panel p-6 rounded-xl border border-slate-800">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Clock className="text-amber-400" /> Recent Warning Events</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {events.map((e, i) => (
              <div key={i} className="bg-black/30 p-3 rounded-lg border border-slate-800/50 flex items-start gap-3">
                <AlertCircle className="text-amber-500 mt-0.5" size={16} shrink-0 />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold text-slate-200">{e.reason}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{e.last_timestamp ? new Date(e.last_timestamp).toLocaleString() : ''}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mb-1">{e.involved_object} <span className="text-slate-600">({e.namespace})</span></p>
                  <p className="text-xs text-slate-300">{e.message}</p>
                </div>
                <div className="bg-slate-800 text-[10px] px-2 py-0.5 rounded text-slate-400 font-bold">x{e.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

