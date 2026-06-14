"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import { GitBranch, User, Clock, CheckCircle, XCircle, AlertCircle, Activity, RefreshCw, Bot, Terminal, Play, Server } from "lucide-react";
import { fetchApi } from "@/lib/api";

export default function GitHubDeployments() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [deployments, setDeployments] = useState([]);
  const [diagnoseModal, setDiagnoseModal] = useState({ isOpen: false });
  const [liveModal, setLiveModal] = useState({ isOpen: false });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleRunPipeline = async (repository, workflow_run_id) => {
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
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDiagnose = async (repository, workflow_run_id) => {
    setDiagnoseModal({ isOpen: true, loading: true });
    try {
      const data = await fetchApi("/api/v1/github/diagnose", {
        method: "POST",
        body: JSON.stringify({ repository, workflow_run_id }),
      });
      setDiagnoseModal({ isOpen: true, loading: false, data });
    } catch (error) {
      const errMsg = typeof error.message === 'string' ? error.message : JSON.stringify(error);
      setDiagnoseModal({ isOpen: true, loading: false, data: { diagnosis: errMsg || "Error communicating with diagnosis engine." } });
    }
  };

  const fetchLiveStatus = async (repo, run_id) => {
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

  const handleLiveView = (repository, workflow_run_id) => {
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
    let interval;
    if (liveModal.isOpen && liveModal.repo && liveModal.run_id) {
      interval = setInterval(() => {
        fetchLiveStatus(liveModal.repo, liveModal.run_id);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [liveModal.isOpen, liveModal.repo, liveModal.run_id]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <div className="absolute inset-0 bg-purple-500 blur-xl opacity-50 rounded-full animate-pulse"></div>
            <Activity className="animate-spin text-purple-400 w-12 h-12 relative z-10" />
          </div>
          <p className="text-slate-400 font-mono text-sm tracking-widest uppercase">Syncing GitHub Repositories...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-6 font-sans animate-in fade-in duration-500 pb-10">
        
        {/* Header */}
        <div className="relative rounded-3xl overflow-hidden glass-panel border border-slate-800/80 p-8 lg:p-10">
          <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-purple-600/10 rounded-full blur-[100px] -mr-40 -mt-40 pointer-events-none"></div>
          
          <div className="relative z-10 flex justify-between items-end">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 text-purple-400 text-xs font-bold uppercase tracking-wider rounded-full border border-purple-500/20 mb-4">
                <GitBranch size={12} className="text-purple-400" /> Pipeline Intelligence
              </div>
              <h2 className="text-3xl font-bold tracking-wide text-white mb-2">
                GitHub Sync Hub
              </h2>
              <p className="text-sm text-slate-400 max-w-xl">
                Real-time tracking of runner builds, production releases, and code changes mapped directly to AI root cause analysis.
              </p>
            </div>
            <button
              onClick={() => fetchData(false)}
              className="bg-white/5 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all border border-white/10 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] backdrop-blur-md"
            >
              <RefreshCw size={16} /> Force Sync
            </button>
          </div>
        </div>

        {/* Timeline Table */}
        <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden flex-1 shadow-lg shadow-black/20">
          <div className="p-5 border-b border-slate-800 bg-black/30 flex justify-between items-center">
            <h3 className="text-sm font-bold tracking-wider text-white uppercase flex items-center gap-2">
              <GitBranch size={16} className="text-purple-400" /> Recent Deployments
            </h3>
            <span className="bg-purple-600/20 text-purple-400 px-3 py-1 rounded-full text-[10px] font-bold border border-purple-500/20">
              {deployments.length} Pipelines Logged
            </span>
          </div>

          {deployments.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center justify-center text-slate-500 bg-background/20 rounded-b-xl">
              <GitBranch className="w-16 h-16 text-slate-600 mb-4 opacity-50" />
              <p className="font-bold text-slate-300 text-lg">No pipeline logs synchronized yet</p>
              <p className="text-sm text-slate-500 mt-2 max-w-sm">
                Connect your PAT in the Integrations panel to view CI/CD triggers on your dashboard.
              </p>
            </div>
          ) : (
            <div className="flex flex-col bg-background/20 rounded-b-xl overflow-hidden">
              {/* Header Row */}
              <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-800/80 bg-black/40 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <div className="col-span-3 pl-2">Repository / Pipeline</div>
                <div className="col-span-2">Commit SHA</div>
                <div className="col-span-3">Message</div>
                <div className="col-span-2">Workflow Status</div>
                <div className="col-span-2 text-right pr-2">Timestamp</div>
              </div>

              {/* Data Rows */}
              <div className="divide-y divide-slate-800/50">
                {deployments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((deploy, i) => {
                  const repoParts = deploy.repository.split('/');
                  const repoOwner = repoParts[0];
                  const repoName = repoParts[1] || deploy.repository;

                  return (
                    <div key={i} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-white/[0.04] transition-colors group cursor-default">
                      {/* Repo */}
                      <div className="col-span-3 flex flex-col justify-center truncate pl-2">
                        <a
                          href={`https://github.com/${deploy.repository}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-sm text-slate-200 group-hover:text-purple-400 transition-colors hover:underline flex items-center gap-2"
                        >
                          <GitBranch size={14} className="text-purple-500" />
                          {repoName}
                        </a>
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1 ml-6">
                          {repoOwner}
                        </span>
                        <span className="text-[10px] text-purple-400/80 mt-1.5 ml-6 truncate" title={deploy.workflow_name}>
                          {deploy.workflow_name || "Unknown"}
                        </span>
                      </div>

                      {/* Commit SHA & Author */}
                      <div className="col-span-2 flex flex-col justify-center">
                        <span className="font-mono text-[11px] font-bold bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-slate-300 w-max group-hover:border-purple-500/30 transition-colors">
                          {deploy.commit_sha ? deploy.commit_sha.substring(0, 7) : "unknown"}
                        </span>
                        <div className="flex items-center space-x-1.5 mt-2 text-[10px] text-slate-500 font-medium">
                          <User size={12} className="text-slate-600" />
                          <span className="truncate" title="Commit Author">{deploy.author}</span>
                        </div>
                      </div>

                      {/* Message */}
                      <div className="col-span-3 text-[11px] text-slate-300 truncate pr-4 leading-relaxed font-mono">
                        {deploy.commit_msg || "Commit push"}
                      </div>

                      {/* Workflow Sync Status */}
                      <div className="col-span-2 flex flex-wrap items-center gap-2">
                        {deploy.status === "in_progress" || deploy.status === "queued" ? (
                          <span className="bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full text-[10px] font-bold border border-amber-500/20 flex items-center gap-1.5 shadow-sm">
                            <Activity size={12} className="animate-spin" /> {deploy.status === "queued" ? "Queued" : "Running"}
                          </span>
                        ) : deploy.conclusion === "failure" ? (
                          <span className="bg-rose-500/10 text-rose-400 px-2.5 py-1 rounded-full text-[10px] font-bold border border-rose-500/20 flex items-center gap-1.5 shadow-sm">
                            <XCircle size={12} /> Failed
                          </span>
                        ) : (
                          <span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-bold border border-emerald-500/20 flex items-center gap-1.5 shadow-sm">
                            <CheckCircle size={12} /> Complete
                          </span>
                        )}

                        {deploy.workflow_run_id && deploy.workflow_run_id !== "PAT_SYNC" && (
                          <div className="flex items-center gap-1.5 mt-2 w-full">
                            <button
                              onClick={() => handleLiveView(deploy.repository, deploy.workflow_run_id)}
                              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded text-[9px] font-bold border border-emerald-500/30 transition-all flex items-center gap-1 hover:shadow-md"
                            >
                              <Activity size={10} /> Live View
                            </button>

                            {deploy.conclusion === "failure" && (
                              <button
                                onClick={() => handleDiagnose(deploy.repository, deploy.workflow_run_id)}
                                className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 px-2 py-1 rounded text-[9px] font-bold border border-purple-500/30 transition-all flex items-center gap-1 hover:shadow-md"
                              >
                                <Bot size={10} /> Diagnose
                              </button>
                            )}

                            <button
                              onClick={() => handleRunPipeline(deploy.repository, deploy.workflow_run_id)}
                              className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded text-[9px] font-bold border border-indigo-500/30 transition-all flex items-center gap-1 hover:shadow-md"
                            >
                              <Play size={10} /> Rerun
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="col-span-2 text-right text-[11px] text-slate-500 font-mono pr-2">
                        {deploy.timestamp ? new Date(deploy.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "just now"}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pagination Controls */}
              {deployments.length > itemsPerPage && (
                <div className="p-4 border-t border-slate-800/50 bg-black/20 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, deployments.length)} of {deployments.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => (p * itemsPerPage < deployments.length ? p + 1 : p))}
                      disabled={currentPage * itemsPerPage >= deployments.length}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans animate-in fade-in duration-200">
          <div className="glass-panel border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-700 bg-black/40 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Bot className="text-purple-400" size={20} />
                </div>
                <h3 className="font-bold text-white tracking-wide text-lg">Nexus AI RCA Report</h3>
              </div>
              <button
                onClick={() => setDiagnoseModal({ isOpen: false })}
                className="text-slate-500 hover:text-white transition-colors bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 p-2 rounded-lg"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-background/50 space-y-6">
              {diagnoseModal.loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <Activity size={40} className="text-purple-500 animate-spin mb-2" />
                  <p className="text-slate-300 font-bold text-lg">Analyzing Pipeline Telemetry...</p>
                  <p className="text-slate-500 text-sm">Extracting root cause from raw GitHub Action logs</p>
                </div>
              ) : (
                <>
                  {diagnoseModal.data?.job_name && (
                    <div className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center gap-3">
                      <AlertTriangle className="text-rose-500" size={20} />
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Failed Job Identity</h4>
                        <p className="text-white font-mono text-sm">{diagnoseModal.data.job_name}</p>
                      </div>
                    </div>
                  )}

                  <div className="bg-purple-900/10 p-6 rounded-xl border border-purple-500/20 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                    <h4 className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Bot size={16} /> AI Generated Solution
                    </h4>
                    <div className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed prose prose-invert max-w-none">
                      <MarkdownRenderer content={diagnoseModal.data?.diagnosis || ""} />
                    </div>
                  </div>

                  {diagnoseModal.data?.raw_logs && (
                    <div className="bg-black/60 p-5 rounded-xl border border-slate-800">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Terminal size={14} /> Truncated Log Evidence
                      </h4>
                      <pre className="text-rose-400/90 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed p-4 bg-black rounded-lg border border-slate-800">
                        {diagnoseModal.data.raw_logs}
                      </pre>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live Status Modal */}
      {liveModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans animate-in fade-in duration-200">
          <div className="glass-panel border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-700 bg-black/40 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 rounded-lg">
                  <Activity className="text-emerald-400 animate-pulse" size={20} />
                </div>
                <h3 className="font-bold text-white tracking-wide text-lg">Live Pipeline Feed</h3>
              </div>
              <button
                onClick={() => setLiveModal({ isOpen: false })}
                className="text-slate-500 hover:text-white transition-colors bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 p-2 rounded-lg"
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-background/50 space-y-6">
              {liveModal.loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <Activity size={40} className="text-emerald-500 animate-spin mb-2" />
                  <p className="text-slate-300 font-bold text-lg">Establishing Telemetry Stream...</p>
                </div>
              ) : (
                <>
                  <div className="bg-white/5 p-5 rounded-xl border border-white/10 flex justify-between items-center">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Target Repository</h4>
                      <p className="text-white font-mono text-sm">{liveModal.data?.repo}</p>
                    </div>
                    <div className="text-right">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Execution State</h4>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${liveModal.data?.status === 'completed' ? (liveModal.data?.conclusion === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30') : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                        {liveModal.data?.status === 'completed' ? liveModal.data?.conclusion : liveModal.data?.status}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Workflow Matrix</h4>
                    {liveModal.data?.jobs?.length ? (
                      liveModal.data.jobs.map((job, jIdx) => (
                        <div key={jIdx} className="bg-black/40 p-5 rounded-xl border border-slate-800">
                          <div className="flex items-center gap-3 mb-4 border-b border-slate-800 pb-3">
                            {job.status === "in_progress" ? <Activity size={18} className="text-amber-500 animate-spin" /> :
                              job.conclusion === "success" ? <CheckCircle size={18} className="text-emerald-500" /> :
                                <XCircle size={18} className="text-rose-500" />}
                            <span className="font-bold text-white text-md">{job.name}</span>
                          </div>

                          <div className="ml-6 space-y-3 border-l-2 border-slate-800 pl-5">
                            {job.steps?.map((step, sIdx) => (
                              <div key={sIdx} className="flex justify-between items-center group">
                                <div className="flex items-center gap-3">
                                  {step.status === "in_progress" ? <Activity size={12} className="text-amber-400 animate-spin" /> :
                                    step.conclusion === "success" ? <CheckCircle size={12} className="text-emerald-500" /> :
                                      step.conclusion === "skipped" ? <CheckCircle size={12} className="text-slate-600" /> :
                                        step.status === "queued" ? <Clock size={12} className="text-slate-500" /> :
                                          <XCircle size={12} className="text-rose-500" />}
                                  <span className={`text-xs ${step.status === "in_progress" ? "text-amber-400 font-bold" : "text-slate-300 font-medium"}`}>{step.name}</span>
                                </div>
                                <span className="text-[10px] font-mono text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 px-2 py-0.5 rounded">
                                  {step.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-10 text-center bg-white/5 rounded-xl border border-white/10">
                        <p className="text-sm text-slate-500 font-medium">No job matrix found for this execution run.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
