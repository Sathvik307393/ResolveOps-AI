"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { GitBranch, User, Clock, CheckCircle, XCircle, AlertCircle, Activity, RefreshCw, Bot, Terminal } from "lucide-react";
import { fetchApi } from "@/lib/api";

interface DeploymentEvent {
  commit_sha: string;
  commit_msg: string;
  author: string;
  repository: string;
  workflow_run_id?: string;
  timestamp: string;
  status?: string;
  conclusion?: string;
}

export default function GitHubDeployments() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [deployments, setDeployments] = useState<DeploymentEvent[]>([]);
  const [diagnoseModal, setDiagnoseModal] = useState<{isOpen: boolean, data?: any, loading?: boolean}>({isOpen: false});

  const handleDiagnose = async (repository: string, workflow_run_id: string) => {
    setDiagnoseModal({ isOpen: true, loading: true });
    try {
      const res = await fetch("/api/v1/github/diagnose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("jwt_token")}`,
        },
        body: JSON.stringify({ repository, workflow_run_id }),
      });
      const data = await res.json();
      setDiagnoseModal({ isOpen: true, loading: false, data });
    } catch (error) {
      setDiagnoseModal({ isOpen: true, loading: false, data: { diagnosis: "Error communicating with diagnosis engine." } });
    }
  };

  const fetchData = (isBackground = false) => {
    if (!isBackground) setLoading(true);
    fetchApi("/api/v1/github/deployments")
      .then((data) => {
        setDeployments(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchData(); // Initial load

    // Auto-poll every 5 seconds for live tracking
    const interval = setInterval(() => {
      fetchData(true);
    }, 5000);

    return () => clearInterval(interval);
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Activity className="animate-spin text-indigo-500 w-8 h-8" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-6 font-sans">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold tracking-wide text-white">GitHub Deployment Sync</h2>
            <p className="text-sm text-slate-500 mt-1">
              Real-time tracking of runner builds, production releases, and code changes mapped to telemetry timelines.
            </p>
          </div>
          <button
            onClick={() => fetchData(false)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <RefreshCw size={14} /> Refresh Data
          </button>
        </div>

        {/* Timeline Table */}
        <div className="glass-panel rounded-xl border border-slate-800/80 overflow-hidden flex-1">
          <div className="p-4 border-b border-slate-800 bg-black/30 flex justify-between items-center">
            <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase">Recent Deployments</h3>
            <span className="bg-indigo-600/20 text-indigo-400 px-2 py-0.5 rounded text-[10px] font-bold">
              {deployments.length} Logged
            </span>
          </div>

          {deployments.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center text-slate-500 text-sm">
              <GitBranch className="w-12 h-12 text-slate-700 mb-4 animate-pulse" />
              <p className="font-semibold text-slate-300">No deployment logs synchronized yet</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Add the Nexus Action workflow template to your repositories to log CI/CD triggers directly onto your dashboard.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-black/20 text-slate-400 border-b border-slate-800">
                    <th className="p-4 font-semibold">Repository</th>
                    <th className="p-4 font-semibold">Commit SHA</th>
                    <th className="p-4 font-semibold">Message</th>
                    <th className="p-4 font-semibold">Author</th>
                    <th className="p-4 font-semibold">Workflow Sync</th>
                    <th className="p-4 font-semibold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {deployments.map((deploy, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors">
                      <td className="p-4 font-semibold text-white">{deploy.repository}</td>
                      <td className="p-4 font-mono text-xs text-indigo-300">
                        {deploy.commit_sha ? deploy.commit_sha.substring(0, 7) : "unknown"}
                      </td>
                      <td className="p-4 text-slate-300 max-w-xs truncate">{deploy.commit_msg || "Commit push"}</td>
                      <td className="p-4 text-slate-400 flex items-center space-x-1.5">
                        <User size={14} className="text-slate-500" />
                        <span>{deploy.author}</span>
                      </td>
                      <td className="p-4">
                        {deploy.status === "in_progress" || deploy.status === "queued" ? (
                          <span className="bg-amber-500/20 text-amber-400 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-amber-500/30 flex items-center w-fit gap-1">
                            <Activity size={10} className="animate-spin" /> {deploy.status === "queued" ? "Queued" : "Running"}
                          </span>
                        ) : deploy.conclusion === "failure" ? (
                          <div className="flex items-center gap-2">
                            <span className="bg-rose-500/20 text-rose-400 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-rose-500/30 flex items-center w-fit gap-1">
                              <XCircle size={10} /> Failed
                            </span>
                            {deploy.workflow_run_id && deploy.workflow_run_id !== "PAT_SYNC" && (
                              <button 
                                onClick={() => handleDiagnose(deploy.repository, deploy.workflow_run_id!)}
                                className="bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-500/30 transition-colors flex items-center gap-1"
                              >
                                <Bot size={10} /> Diagnose
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/30 flex items-center w-fit gap-1">
                            <CheckCircle size={10} /> Sync Complete
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-slate-500 font-mono text-xs">
                        {deploy.timestamp ? new Date(deploy.timestamp).toLocaleString() : "just now"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* AI Diagnosis Modal */}
      {diagnoseModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Bot className="text-indigo-400" size={20} />
                <h3 className="font-bold text-white tracking-wide">Nexus AI Diagnostics</h3>
              </div>
              <button 
                onClick={() => setDiagnoseModal({isOpen: false})}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <XCircle size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {diagnoseModal.loading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Activity size={32} className="text-indigo-500 animate-spin" />
                  <p className="text-slate-400 animate-pulse text-sm">Nexus AI is analyzing raw GitHub Actions logs...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {diagnoseModal.data?.job_name && (
                    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Failed Job</h4>
                      <p className="text-white font-mono text-sm">{diagnoseModal.data.job_name}</p>
                    </div>
                  )}
                  
                  <div className="bg-indigo-950/30 p-4 rounded-lg border border-indigo-900/50">
                    <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Bot size={14} /> AI Root Cause & Prediction
                    </h4>
                    <div className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
                      {diagnoseModal.data?.diagnosis}
                    </div>
                  </div>

                  {diagnoseModal.data?.raw_logs && (
                    <div className="bg-black p-4 rounded-lg border border-slate-800">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Terminal size={14} /> Log Snippet
                      </h4>
                      <pre className="text-rose-400 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                        {diagnoseModal.data.raw_logs}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
