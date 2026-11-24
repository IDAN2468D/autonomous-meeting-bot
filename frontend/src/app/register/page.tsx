"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Sparkles, Upload, User, UserPlus } from "lucide-react";
import { api, setAuthToken } from "@/lib/api";

const DEFAULT_AVATAR =
  "https://create-images-results.d-id.com/DefaultPresenters/Noelle_f/image.jpeg";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string>(DEFAULT_AVATAR);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSelectedFile(file);

    // Instant live preview from the local computer file
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return objectUrl;
    });

    setUploading(true);
    try {
      const res = await api.uploadAvatar(file);
      setUploadedAvatarUrl(res.avatar_image_url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "שגיאה בהעלאת תמונת האווטאר"
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploading) return;
    setLoading(true);
    setError(null);
    try {
      let finalAvatarUrl = uploadedAvatarUrl;
      if (selectedFile && finalAvatarUrl === DEFAULT_AVATAR) {
        const uploaded = await api.uploadAvatar(selectedFile);
        finalAvatarUrl = uploaded.avatar_image_url;
      }

      const res = await api.register({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        avatar_image_url: finalAvatarUrl,
      });
      setAuthToken(res.access_token);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה ביצירת המשתמש");
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
            יצירת חשבון חדש
          </h1>
          <p className="text-xs text-slate-400">
            העלה תמונת אווטאר מהמחשב שלך והגדר את פרטי החשבון
          </p>
        </div>

        {/* Avatar Icon / Uploaded Photo Preview + Computer File Picker */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="תמונת האווטאר שנבחרה"
                className="w-24 h-24 rounded-full object-cover border-2 border-cyan-400/80 shadow-lg shadow-cyan-500/25 bg-slate-800"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-dashed border-cyan-400/60 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-500/15">
                <User className="w-11 h-11" />
              </div>
            )}
            {uploading && (
              <div className="absolute inset-0 rounded-full bg-slate-950/70 flex items-center justify-center text-[11px] font-semibold text-cyan-300">
                מעלה...
              </div>
            )}
          </div>

          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/35 text-xs font-semibold text-cyan-200 cursor-pointer transition">
            <Upload className="w-3.5 h-3.5" />
            {selectedFile ? `נבחר: ${selectedFile.name}` : "בחר תמונת אווטאר מהמחשב"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          <span className="text-[11px] text-slate-400">
            JPG / PNG / WEBP עד 5MB
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">שם מלא</label>
            <input
              required
              minLength={2}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="לדוגמה: עידן כזום"
              className="w-full bg-slate-950/90 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1.5">אימייל</label>
            <input
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full bg-slate-950/90 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1.5">סיסמה</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="לפחות 6 תווים"
                className="w-full bg-slate-950/90 border border-white/15 rounded-xl px-4 py-2.5 pl-11 text-sm text-white focus:outline-none focus:border-cyan-400"
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
            disabled={loading || uploading}
            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-l from-emerald-400 to-cyan-400 hover:brightness-110 disabled:opacity-40 text-slate-950 font-bold py-3 rounded-xl text-sm shadow-lg shadow-emerald-500/20 transition"
          >
            <UserPlus className="w-4 h-4" />
            {loading ? "יוצר חשבון..." : "הירשם והיכנס למערכת"}
          </button>
        </form>

        <div className="pt-4 border-t border-white/10 text-center">
          <p className="text-xs text-slate-400">
            כבר יש לך חשבון?{" "}
            <Link
              href="/login"
              className="text-cyan-300 font-semibold hover:underline"
            >
              חזור להתחברות
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
