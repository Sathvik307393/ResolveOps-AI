"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { MessageSquareCode, Send, Bot, User, Activity, Sun, Sunset, Moon, Paperclip, Mic, Square, Trash2, Plus, FileText } from "lucide-react";
import { fetchApi } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import dynamic from "next/dynamic";

const ExcalidrawBoard = dynamic(
  () => import("@/components/ExcalidrawBoard"),
  { ssr: false }
);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getGreeting() {
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

function decodeJwtPayload(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

// Recursive helper to safely search through MDX/Markdown children trees to locate excalidraw JSON text.
function findExcalidrawCode(children) {
  if (!children) return null;
  if (Array.isArray(children)) {
    for (const child of children) {
      const res = findExcalidrawCode(child);
      if (res) return res;
    }
    return null;
  }
  if (children.props) {
    const className = children.props.className || "";
    if (typeof className === "string" && (className.includes("language-excalidraw") || className.includes("language-json"))) {
      const childrenVal = children.props.children;
      const codeText = Array.isArray(childrenVal) ? childrenVal.join("") : String(childrenVal || "");
      if (className.includes("language-excalidraw") || codeText.includes('"type": "excalidraw"')) {
        return { codeText };
      }
    }
    if (children.props.children) {
      return findExcalidrawCode(children.props.children);
    }
  }
  return null;
}

function CodeBlock({ children, ...props }) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef(null);

  const excalidraw = useMemo(() => {
    return findExcalidrawCode(children);
  }, [children]);

  if (excalidraw) {
    try {
      // Clean up common LLM JSON syntax errors (like trailing commas) before parsing
      let cleanedJsonText = excalidraw.codeText.trim();
      cleanedJsonText = cleanedJsonText.replace(/,\s*([\]}])/g, '$1');

      const parsedElements = JSON.parse(cleanedJsonText);
      return <ExcalidrawBoard elements={parsedElements.elements || []} />;
    } catch (e) {
      return (
        <div>
          <div className="bg-rose-950/20 border border-rose-500/30 text-rose-400 p-3 rounded-lg text-xs font-mono my-2">
            Failed to render diagram canvas. details: {String(e)}
          </div>
          <pre className="bg-[#020617] border border-white/10 rounded-lg p-4 overflow-x-auto font-mono text-xs text-slate-400 mt-2">
            {excalidraw.codeText}
          </pre>
        </div>
      );
    }
  }

  const handleCopy = async () => {
    if (codeRef.current) {
      const text = codeRef.current.innerText || "";
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative group my-2">
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded text-[11px] border border-white/10 flex items-center gap-1 cursor-pointer font-sans"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      <pre
        ref={codeRef}
        className="bg-[#020617] border border-white/10 rounded-lg p-4 overflow-x-auto font-mono text-xs text-slate-300"
        {...props}
      >
        {children}
      </pre>
    </div>
  );
}

export default function AICopilot() {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [sending, setSending] = useState(false);
  const [fullName, setFullName] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const messagesEndRef = useRef(null);

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [voiceSending, setVoiceSending] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImageFile(reader.result);
        };
        reader.readAsDataURL(file);
      } else {
        // Universal File Handler (txt, json, log, etc.)
        const reader = new FileReader();
        reader.onloadend = () => {
          const text = reader.result;
          // Append contents to chat input automatically
          setInput(prev => prev + `\n\n--- FILE: ${file.name} ---\n${text}\n---------------------\n`);
        };
        reader.readAsText(file);
      }
    }
    // Reset file input
    e.target.value = "";
  };

  const handleClearHistory = async () => {
    if (!confirm(sessionId ? "Are you sure you want to delete this chat session?" : "Are you sure you want to clear all chat history?")) return;
    try {
      await fetchApi(`/api/chat/history${sessionId ? `?session_id=${sessionId}` : ''}`, { method: "DELETE" });
      setMessages([]);
      if (sessionId) {
        setSessionId(null);
        router.replace("/chat");
      }
      window.dispatchEvent(new Event("chat-updated"));
    } catch (e) {
      console.error("Failed to delete history", e);
    }
  };

  const startNewChat = () => {
    setImageFile(null);
    setInput("");
    setSessionId(null);
    router.replace("/chat");
    const greeting = getGreeting();
    const welcome = `${greeting}! I am the Nexus AI Copilot. How can I assist you today?`;
    setMessages([{ role: "assistant", content: welcome }]);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Close tracks
        stream.getTracks().forEach(track => track.stop());

        // Convert Blob to Base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result;
          const pureBase64 = base64data.split(',')[1];

          setVoiceSending(true);
          try {
            const res = await fetchApi("/api/chat/voice", {
              method: "POST",
              body: JSON.stringify({ audio_base64: pureBase64 })
            });
            if (res.text) {
              setInput(prev => prev + (prev ? " " : "") + res.text);
            }
          } catch (e) {
            alert("Voice transcription failed. Please try again.");
          } finally {
            setVoiceSending(false);
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("Microphone access denied or not available.");
    }
  };

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

    let sid = null;
    if (typeof window !== 'undefined') {
      sid = new URLSearchParams(window.location.search).get("session_id");
      if (sid) setSessionId(sid);
    }

    if (!sid) {
      const firstName = name.split(" ")[0];
      const greeting = getGreeting();
      const welcome = firstName
        ? `${greeting}, ${firstName}! 👋 I am the Nexus AI Copilot. I have full visibility into your active incidents and service logs. How can I assist you today?`
        : `${greeting}! I am the Nexus AI Copilot. I have full visibility into your active incidents and service logs. How can I assist you today?`;
      setMessages([{ role: "assistant", content: welcome }]);
      setLoading(false);
      return;
    }

    // Fetch message history from API for the specific session
    fetchApi(`/api/chat/history?session_id=${sid}`)
      .then((history) => {
        if (Array.isArray(history) && history.length > 0) {
          const mapped = history.map((msg) => {
            let content = msg.content || "";
            if (msg.role === "user" && msg.image_base64) {
              content = `🖼️ [Uploaded Architecture Diagram] ${content}`;
            }
            return {
              role: msg.role || "assistant",
              content: content
            };
          });
          setMessages(mapped);
        } else {
          const firstName = name.split(" ")[0];
          const greeting = getGreeting();
          const welcome = firstName
            ? `${greeting}, ${firstName}! 👋 I am the Nexus AI Copilot. I have full visibility into your active incidents and service logs. How can I assist you today?`
            : `${greeting}! I am the Nexus AI Copilot. I have full visibility into your active incidents and service logs. How can I assist you today?`;
          setMessages([{ role: "assistant", content: welcome }]);
        }
      })
      .catch((err) => {
        console.error("Failed to load chat history:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [pathname, router]);

  // Listen to URL search parameter updates for switching sessions cleanly
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const queryParam = new URLSearchParams(window.location.search).get("q");
      if (queryParam) {
        setInput(queryParam);
      }
    }
  }, [pathname]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() && !imageFile) return;

    const userMsg = input.trim();
    const payloadQuery = userMsg || "Analyze this uploaded infrastructure architecture diagram.";

    // Include a visual indicator in user's chat message if they uploaded an image
    const userDisplayContent = imageFile
      ? `🖼️ [Uploaded Architecture Diagram] ${userMsg}`
      : userMsg;

    setMessages((prev) => [...prev, { role: "user", content: userDisplayContent }]);
    setInput("");
    setSending(true);

    const currentImage = imageFile;
    setImageFile(null);

    try {
      const payload = {
        message: payloadQuery,
        image_base64: currentImage
      };
      if (sessionId) {
        payload.session_id = sessionId;
      }

      const data = await fetchApi("/api/chat", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);

      if (data.session_id && !sessionId) {
        setSessionId(data.session_id);
        router.replace(`/chat?session_id=${data.session_id}`);
      }

      // Dispatch custom event to notify sidebar of updates
      window.dispatchEvent(new Event("chat-updated"));
    } catch (err) {
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
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-xl font-medium tracking-wide text-white flex items-center">
              <MessageSquareCode className="mr-3 text-indigo-400" /> AI Copilot
            </h2>
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
              <GreetingIcon size={14} className="text-amber-400" />
              {getGreeting()}{fullName ? `, ${fullName.split(" ")[0]}` : ""} — powered by Amazon Bedrock
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={startNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-md text-xs font-semibold transition-colors border border-indigo-500/20"
            >
              <Plus size={14} /> New Chat
            </button>
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-md text-xs font-semibold transition-colors border border-rose-500/20"
            >
              <Trash2 size={14} /> Delete History
            </button>
          </div>
        </div>

        <div className="flex-1 glass-panel rounded-xl flex flex-col overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500/0 via-indigo-500 to-indigo-500/0"></div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] flex space-x-4 ${msg.role === "user" ? "flex-row-reverse space-x-reverse" : ""}`}>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-indigo-600" : "bg-emerald-600"
                      }`}
                  >
                    {msg.role === "user" ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div
                    className={`p-4 rounded-2xl ${msg.role === "user"
                        ? "bg-indigo-600/20 border border-indigo-500/30 text-indigo-100 whitespace-pre-wrap"
                        : "bg-black/40 border border-white/10 text-slate-300 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                      }`}
                  >
                    {msg.role === "user" ? (
                      msg.content
                    ) : (
                      <div className="text-slate-300 max-w-none text-sm leading-relaxed">
                        <ReactMarkdown
                          components={{
                            pre: ({ ...props }) => <CodeBlock {...props} />,
                            code: ({ ...props }) => <code className="bg-slate-800 text-indigo-300 px-1 py-0.5 rounded text-xs font-mono" {...props} />,
                            h1: ({ ...props }) => <h1 className="text-lg font-bold text-white mt-4 mb-2 first:mt-0" {...props} />,
                            h2: ({ ...props }) => <h2 className="text-md font-semibold text-white mt-3 mb-1 first:mt-0" {...props} />,
                            h3: ({ ...props }) => <h3 className="text-sm font-semibold text-slate-200 mt-2 mb-1 first:mt-0" {...props} />,
                            ul: ({ ...props }) => <ul className="list-disc pl-5 space-y-1 my-2" {...props} />,
                            ol: ({ ...props }) => <ol className="list-decimal pl-5 space-y-1 my-2" {...props} />,
                            li: ({ ...props }) => <li className="text-slate-300" {...props} />,
                            p: ({ ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                            a: ({ ...props }) => <a className="text-indigo-400 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
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
            {imageFile && (
              <div className="mb-3 relative w-16 h-16 border border-indigo-500/50 rounded-lg overflow-hidden group bg-slate-900 flex items-center justify-center">
                <img src={imageFile} alt="Upload preview" className="object-cover w-full h-full" />
                <button
                  onClick={() => setImageFile(null)}
                  className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 flex items-center justify-center text-rose-500 hover:text-rose-400 text-xs font-bold transition-opacity cursor-pointer border-none font-sans"
                >
                  Remove
                </button>
              </div>
            )}
            <div className="relative flex items-center bg-[#0a0a0f] border border-slate-800 rounded-xl px-4 py-2 focus-within:border-indigo-500/50 transition-all">
              <label className="mr-3 cursor-pointer text-slate-400 hover:text-white transition-colors" title="Upload Image or File (txt, log, json)">
                <Paperclip size={18} />
                <input
                  type="file"
                  accept="image/*,.txt,.log,.json,.csv,.md"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </label>

              <button
                onClick={toggleRecording}
                className={`mr-3 transition-colors ${isRecording ? 'text-rose-500 animate-pulse' : 'text-slate-400 hover:text-white'} ${voiceSending ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Voice Record"
                disabled={voiceSending}
              >
                {isRecording ? <Square size={18} /> : <Mic size={18} />}
              </button>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder={voiceSending ? "Transcribing voice..." : isRecording ? "Recording... Click stop when done." : "Ask anything, or attach logs/diagrams..."}
                disabled={isRecording || voiceSending}
                className="flex-1 bg-transparent text-white focus:outline-none py-2 pr-12 text-sm"
              />
              <button
                onClick={handleSend}
                disabled={sending || voiceSending || isRecording}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
