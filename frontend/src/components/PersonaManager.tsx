"use client";

import { useState } from "react";
import { Plus, Trash2, Upload, UserCheck, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { Persona } from "@/types/meeting";

interface Props {
  personas: Persona[];
  selectedId: string | null;
  userAvatarUrl?: string;
  onSelect: (persona: Persona) => void;
  onRefresh: () => Promise<void>;
}

const VOICES = [
  { id: "he-IL-AvriNeural", label: "עברית - אברי (גבר)", lang: "he" as const },
  { id: "he-IL-HilaNeural", label: "עברית - הילה (אישה)", lang: "he" as const },
  { id: "en-US-AndrewNeural", label: "English - Andrew (Male)", lang: "en" as const },
  { id: "en-US-JennyNeural", label: "English - Jenny (Female)", lang: "en" as const },
];

export function PersonaManager({
  personas,
  selectedId,
  userAvatarUrl,
  onSelect,
  onRefresh,
}: Props) {
  const [name, setName] = useState("");
  const [roleTitle, setRoleTitle] = useState("מפתח Backend AI");
  const [voiceId, setVoiceId] = useState(VOICES[1].id);
  const [systemPrompt, setSystemPrompt] = useState(
    "אתה הנציג האישי שלי בפגישות עבודה. ענה במקצועיות, בביטחון ובתמציתיות של 2-3 משפטים."
  );
  const [creating, setCreating] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const voice = VOICES.find((v) => v.id === voiceId) || VOICES[0];
      const created = await api.createPersona({
        name: name.trim(),
        role_title: roleTitle.trim(),
        voice_id: voice.id,
        language: voice.lang,
        system_prompt: systemPrompt.trim(),
      });
      setName("");
      await onRefresh();
      onSelect(created);
    } finally {
      setCreating(false);
    }
  };

  const handleUpload = async (personaId: string, file?: File) => {
    if (!file) return;
    setUploadStatus("מבצע אינדוקס ל-ChromaDB...");
    try {
      const res = await api.uploadKnowledge(personaId, file);
      setUploadStatus(`הקובץ "${res.filename}" אונדקס (${res.indexed_chunks} מקטעים)`);
    } catch (err) {
      setUploadStatus(`שגיאה בהעלאה: ${String(err)}`);
    }
  };

  const handleDelete = async (id: string) => {
    await api.deletePersona(id);
    await onRefresh();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-slate-900/70 border border-white/10 rounded-2xl p-5 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-cyan-400" />
          פרסונות קיימות ({personas.length})
        </h2>

        {uploadStatus && (
          <div className="text-xs bg-cyan-950/60 border border-cyan-500/30 text-cyan-200 px-3 py-2 rounded-lg flex items-center gap-2">
            <FileText className="w-4 h-4 shrink-0" />
            <span>{uploadStatus}</span>
          </div>
        )}

        <div className="space-y-3 max-h-[460px] overflow-y-auto pl-1">
          {personas.length === 0 && (
            <p className="text-slate-400 text-sm">
              עדיין אין פרסונות. צור את האווטאר הראשון שלך בטופס משמאל.
            </p>
          )}
          {personas.map((p) => {
            const active = p.id === selectedId;
            return (
              <div
                key={p.id}
                onClick={() => onSelect(p)}
                className={`p-4 rounded-xl border transition cursor-pointer ${
                  active
                    ? "bg-cyan-500/15 border-cyan-400"
                    : "bg-slate-950/60 border-white/10 hover:border-white/25"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={p.avatar_image_url}
                      alt={p.name}
                      className="w-12 h-12 rounded-full object-cover border border-white/20"
                    />
                    <div>
                      <div className="font-semibold text-white">{p.name}</div>
                      <div className="text-xs text-slate-400">
                        {p.role_title} • {p.voice_id}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(p.id);
                    }}
                    className="p-2 text-slate-400 hover:text-rose-400 transition"
                    title="מחק פרסונה"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <label
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-emerald-300 px-3 py-1.5 rounded-lg cursor-pointer transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    החלף תמונה מהמחשב
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadStatus("מעלה תמונת אווטאר לפרסונה...");
                        try {
                          const updated = await api.uploadPersonaAvatar(p.id, file);
                          setUploadStatus(`תמונת האווטאר של "${updated.name}" עודכנה בהצלחה`);
                          await onRefresh();
                          if (p.id === selectedId) onSelect(updated);
                        } catch (err) {
                          setUploadStatus(`שגיאה בהעלאת תמונה: ${String(err)}`);
                        }
                      }}
                    />
                  </label>
                  <label
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-cyan-300 px-3 py-1.5 rounded-lg cursor-pointer transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    העלה PDF / TXT (RAG)
                    <input
                      type="file"
                      accept=".pdf,.txt,.md"
                      className="hidden"
                      onChange={(e) => handleUpload(p.id, e.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <form
        onSubmit={handleCreate}
        className="bg-slate-900/70 border border-white/10 rounded-2xl p-5 space-y-4"
      >
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Plus className="w-5 h-5 text-cyan-400" />
          יצירת סוכן פגישות חדש
        </h2>

        <div>
          <label className="block text-xs text-slate-300 mb-1">שם האווטאר</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="לדוגמה: עידן AI"
            className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-300 mb-1">תפקיד</label>
            <input
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1">קול ושפה</label>
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
            >
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {userAvatarUrl && (
          <div className="flex items-center gap-3 rounded-xl bg-slate-950/70 border border-white/10 px-3.5 py-2.5">
            <img
              src={userAvatarUrl}
              alt="תמונת פרופיל המשתמש"
              className="w-10 h-10 rounded-full object-cover border border-cyan-400/50"
            />
            <div className="text-xs text-slate-300">
              תמונת האווטאר נלקחת אוטומטית מפרופיל המשתמש שלך.
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs text-slate-300 mb-1">
            הנחיות אישיות (System Prompt)
          </label>
          <textarea
            rows={4}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="w-full bg-slate-950 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
          />
        </div>

        <button
          type="submit"
          disabled={creating}
          className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold py-2.5 rounded-xl transition"
        >
          {creating ? "יוצר סוכן..." : "שמור פרסונה"}
        </button>
      </form>
    </div>
  );
}
