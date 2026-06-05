"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { MessageSquareCode, Send, Bot, User, Activity, Sun, Sunset, Moon } from "lucide-react";
import { fetchApi } from "@/lib/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function getGreetingIcon() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return Sun;
  if (hour >= 12 && hour < 18) return Sunset;
  return Moon;
}

function decodeJwtPayload(token: string): Record<string, any> {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

export default function AICopilot() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [fullName, setFullName] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
      router.push("/login");
      return;
    }

    // Decode full_name from JWT
    const payload = decodeJwtPayload(token);
    const name = payload.full_name || payload.email || "";
    setFullName(name);

    // Build a personalized welcome message
    const firstName = name.split(" ")[0];
    const greeting = getGreeting();
    const welcome = firstName
      ? `${greeting}, ${firstName}! 👋 I am the Nexus AI Copilot. I have full visibility into your active incidents and service logs. How can I assist you today?`
      : `${greeting}! I am the Nexus AI Copilot. I have full visibility into your active incidents and service logs. How can I assist you today?`;

    setMessages([{ role: "assistant", content: welcome }]);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    const userMsg = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    setSending(true);

    try {
      const data = await fetchApi("/chat", {
        method: "POST",
        body: JSON.stringify({ query: userMsg, time_window_mins: 60 }),
      });
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ **Error:** ${err.message}` },
      ]);
    } finally {
      setSending(false);
    }
  };

  const GreetingIcon = getGreetingIcon();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Activity className="animate-spin text-indigo-500 w-8 h-8" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-6rem)]">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-medium tracking-wide text-white flex items-center">
            <MessageSquareCode className="mr-3 text-indigo-400" /> AI Copilot
          </h2>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
            <GreetingIcon size={14} className="text-amber-400" />
            {getGreeting()}{fullName ? `, ${fullName.split(" ")[0]}` : ""} — powered by Amazon Bedrock · Claude 3 Haiku
          </p>
        </div>

        <div className="flex-1 glass-panel rounded-xl flex flex-col overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500/0 via-indigo-500 to-indigo-500/0"></div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] flex space-x-4 ${msg.role === "user" ? "flex-row-reverse space-x-reverse" : ""}`}>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === "user" ? "bg-indigo-600" : "bg-emerald-600"
                    }`}
                  >
                    {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div
                    className={`p-4 rounded-2xl whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-indigo-600/20 border border-indigo-500/30 text-indigo-100"
                        : "bg-black/40 border border-white/10 text-slate-300 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {sending && (
              <div className="flex justify-start">
                <div className="max-w-[80%] flex space-x-4">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-emerald-600">
                    <Bot size={16} />
                  </div>
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-slate-400 flex space-x-2 items-center">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
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
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Ask anything — analyze logs, generate K8s YAML, suggest remediations..."
                className="w-full bg-[#0a0a0f] border border-slate-800 text-white rounded-xl px-4 py-4 pr-12 focus:outline-none focus:border-indigo-500/50 transition-all"
              />
              <button
                onClick={handleSend}
                disabled={sending}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
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
