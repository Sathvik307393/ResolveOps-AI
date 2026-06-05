"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { MessageSquareCode, Send, Bot, User, Activity } from "lucide-react";
import { fetchApi } from "@/lib/api";

export default function AICopilot() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hello. I am the Nexus AI Copilot. I have analyzed the active incidents. How can I assist you?" }
  ]);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
      router.push("/login");
      return;
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    setSending(true);

    try {
      // fetchApi base is already '/api', so this resolves to /api/chat on the server
      const data = await fetchApi("/chat", {
        method: "POST",
        body: JSON.stringify({ query: userMsg, time_window_mins: 60 })
      });
      
      setMessages(prev => [...prev, { role: "assistant", content: data.answer }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Activity className="animate-spin text-primary w-8 h-8"/></div>;
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-6rem)]">
        <h2 className="text-xl font-medium tracking-wide text-white mb-6 flex items-center">
          <MessageSquareCode className="mr-3 text-indigo-400" /> AI Copilot
        </h2>
        
        <div className="flex-1 glass-panel rounded-xl flex flex-col overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500/0 via-indigo-500 to-indigo-500/0"></div>
          
          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] flex space-x-4 ${msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={`p-4 rounded-2xl ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-100' 
                      : 'bg-black/40 border border-white/10 text-slate-300 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="max-w-[80%] flex space-x-4">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-emerald-600">
                    <Bot size={16} />
                  </div>
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-slate-400 flex space-x-2 items-center">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-white/10 bg-black/20">
            <div className="relative">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask the AI Copilot to analyze logs, suggest remediations, or write queries..."
                className="w-full bg-[#0a0a0f] border border-slate-800 text-white rounded-xl px-4 py-4 pr-12 focus:outline-none focus:border-indigo-500/50 glow-primary transition-all"
              />
              <button 
                onClick={handleSend}
                disabled={sending}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
              >
                <Send size={20} />
              </button>
            </div>
          </div>

        </div>
      </div>
    </DashboardLayout>
  );
}
