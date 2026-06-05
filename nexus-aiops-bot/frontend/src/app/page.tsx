"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { 
  Activity, 
  AlertCircle, 
  BarChart3, 
  LogOut, 
  MessageSquare, 
  Search, 
  Server, 
  Settings, 
  ShieldAlert, 
  Terminal 
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function CommandCenter() {
  const router = useRouter();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [chatHistory, setChatHistory] = useState<{role: string, text: string}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (!token) {
      router.push("/login");
      return;
    }
    loadData();
  }, [router]);

  const loadData = async () => {
    try {
      const incRes = await fetchApi("/api/v1/incidents");
      setIncidents(incRes);
      const logRes = await fetchApi("/api/v1/logs?limit=50");
      setLogs(logRes);
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userQuery = chatInput;
    setChatInput("");
    setChatHistory(prev => [...prev, { role: "user", text: userQuery }]);

    try {
      const res = await fetchApi("/api/chat", {
        method: "POST",
        body: JSON.stringify({ query: userQuery, time_window_mins: 60 })
      });
      setChatHistory(prev => [...prev, { role: "assistant", text: res.answer }]);
    } catch (err: any) {
      setChatHistory(prev => [...prev, { role: "assistant", text: "⚠️ Error connecting to AI engine." }]);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("jwt_token");
    router.push("/login");
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-background"><Activity className="animate-spin text-primary h-8 w-8" /></div>;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-card border-r border-border flex flex-col hidden md:flex">
        <div className="p-6 flex items-center space-x-3">
          <div className="bg-primary/20 p-2 rounded-lg text-primary">
            <Server size={24} />
          </div>
          <span className="font-bold text-lg tracking-tight">NEXUS AIOPS</span>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <Button variant="secondary" className="w-full justify-start"><Activity className="mr-3 h-4 w-4" /> Command Center</Button>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground"><ShieldAlert className="mr-3 h-4 w-4" /> Incidents</Button>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground"><Terminal className="mr-3 h-4 w-4" /> Log Explorer</Button>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground"><BarChart3 className="mr-3 h-4 w-4" /> Analytics</Button>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground"><Settings className="mr-3 h-4 w-4" /> Settings</Button>
        </nav>
        <div className="p-4 border-t border-border">
          <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-red-500 hover:text-red-400 hover:bg-red-500/10">
            <LogOut className="mr-3 h-4 w-4" /> Logout
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur flex items-center justify-between px-6">
          <div className="flex items-center bg-background/50 border border-border rounded-md px-3 py-1.5 w-96">
            <Search className="h-4 w-4 text-muted-foreground mr-2" />
            <input type="text" placeholder="Search resources, logs, or IPs..." className="bg-transparent border-none outline-none text-sm w-full" />
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="border-emerald-500/50 text-emerald-500 bg-emerald-500/10">
              <span className="h-2 w-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
              System Healthy
            </Badge>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
            <Button onClick={loadData} variant="outline" size="sm"><Activity className="mr-2 h-4 w-4" /> Refresh Telemetry</Button>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="bg-card border-border shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Incidents</CardTitle>
                <ShieldAlert className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{incidents.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Tenant Scoped Isolation</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Telemetry Ingested</CardTitle>
                <Activity className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{logs.length}</div>
                <p className="text-xs text-muted-foreground mt-1">Logs recorded last 1h</p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border shadow-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Reliability Score</CardTitle>
                <BarChart3 className="h-4 w-4 text-indigo-500" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-indigo-400">99.9%</div>
                <p className="text-xs text-muted-foreground mt-1">Target: 99.99%</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="incidents" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="incidents">Active Incidents</TabsTrigger>
              <TabsTrigger value="copilot">AI Copilot</TabsTrigger>
              <TabsTrigger value="logs">Log Stream</TabsTrigger>
            </TabsList>
            
            <TabsContent value="incidents" className="mt-0">
              <Card className="border-border shadow-md">
                <CardHeader>
                  <CardTitle>Recent Critical Events</CardTitle>
                  <CardDescription>Security and operational incidents requiring attention.</CardDescription>
                </CardHeader>
                <CardContent>
                  {incidents.length === 0 ? (
                    <div className="text-center py-12">
                      <ShieldAlert className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                      <h3 className="text-lg font-medium text-muted-foreground">No Incidents Detected</h3>
                      <p className="text-sm text-muted-foreground">All systems operating normally for your tenant.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead>Time</TableHead>
                          <TableHead>Service</TableHead>
                          <TableHead>Severity</TableHead>
                          <TableHead>Message</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {incidents.map((inc) => (
                          <TableRow key={inc.incident_id} className="border-border">
                            <TableCell className="font-medium">{new Date(inc.created_at).toLocaleTimeString()}</TableCell>
                            <TableCell>{inc.service}</TableCell>
                            <TableCell>
                              <Badge variant={inc.severity === "CRITICAL" ? "destructive" : "default"}>{inc.severity}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{inc.message}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm">View RCA</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="copilot" className="mt-0 h-[500px]">
              <Card className="border-border shadow-md h-full flex flex-col">
                <CardHeader className="border-b border-border pb-4 bg-primary/5">
                  <CardTitle className="flex items-center text-primary">
                    <MessageSquare className="mr-2 h-5 w-5" /> SRE AI Assistant
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                  <ScrollArea className="flex-1 p-6">
                    <div className="space-y-4">
                      <div className="flex mb-4">
                        <div className="bg-secondary rounded-lg p-3 max-w-[80%] border border-border">
                          <p className="text-sm">Hello SRE! I am your AI Copilot. Ask me to diagnose any anomalies, check database locks, or analyze cluster health.</p>
                        </div>
                      </div>
                      {chatHistory.map((msg, i) => (
                        <div key={i} className={`flex mb-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                          <div className={`rounded-lg p-3 max-w-[80%] border ${msg.role === 'user' ? 'bg-primary/20 border-primary/30 text-primary-foreground' : 'bg-secondary border-border'}`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className="p-4 bg-muted/30 border-t border-border">
                    <form onSubmit={handleChat} className="flex gap-2">
                      <Input 
                        placeholder="e.g. Why is the inventory service returning 503 errors?" 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="bg-background border-border"
                      />
                      <Button type="submit">Ask AI</Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="logs" className="mt-0">
               <Card className="border-border shadow-md">
                <CardHeader>
                  <CardTitle>Raw Telemetry Stream</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-[#0f111a] rounded-md p-4 font-mono text-xs overflow-auto h-[400px] border border-border">
                    {logs.length === 0 ? (
                      <span className="text-muted-foreground">Waiting for incoming telemetry...</span>
                    ) : (
                      logs.map((log) => (
                        <div key={log.log_id} className="mb-1">
                          <span className="text-slate-500">[{new Date(log.timestamp).toISOString()}]</span>{" "}
                          <span className={log.level === 'ERROR' ? 'text-red-400' : 'text-emerald-400'}>{log.level}</span>{" "}
                          <span className="text-indigo-400">{log.service}</span>:{" "}
                          <span className="text-slate-300">{log.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        </div>
      </main>
    </div>
  );
}
