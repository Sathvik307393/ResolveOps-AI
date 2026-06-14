"use client";

import React, { useState } from "react";
import { X, Sparkles, Activity, ShieldAlert, Copy, Check } from "lucide-react";
import MarkdownRenderer from "@/components/common/MarkdownRenderer";
import { fetchApi } from "@/lib/api";

export default function AksRiskDetailsDrawer({ risk, clusterId, onClose }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!risk) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(risk.evidence || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAnalyze = async () => {
    if (analysis) return;
    setAnalyzing(true);
    try {
      const result = await fetchApi("/api/v1/ai/analyze-failure", {
        method: "POST",
        body: JSON.stringify({
          log_message: `AKS Workload Risk: ${risk.type} on ${risk.resource} in namespace ${risk.namespace}. Evidence: ${risk.evidence}. Recommendation: ${risk.recommendation}`,
          resource_id: clusterId
        })
      });
      setAnalysis(result.analysis);
    } catch (err) {
      setAnalysis("Failed to generate AKS RCA.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-all duration-300">
      <div className="w-full max-w-2xl bg-[#0B1120] border-l border-slate-800 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/40">
          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
              risk.severity === 'critical' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
              risk.severity === 'high' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
              'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}>
              {risk.severity}
            </span>
            <h3 className="text-lg font-bold text-white">Risk Details</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div>
            <h4 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <ShieldAlert className="text-rose-400" size={20} /> {risk.type}
            </h4>
            <p className="text-sm text-slate-400 font-mono">{risk.resource} <span className="text-slate-600 px-2">in</span> {risk.namespace}</p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Recommendation</h5>
            <p className="text-sm text-slate-300">{risk.recommendation}</p>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Raw Evidence Log</h5>
              <button onClick={handleCopy} className="text-xs flex items-center gap-1 text-slate-400 hover:text-white transition-colors">
                {copied ? <><Check size={14} className="text-emerald-400" /> Copied</> : <><Copy size={14} /> Copy Log</>}
              </button>
            </div>
            <div className="bg-[#050810] p-4 rounded-xl border border-slate-800/50 overflow-x-auto">
              <pre className="text-xs text-slate-300 font-mono whitespace-pre">{risk.evidence}</pre>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-6">
            {!analysis ? (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="w-full bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 p-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {analyzing ? <><Activity size={18} className="animate-spin" /> Generating Root Cause Analysis...</> : <><Sparkles size={18} /> Generate AKS RCA with AI Copilot</>}
              </button>
            ) : (
              <div className="bg-indigo-500/5 rounded-xl border border-indigo-500/20 overflow-hidden">
                <div className="p-4 bg-indigo-500/10 border-b border-indigo-500/20 flex items-center gap-2">
                  <Sparkles className="text-indigo-400" size={18} />
                  <span className="text-sm font-bold text-indigo-300">AI Root Cause Analysis</span>
                </div>
                <div className="p-5 prose prose-invert prose-sm max-w-none prose-headings:text-indigo-300 prose-a:text-sky-400">
                  <MarkdownRenderer content={analysis} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
