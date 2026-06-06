"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { GitBranch, User, Clock, CheckCircle, XCircle, AlertCircle, Activity } from "lucide-react";
import { fetchApi } from "@/lib/api";

interface DeploymentEvent {
  commit_sha: string;
  commit_msg: string;
  author: string;
  repository: string;
  workflow_run_id?: string;
  timestamp: string;
}

export default function GitHubDeployments() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [deployments, setDeployments] = useState<DeploymentEvent[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
      router.push("/login");
      return;
    }

    fetchApi("/api/v1/github/deployments")
      .then((data) => {
        setDeployments(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
        <div>
          <h2 className="text-xl font-bold tracking-wide text-white">GitHub Deployment Sync</h2>
          <p className="text-sm text-slate-500 mt-1">
            Real-time tracking of runner builds, production releases, and code changes mapped to telemetry timelines.
          </p>
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
                        <span className="bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-emerald-500/30 flex items-center w-fit gap-1">
                          <CheckCircle size={10} /> Sync Complete
                        </span>
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
    </DashboardLayout>
  );
}
