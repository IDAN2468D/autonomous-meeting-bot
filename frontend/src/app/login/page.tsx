"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, LogIn, Sparkles } from "lucide-react";
import { api, getAuthToken, setAuthToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getAuthToken()) {
      api
        .me()
        .then(() => router.replace("/"))
        .catch(() => setAuthToken(null));
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login({ email: email.trim(), password });
      setAuthToken(res.access_token);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בהתחברות");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      <div className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900/85 backdrop-blur-xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-cyan-400 to-indigo-600 text-slate-950 shadow-lg shadow-cyan-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            AuraMeet AI
          </h1>
          <p className="text-xs text-slate-400">
            בוט פגישות אישי ואוטונומי • התחברות מאובטחת למערכת
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">אימייל</label>
            <input
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full bg-slate-950/90 border border-white/15 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1.5">סיסמה</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="הזן סיסמה"
                className="w-full bg-slate-950/90 border border-white/15 rounded-xl px-4 py-3 pl-11 text-sm text-white focus:outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
                title={showPassword ? "הסתר סיסמה" : "הצג סיסמה"}
                className="absolute inset-y-0 left-0 px-3.5 flex items-center text-slate-400 hover:text-cyan-300 transition"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-xs text-rose-200 bg-rose-950/70 border border-rose-500/40 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="underline text-rose-300 shrink-0"
              >
                סגור
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-l from-cyan-400 to-indigo-500 hover:brightness-110 disabled:opacity-40 text-slate-950 font-bold py-3 rounded-xl text-sm shadow-lg shadow-cyan-500/20 transition"
          >
            <LogIn className="w-4 h-4" />
            {loading ? "מתחבר..." : "התחבר למערכת"}
          </button>
        </form>

        <div className="pt-4 border-t border-white/10 text-center space-y-2">
          <p className="text-xs text-slate-400">
            עדיין אין לך חשבון?{" "}
            <Link
              href="/register"
              className="text-cyan-300 font-semibold hover:underline"
            >
              הירשם כאן ובחר תמונת אווטאר
            </Link>
          </p>
          <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            <Lock className="w-3 h-3" />
            מאובטח באמצעות JWT + Kafka Audit Logging
          </div>
        </div>
      </div>
    </div>
  );
}
