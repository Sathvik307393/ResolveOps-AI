"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { GitBranch, User, Clock, CheckCircle, XCircle, AlertCircle, Activity, RefreshCw, Bot, Terminal, Play } from "lucide-react";
import { fetchApi } from "@/lib/api";

interface DeploymentEvent {
  commit_sha: string;
  commit_msg: string;
  author: string;
  repository: string;
  workflow_name?: string;
  workflow_run_id?: string;
  timestamp: string;
  status?: string;
  conclusion?: string;
}

export default function GitHubDeployments() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [deployments, setDeployments] = useState<DeploymentEvent[]>([]);
  const [diagnoseModal, setDiagnoseModal] = useState<{ isOpen: boolean, data?: any, loading?: boolean }>({ isOpen: false });
  const [liveModal, setLiveModal] = useState<{ isOpen: boolean, repo?: string, run_id?: string, data?: any, loading?: boolean }>({ isOpen: false });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleRunPipeline = async (repository: string, workflow_run_id: string) => {
    try {
      const res = await fetch("/api/v1/github/workflows/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("jwt_token")}`,
        },
        body: JSON.stringify({ repository, workflow_id: workflow_run_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to run pipeline");
      alert(data.message || "Pipeline triggered successfully");
      fetchData(); // Refresh UI
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDiagnose = async (repository: string, workflow_run_id: string) => {
    setDiagnoseModal({ isOpen: true, loading: true });
    try {
      const data = await fetchApi("/api/v1/github/diagnose", {
        method: "POST",
        body: JSON.stringify({ repository, workflow_run_id }),
      });
      setDiagnoseModal({ isOpen: true, loading: false, data });
    } catch (error: any) {
      const errMsg = typeof error.message === 'string' ? error.message : JSON.stringify(error);
      setDiagnoseModal({ isOpen: true, loading: false, data: { diagnosis: errMsg || "Error communicating with diagnosis engine." } });
    }
  };

  const fetchLiveStatus = async (repo: string, run_id: string) => {
    try {
      const res = await fetch(`/api/v1/github/workflow_status/${repo}/${run_id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("jwt_token")}` }
      });
      const data = await res.json();
      if (data.status === "success") {
        setLiveModal(prev => ({ ...prev, data: data.data, loading: false }));
      }
    } catch (error) {
      console.error("Failed to fetch live status");
    }
  };

  const handleLiveView = (repository: string, workflow_run_id: string) => {
    setLiveModal({ isOpen: true, repo: repository, run_id: workflow_run_id, loading: true });
    fetchLiveStatus(repository, workflow_run_id);
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

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (liveModal.isOpen && liveModal.repo && liveModal.run_id) {
      interval = setInterval(() => {
        fetchLiveStatus(liveModal.repo!, liveModal.run_id!);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [liveModal.isOpen, liveModal.repo, liveModal.run_id]);

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
            <div className="p-16 text-center flex flex-col items-center justify-center text-slate-500 text-sm bg-card rounded-b-xl">
              <GitBranch className="w-10 h-10 text-slate-600 mb-4 opacity-50" />
              <p className="font-semibold text-slate-300">No deployment logs synchronized yet</p>
              <p className="text-xs text-slate-500 mt-2 max-w-sm">
                Add the Nexus Action workflow template to your repositories to log CI/CD triggers directly onto your dashboard.
              </p>
            </div>
          ) : (
            <div className="flex flex-col bg-card rounded-b-xl overflow-hidden">
              {/* Header Row */}
              <div className="grid grid-cols-12 gap-4 p-4 border-b border-border bg-black/10 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <div className="col-span-3">Repository / Pipeline</div>
                <div className="col-span-2">Commit SHA</div>
                <div className="col-span-3">Message</div>
                <div className="col-span-2">Workflow Sync</div>
                <div className="col-span-2 text-right">Timestamp</div>
              </div>

              {/* Data Rows */}
              <div className="divide-y divide-border bg-background/20">
                {deployments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((deploy, i) => {
                  const repoParts = deploy.repository.split('/');
                  const repoOwner = repoParts[0];
                  const repoName = repoParts[1] || deploy.repository;

                  return (
                    <div key={i} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-white/[0.04] transition-colors group cursor-default">
                      {/* Repo */}
                      <div className="col-span-3 flex flex-col justify-center truncate pr-2">
                        <a
                          href={`https://github.com/${deploy.repository}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-sm text-slate-200 group-hover:text-primary transition-colors hover:underline flex items-center gap-1.5"
                        >
                          <GitBranch size={14} className="text-indigo-400" />
                          {repoName}
                        </a>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 ml-5">
                          {repoOwner}
                        </span>
                        <span className="text-[10px] text-indigo-400 mt-1 ml-5 truncate" title={deploy.workflow_name}>
                          Pipeline: {deploy.workflow_name || "Unknown"}
                        </span>
                      </div>

                      {/* Commit SHA & Author */}
                      <div className="col-span-2 flex flex-col justify-center">
                        <span className="font-mono text-xs text-slate-400 group-hover:text-primary transition-colors">
                          {deploy.commit_sha ? deploy.commit_sha.substring(0, 7) : "unknown"}
                        </span>
                        <div className="flex items-center space-x-1.5 mt-1 text-[10px] text-slate-500">
                          <User size={10} />
                          <span className="truncate" title="Commit Author">{deploy.author}</span>
                        </div>
                      </div>

                      {/* Message */}
                      <div className="col-span-3 text-xs text-slate-300 truncate pr-4">
                        {deploy.commit_msg || "Commit push"}
                      </div>

                      {/* Workflow Sync Status */}
                      <div className="col-span-2 flex flex-wrap items-center gap-2">
                        {deploy.status === "in_progress" || deploy.status === "queued" ? (
                          <span className="bg-amber-500/10 text-amber-500 px-2.5 py-1 rounded-md text-[10px] font-semibold border border-amber-500/20 flex items-center gap-1.5 shadow-sm">
                            <Activity size={12} className="animate-spin" /> {deploy.status === "queued" ? "Queued" : "Running"}
                          </span>
                        ) : deploy.conclusion === "failure" ? (
                          <span className="bg-rose-500/10 text-rose-500 px-2.5 py-1 rounded-md text-[10px] font-semibold border border-rose-500/20 flex items-center gap-1.5 shadow-sm">
                            <XCircle size={12} /> Failed
                          </span>
                        ) : (
                          <span className="bg-emerald-500/10 text-emerald-500 px-2.5 py-1 rounded-md text-[10px] font-semibold border border-emerald-500/20 flex items-center gap-1.5 shadow-sm">
                            <CheckCircle size={12} /> Complete
                          </span>
                        )}

                        {deploy.workflow_run_id && deploy.workflow_run_id !== "PAT_SYNC" && (
                          <div className="flex items-center gap-1.5 mt-1 w-full">
                            <button
                              onClick={() => handleLiveView(deploy.repository, deploy.workflow_run_id!)}
                              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-[9px] font-semibold border border-emerald-500/30 transition-all flex items-center gap-1 hover:shadow-md"
                            >
                              <Activity size={10} /> Live View
                            </button>

                            {deploy.conclusion === "failure" && (
                              <button
                                onClick={() => handleDiagnose(deploy.repository, deploy.workflow_run_id!)}
                                className="bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 rounded text-[9px] font-semibold border border-primary/30 transition-all flex items-center gap-1 hover:shadow-md"
                              >
                                <Bot size={10} /> Diagnose
                              </button>
                            )}

                            <button
                              onClick={() => handleRunPipeline(deploy.repository, deploy.workflow_run_id!)}
                              className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded text-[9px] font-semibold border border-indigo-500/30 transition-all flex items-center gap-1 hover:shadow-md"
                            >
                              <Play size={10} /> Run
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="col-span-2 text-right text-[11px] text-slate-500 font-mono">
                        {deploy.timestamp ? new Date(deploy.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "just now"}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pagination Controls */}
              {deployments.length > itemsPerPage && (
                <div className="p-4 border-t border-border bg-black/10 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, deployments.length)} of {deployments.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded bg-card border border-border text-xs font-semibold text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-slate-400 font-mono px-2">Page {currentPage}</span>
                    <button
                      onClick={() => setCurrentPage(p => (p * itemsPerPage < deployments.length ? p + 1 : p))}
                      disabled={currentPage * itemsPerPage >= deployments.length}
                      className="px-3 py-1.5 rounded bg-card border border-border text-xs font-semibold text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Diagnosis Modal */}
      {diagnoseModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 font-sans animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border bg-black/20 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Bot className="text-primary" size={20} />
                <h3 className="font-bold text-slate-100 tracking-wide">Nexus AI Diagnostics</h3>
              </div>
              <button
                onClick={() => setDiagnoseModal({ isOpen: false })}
                className="text-slate-500 hover:text-slate-300 transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-md"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-background/50">
              {diagnoseModal.loading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                  <Activity size={32} className="text-primary animate-spin" />
                  <p className="text-slate-400 text-sm font-medium">Nexus AI is analyzing raw GitHub Actions logs...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {diagnoseModal.data?.job_name && (
                    <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Failed Job</h4>
                      <p className="text-slate-200 font-mono text-sm">{diagnoseModal.data.job_name}</p>
                    </div>
                  )}

                  <div className="bg-primary/5 p-5 rounded-lg border border-primary/20 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/50"></div>
                    <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Bot size={14} /> AI Root Cause & Prediction
                    </h4>
                    <div className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
                      {diagnoseModal.data?.diagnosis}
                    </div>
                  </div>

                  {diagnoseModal.data?.raw_logs && (
                    <div className="bg-[#0a0a0a] p-4 rounded-lg border border-border shadow-inner">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Terminal size={14} /> Log Snippet
                      </h4>
                      <pre className="text-rose-400/90 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-tight p-2 bg-black/50 rounded">
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

      {/* Live Status Modal */}
      {liveModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 font-sans animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border bg-black/20 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Activity className="text-emerald-500 animate-pulse" size={20} />
                <h3 className="font-bold text-slate-100 tracking-wide">Live Pipeline Status</h3>
              </div>
              <button
                onClick={() => setLiveModal({ isOpen: false })}
                className="text-slate-500 hover:text-slate-300 transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-md"
              >
                <XCircle size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-background/50">
              {liveModal.loading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                  <Activity size={32} className="text-emerald-500 animate-spin" />
                  <p className="text-slate-400 text-sm font-medium">Fetching real-time pipeline status from GitHub...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-card p-4 rounded-lg border border-border shadow-sm flex justify-between items-center">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Repository</h4>
                      <p className="text-slate-200 font-mono text-sm">{liveModal.data?.repo}</p>
                    </div>
                    <div className="text-right">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Pipeline State</h4>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${liveModal.data?.status === 'completed' ? (liveModal.data?.conclusion === 'success' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500') : 'bg-amber-500/20 text-amber-500'}`}>
                        {liveModal.data?.status === 'completed' ? liveModal.data?.conclusion : liveModal.data?.status}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Jobs & Steps</h4>
                    {liveModal.data?.jobs?.length ? (
                      liveModal.data.jobs.map((job: any, jIdx: number) => (
                        <div key={jIdx} className="bg-black/20 p-4 rounded-lg border border-border">
                          <div className="flex items-center gap-2 mb-3">
                            {job.status === "in_progress" ? <Activity size={14} className="text-amber-500 animate-spin" /> :
                              job.conclusion === "success" ? <CheckCircle size={14} className="text-emerald-500" /> :
                                <XCircle size={14} className="text-rose-500" />}
                            <span className="font-semibold text-slate-300 text-sm">{job.name}</span>
                          </div>

                          <div className="ml-5 space-y-2 border-l border-slate-700/50 pl-4">
                            {job.steps?.map((step: any, sIdx: number) => (
                              <div key={sIdx} className="flex justify-between items-center group">
                                <div className="flex items-center gap-2">
                                  {step.status === "in_progress" ? <Activity size={10} className="text-amber-500 animate-spin" /> :
                                    step.conclusion === "success" ? <CheckCircle size={10} className="text-emerald-500" /> :
                                      step.conclusion === "skipped" ? <CheckCircle size={10} className="text-slate-600" /> :
                                        step.status === "queued" ? <Clock size={10} className="text-slate-500" /> :
                                          <XCircle size={10} className="text-rose-500" />}
                                  <span className={`text-xs ${step.status === "in_progress" ? "text-amber-400 font-medium" : "text-slate-400"}`}>{step.name}</span>
                                </div>
                                <span className="text-[10px] font-mono text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {step.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500 italic">No jobs found for this run.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
