"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchApi } from "@/lib/api";
import { Mail, ShieldCheck, ArrowRight, Cpu, Eye, EyeOff } from "lucide-react";

// ─── Registration: Two-step OTP flow ─────────────────────────────────────────
// ─── Registration: Two-step OTP flow ─────────────────────────────────────────

function RegisterForm() {
  const router = useRouter();
  const [step, setStep] = useState<RegStep>("details");
  const [fullName, setFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await fetchApi("/request-otp", {
        method: "POST",
        body: JSON.stringify({ email: regEmail, full_name: fullName }),
      });
      setSuccess(`OTP sent to ${regEmail}. Check your inbox!`);
      setStep("otp");
    } catch (err) {
      setError(err.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await fetchApi("/register", {
        method: "POST",
        body: JSON.stringify({
          email: regEmail,
          password: regPassword,
          full_name: fullName,
          otp_code: otpCode,
        }),
      });
      // Auto-login after registration
      const loginData = await fetchApi("/login", {
        method: "POST",
        body: JSON.stringify({ email: regEmail, password: regPassword }),
      });
      if (loginData.token) {
        localStorage.setItem("jwt_token", loginData.token);
        router.push("/");
      }
    } catch (err) {
      setError(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {error && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive-foreground mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 mb-4">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {step === "details" && (
        <form onSubmit={handleRequestOtp} className="space-y-4">
          {/* Step indicator */}
          <div className="flex items-center space-x-2 mb-6">
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">1</div>
            <div className="flex-1 h-0.5 bg-slate-800"></div>
            <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">2</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-name">Full Name</Label>
            <Input
              id="reg-name"
              placeholder="Sathvik Reddy"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="bg-background/50 border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-email">Work Email</Label>
            <Input
              id="reg-email"
              type="email"
              placeholder="admin@company.com"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              required
              className="bg-background/50 border-border"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-password">Password</Label>
            <div className="relative">
              <Input
                id="reg-password"
                type={showRegPassword ? "text" : "password"}
                placeholder="Min. 8 characters"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
                className="bg-background/50 border-border pr-10"
              />
              <button
                type="button"
                onClick={() => setShowRegPassword(!showRegPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending OTP..." : <span className="flex items-center justify-center gap-2"><Mail size={16} /> Send Verification Code <ArrowRight size={16} /></span>}
          </Button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={handleRegister} className="space-y-4">
          {/* Step indicator */}
          <div className="flex items-center space-x-2 mb-6">
            <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white">✓</div>
            <div className="flex-1 h-0.5 bg-indigo-500"></div>
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">2</div>
          </div>

          <div className="text-center mb-4">
            <p className="text-sm text-slate-400">Enter the 6-digit code sent to</p>
            <p className="text-white font-medium">{regEmail}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="otp">Verification Code</Label>
            <Input
              id="otp"
              placeholder="123456"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              className="bg-background/50 border-border text-center text-2xl font-mono tracking-[0.5em]"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating Account..." : <span className="flex items-center justify-center gap-2"><ShieldCheck size={16} /> Verify & Create Account</span>}
          </Button>

          <button
            type="button"
            onClick={() => { setStep("details"); setError(""); setSuccess(""); }}
            className="w-full text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            ← Change email or resend OTP
          </button>
        </form>
      )}
    </>
  );
}

// ─── Main Login Page ──────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await fetchApi("/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (data.token) {
        localStorage.setItem("jwt_token", data.token);
        router.push("/");
      }
    } catch (err) {
      setError(err.message || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md bg-card/50 backdrop-blur border-border/50 shadow-2xl">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="mx-auto bg-indigo-500/20 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <Cpu size={32} className="text-indigo-400" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Nexus AI</CardTitle>
          <CardDescription>Autonomous SRE & Incident Intelligence Platform</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 bg-muted/50">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive-foreground">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Work Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-background/50 border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-background/50 border-border pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Authenticating..." : "Login"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <RegisterForm />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
