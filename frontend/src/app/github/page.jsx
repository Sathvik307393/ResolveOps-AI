"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import MarkdownRenderer from "@/components/common/MarkdownRenderer";
import { GitBranch, User, Clock, CheckCircle, XCircle, AlertCircle, AlertTriangle, Activity, RefreshCw, Bot, Terminal, Play, Server, Folder, Layers, BookOpen } from "lucide-react";
import { fetchApi } from "@/lib/api";

export default function GitHubSyncHub() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [statusData, setStatusData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [runs, setRuns] = useState([]);
  const [repos, setRepos] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [diagnoseModal, setDiagnoseModal] = useState({ isOpen: false });
  const [errorMsg, setErrorMsg] = useState(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchStatus = async () => {
    try {
      const res = await fetchApi("/api/v1/github/status");
      if (res && res.status === "connected") {
        setStatusData(res);
        return true;
      }
      return false;
    } catch (e) {
      if (e.message?.includes("PAT") || e.message?.includes("token") || e.message?.includes("configured")) {
        setErrorMsg("Connect your GitHub PAT in Integrations.");
      } else {
        setErrorMsg(e.message || "Failed to fetch GitHub status");
      }
      return false;
    }
  };

  const fetchGithubData = async () => {
    try {
      const [reposRes, workflowsRes, runsRes] = await Promise.all([
        fetchApi("/api/v1/github/repos").catch(() => ({ repos: [] })),
        fetchApi("/api/v1/github/workflows").catch(() => ({ workflows: [] })),
        fetchApi("/api/v1/github/runs").catch(() => ({ runs: [], summary: {} }))
      ]);

      setRepos(reposRes.repos || []);
      setWorkflows(workflowsRes.workflows || []);
      setRuns(runsRes.runs || []);
      if (runsRes.summary) {
        setSummary(runsRes.summary);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const init = async () => {
    setLoading(true);
    setErrorMsg(null);
    const isConnected = await fetchStatus();
    if (isConnected) {
      await fetchGithubData();
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
      router.push("/login");
      return;
    }
    init();
  }, [router]);

  const handleForceSync = async () => {
    setSyncing(true);
    setErrorMsg(null);
    try {
      const res = await fetchApi("/api/v1/github/sync", { method: "POST" });
      if (res.status === "permission_required") {
        setErrorMsg(res.message || "GitHub PAT does not have permission to read Actions workflow runs.");
      } else {
        await init();
      }
    } catch (e) {
      if (e.message?.includes("invalid") || e.status === 401) {
        setErrorMsg("GitHub token is invalid or expired.");
      } else if (e.message?.includes("permission") || e.status === 403) {
        setErrorMsg("GitHub token does not have permission to read repositories or Actions workflows.");
      } else {
        setErrorMsg(e.message || "Sync failed");
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleDiagnose = async (repository, workflow_run_id) => {
    setDiagnoseModal({ isOpen: true, loading: true });
    try {
      const data = await fetchApi(`/api/v1/github/runs/${workflow_run_id}/rca`, {
        method: "POST",
        body: JSON.stringify({ repository }),
      });
      setDiagnoseModal({ isOpen: true, loading: false, data });
    } catch (error) {
      const errMsg = typeof error.message === 'string' ? error.message : JSON.stringify(error);
      setDiagnoseModal({ isOpen: true, loading: false, data: { diagnosis: errMsg || "Error communicating with diagnosis engine.", raw_logs: "Logs not available" } });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
          <div className="relative">
            <div className="absolute inset-0 bg-purple-500 blur-xl opacity-50 rounded-full animate-pulse"></div>
            <Activity className="animate-spin text-purple-400 w-12 h-12 relative z-10" />
          </div>
          <p className="text-slate-400 font-mono text-sm tracking-widest uppercase">Initializing GitHub Intelligence...</p>
        </div>
      </DashboardLayout>
    );
  }

  const getEmptyStateMessage = () => {
    if (errorMsg) return errorMsg;
    if (!statusData) return "Connect your GitHub PAT in Integrations.";
    if (repos.length > 0 && workflows.length === 0) return "Repositories found, but no GitHub Actions workflows were detected.";
    if (workflows.length > 0 && runs.length === 0) return "Workflows found, but no recent workflow runs were found.";
    return "No repositories found for this GitHub account.";
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full space-y-6 font-sans animate-in fade-in duration-500 pb-10">
        
        {/* Header & Connection Status */}
        <div className="relative rounded-3xl overflow-hidden glass-panel border border-slate-800/80 p-8 lg:p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-purple-600/10 rounded-full blur-[100px] -mr-40 -mt-40 pointer-events-none"></div>
          
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 text-purple-400 text-xs font-bold uppercase tracking-wider rounded-full border border-purple-500/20 mb-4">
              <GitBranch size={12} className="text-purple-400" /> GitHub Sync Hub
            </div>
            <h2 className="text-3xl font-bold tracking-wide text-white mb-2 flex items-center gap-3">
              Repository Intelligence
              {statusData ? (
                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded border border-emerald-500/30 flex items-center gap-1"><CheckCircle size={12}/> Connected</span>
              ) : (
                <span className="text-xs bg-rose-500/20 text-rose-400 px-2 py-1 rounded border border-rose-500/30 flex items-center gap-1"><XCircle size={12}/> Not Connected</span>
              )}
            </h2>
            {statusData && (
              <p className="text-sm text-slate-400 max-w-xl flex items-center gap-2">
                <User size={14}/> {statusData.username || statusData.name || "GitHub User"}
              </p>
            )}
            {errorMsg && (
              <p className="text-sm text-rose-400 mt-2 p-2 bg-rose-500/10 border border-rose-500/20 rounded max-w-xl">
                {errorMsg}
              </p>
            )}
          </div>
          <button
            onClick={handleForceSync}
            disabled={syncing}
            className="relative z-10 bg-white/5 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all border border-white/10 hover:shadow-[0_0_20px_rgba(255,255,255,0.05)] backdrop-blur-md disabled:opacity-50"
          >
            <RefreshCw size={16} className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing..." : "Force Sync"}
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="glass-panel p-5 rounded-xl border border-slate-700/50 flex flex-col justify-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1 flex items-center gap-1"><Folder size={12}/> Repositories</p>
            <p className="text-2xl font-bold text-slate-100">{repos.length}</p>
          </div>
          <div className="glass-panel p-5 rounded-xl border border-slate-700/50 flex flex-col justify-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1 flex items-center gap-1"><Layers size={12}/> Workflows</p>
            <p className="text-2xl font-bold text-slate-100">{workflows.length}</p>
          </div>
          <div className="glass-panel p-5 rounded-xl border border-slate-700/50 flex flex-col justify-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1 flex items-center gap-1"><GitBranch size={12}/> Recent Runs</p>
            <p className="text-2xl font-bold text-slate-100">{summary?.total || 0}</p>
          </div>
          <div className="glass-panel p-5 rounded-xl border border-slate-700/50 flex flex-col justify-center bg-rose-500/5">
            <p className="text-[10px] text-rose-400 uppercase tracking-widest font-bold mb-1 flex items-center gap-1"><XCircle size={12}/> Failed</p>
            <p className="text-2xl font-bold text-rose-100">{summary?.failed || 0}</p>
          </div>
          <div className="glass-panel p-5 rounded-xl border border-slate-700/50 flex flex-col justify-center bg-emerald-500/5">
            <p className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold mb-1 flex items-center gap-1"><CheckCircle size={12}/> Success</p>
            <p className="text-2xl font-bold text-emerald-100">{summary?.success || 0}</p>
          </div>
          <div className="glass-panel p-5 rounded-xl border border-slate-700/50 flex flex-col justify-center bg-amber-500/5">
            <p className="text-[10px] text-amber-400 uppercase tracking-widest font-bold mb-1 flex items-center gap-1"><Activity size={12}/> In Progress</p>
            <p className="text-2xl font-bold text-amber-100">{summary?.in_progress || 0}</p>
          </div>
        </div>

        {/* Timeline Table */}
        <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden flex-1 shadow-lg shadow-black/20">
          <div className="p-5 border-b border-slate-800 bg-black/30 flex justify-between items-center">
            <h3 className="text-sm font-bold tracking-wider text-white uppercase flex items-center gap-2">
              <Activity size={16} className="text-purple-400" /> Pipeline Executions
            </h3>
          </div>

          {runs.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center justify-center text-slate-500 bg-background/20 rounded-b-xl">
              <GitBranch className="w-16 h-16 text-slate-600 mb-4 opacity-50" />
              <p className="font-bold text-slate-300 text-lg">No workflow runs to display</p>
              <p className="text-sm text-slate-500 mt-2 max-w-sm">
                {getEmptyStateMessage()}
              </p>
            </div>
          ) : (
            <div className="flex flex-col bg-background/20 rounded-b-xl overflow-hidden">
              {/* Header Row */}
              <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-800/80 bg-black/40 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <div className="col-span-3 pl-2">Repository / Workflow</div>
                <div className="col-span-2">Branch / Event</div>
                <div className="col-span-3">Status</div>
                <div className="col-span-2 text-right">Updated</div>
                <div className="col-span-2 text-right pr-2">Actions</div>
              </div>

              {/* Data Rows */}
              <div className="divide-y divide-slate-800/50">
                {runs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((run, i) => {
                  const repoParts = run.repository.split('/');
                  const repoOwner = repoParts[0];
                  const repoName = repoParts[1] || run.repository;

                  return (
                    <div key={i} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-white/[0.04] transition-colors group cursor-default">
                      {/* Repo & Workflow */}
                      <div className="col-span-3 flex flex-col justify-center truncate pl-2">
                        <span className="font-bold text-sm text-slate-200 flex items-center gap-2">
                          <Folder size={14} className="text-purple-500" />
                          {repoName}
                        </span>
                        <span className="text-[10px] text-purple-400/80 mt-1 ml-6 truncate" title={run.workflow_name}>
                          {run.workflow_name || "Unknown"} #{run.run_number}
                        </span>
                      </div>

                      {/* Branch & Event */}
                      <div className="col-span-2 flex flex-col justify-center">
                        <span className="font-mono text-[11px] font-bold bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-slate-300 w-max group-hover:border-purple-500/30 transition-colors">
                          {run.branch || "unknown"}
                        </span>
                        <div className="flex items-center space-x-1.5 mt-2 text-[10px] text-slate-500 font-medium">
                          <GitBranch size={12} className="text-slate-600" />
                          <span className="truncate uppercase">{run.event}</span>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="col-span-3 flex flex-wrap items-center gap-2">
                        {run.status === "in_progress" || run.status === "queued" || run.status === "pending" ? (
                          <span className="bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full text-[10px] font-bold border border-amber-500/20 flex items-center gap-1.5 shadow-sm">
                            <Activity size={12} className="animate-spin" /> {run.status === "queued" ? "Queued" : "Running"}
                          </span>
                        ) : run.conclusion === "failure" ? (
                          <span className="bg-rose-500/10 text-rose-400 px-2.5 py-1 rounded-full text-[10px] font-bold border border-rose-500/20 flex items-center gap-1.5 shadow-sm">
                            <XCircle size={12} /> Failed
                          </span>
                        ) : run.conclusion === "success" ? (
                          <span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-bold border border-emerald-500/20 flex items-center gap-1.5 shadow-sm">
                            <CheckCircle size={12} /> Success
                          </span>
                        ) : (
                           <span className="bg-slate-500/10 text-slate-400 px-2.5 py-1 rounded-full text-[10px] font-bold border border-slate-500/20 flex items-center gap-1.5 shadow-sm">
                            <AlertCircle size={12} /> {run.conclusion || run.status}
                          </span>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="col-span-2 text-right text-[11px] text-slate-500 font-mono">
                        {run.updated_at ? new Date(run.updated_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "just now"}
                      </div>

                      {/* Actions */}
                      <div className="col-span-2 flex justify-end gap-1.5 pr-2">
                        <a
                          href={run.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-white/5 hover:bg-white/10 text-white px-2 py-1 rounded text-[10px] font-bold border border-white/10 transition-all flex items-center gap-1"
                          title="Open in GitHub"
                        >
                          <GitBranch size={12} /> GitHub
                        </a>
                        {run.conclusion === "failure" && (
                          <button
                            onClick={() => handleDiagnose(run.repository, run.id)}
                            className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 px-2 py-1 rounded text-[10px] font-bold border border-purple-500/30 transition-all flex items-center gap-1 hover:shadow-md"
                          >
                            <Bot size={12} /> RCA
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Pagination Controls */}
              {runs.length > itemsPerPage && (
                <div className="p-4 border-t border-slate-800/50 bg-black/20 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, runs.length)} of {runs.length}
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
                      onClick={() => setCurrentPage(p => (p * itemsPerPage < runs.length ? p + 1 : p))}
                      disabled={currentPage * itemsPerPage >= runs.length}
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
                <h3 className="font-bold text-white tracking-wide text-lg">ResolveOps AI RCA Report</h3>
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
                        <Terminal size={14} /> Log Evidence
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
    </DashboardLayout>
  );
}
