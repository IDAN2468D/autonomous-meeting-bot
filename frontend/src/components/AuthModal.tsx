"use client";

import { useState } from "react";
import { Lock, X } from "lucide-react";
import { api, setAuthToken } from "@/lib/api";
import { AuthUser } from "@/types/meeting";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
}

export function AuthModal({ open, onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res =
        mode === "register"
          ? await api.register({ full_name: fullName, email, password })
          : await api.login({ email, password });
      setAuthToken(res.access_token);
      onSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאת התחברות");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-900 p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-300">
              <Lock className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white">
              {mode === "login" ? "התחברות מאובטחת (JWT)" : "הרשמת משתמש חדש"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "register" && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">שם מלא</label>
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="לדוגמה: עידן כזום"
                className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-1">אימייל</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">סיסמה</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="לפחות 6 תווים"
              className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          {error && (
            <div className="text-xs text-rose-300 bg-rose-950/60 border border-rose-500/30 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-l from-cyan-400 to-indigo-500 hover:brightness-110 disabled:opacity-40 text-slate-950 font-bold py-2.5 rounded-xl text-sm transition"
          >
            {loading
              ? "מאמת..."
              : mode === "login"
              ? "התחבר"
              : "צור חשבון והתחבר"}
          </button>
        </form>

        <div className="text-center text-xs text-slate-400">
          {mode === "login" ? (
            <button
              onClick={() => setMode("register")}
              className="text-cyan-300 hover:underline"
            >
              אין לך חשבון? הירשם כאן
            </button>
          ) : (
            <button
              onClick={() => setMode("login")}
              className="text-cyan-300 hover:underline"
            >
              כבר יש לך חשבון? התחבר כאן
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
