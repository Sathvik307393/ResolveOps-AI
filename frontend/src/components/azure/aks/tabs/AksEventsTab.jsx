"use client";

import React, { useState } from "react";
import { AlertCircle, Clock, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";

export default function AksEventsTab({ events }) {
  const [expandedId, setExpandedId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  if (!events || events.length === 0) {
    return (
      <div className="glass-panel p-10 rounded-xl text-center text-slate-400 border border-slate-800">
        <Clock size={48} className="mx-auto mb-4 text-emerald-500/50" />
        <p className="text-lg text-slate-300">No recent Kubernetes warning events detected.</p>
        <p className="text-sm mt-2">Enable Diagnostic Settings and Log Analytics to collect deeper activity signals if you expect events here.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(events.length / PAGE_SIZE);
  const paginated = events.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCopy = (e, msg, id) => {
    e.stopPropagation();
    navigator.clipboard.writeText(msg);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="space-y-3">
        {paginated.map((e, i) => {
          const isExpanded = expandedId === i;
          return (
            <div key={i} className="bg-black/40 border border-slate-800 rounded-xl overflow-hidden transition-all">
              <div 
                className="p-4 flex items-start gap-4 cursor-pointer hover:bg-slate-900/50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : i)}
              >
                <AlertCircle className="text-amber-500 mt-1 shrink-0" size={18} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-bold text-slate-200">{e.reason}</span>
                    <span className="text-xs text-slate-500 font-mono">{e.last_timestamp ? new Date(e.last_timestamp).toLocaleString() : ''}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mb-2">
                    {e.involved_object} <span className="text-slate-600 px-1">in</span> <span className="text-sky-400/80">{e.namespace}</span>
                  </p>
                  
                  <div className="relative">
                    <p className={`text-xs text-slate-300 font-mono leading-relaxed ${!isExpanded ? 'line-clamp-2' : ''}`}>
                      {e.message}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="bg-slate-800 text-[10px] px-2 py-0.5 rounded text-slate-400 font-bold">x{e.count}</div>
                  <button className="text-xs text-slate-500 hover:text-white flex items-center gap-1 mt-2">
                    {isExpanded ? <><ChevronUp size={14} /> Collapse</> : <><ChevronDown size={14} /> Expand</>}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="p-4 bg-[#050810] border-t border-slate-800 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex justify-between items-center mb-2">
                    <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Full Event Log</h5>
                    <button 
                      onClick={(evt) => handleCopy(evt, e.message, i)} 
                      className="text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
                    >
                      {copiedId === i ? <><Check size={12} className="text-emerald-400" /> Copied</> : <><Copy size={12} /> Copy Log</>}
                    </button>
                  </div>
                  <div className="overflow-x-auto bg-black/50 p-4 rounded-lg border border-slate-800/50">
                    <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-all">{e.message}</pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 p-3 flex justify-between items-center text-xs text-slate-400">
          <span>Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, events.length)} of {events.length} events</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white">Prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
