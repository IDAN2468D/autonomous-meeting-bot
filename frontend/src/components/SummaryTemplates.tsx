"use client";

import { useState } from "react";
import { Check, FileText, Plus, Sparkles, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { SummaryTemplate } from "@/types/meeting";

interface Props {
  templates: SummaryTemplate[];
  selectedTemplateId: string;
  onSelect: (templateId: string) => void;
  onRefresh: () => Promise<void>;
}

export function SummaryTemplates({
  templates,
  selectedTemplateId,
  onSelect,
  onRefresh,
}: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("מותאם אישית");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !instructions.trim()) return;
    setSaving(true);
    try {
      const created = await api.createTemplate({
        name: name.trim(),
        category: category.trim() || "כללי",
        description: description.trim(),
        instructions: instructions.trim(),
      });
      setName("");
      setDescription("");
      setInstructions("");
      await onRefresh();
      onSelect(created.id);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Templates Library Grid */}
      <div className="lg:col-span-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              ספריית תבניות סיכום אוטומטיות
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              בחר את התבנית שבה Gemini יסכם את הפגישה ויפיק Action Items בסיום.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tpl) => {
            const isSelected = tpl.id === selectedTemplateId;
            return (
              <div
                key={tpl.id}
                onClick={() => onSelect(tpl.id)}
                className={`cursor-pointer rounded-2xl border p-5 transition-all space-y-3 ${
                  isSelected
                    ? "bg-cyan-500/10 border-cyan-400/60 shadow-lg shadow-cyan-500/10"
                    : "bg-slate-900/60 border-white/10 hover:border-white/25"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/25">
                      {tpl.category}
                    </span>
                    <h3 className="font-bold text-white text-sm">{tpl.name}</h3>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-cyan-400 text-slate-950 px-2.5 py-1 rounded-full">
                        <Check className="w-3 h-3" />
                        פעילה
                      </span>
                    )}
                    {!tpl.builtin && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await api.deleteTemplate(tpl.id);
                          await onRefresh();
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        title="מחק תבנית"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {tpl.description && (
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {tpl.description}
                  </p>
                )}

                <div className="text-[11px] text-slate-400 bg-slate-950/70 border border-white/5 rounded-xl p-2.5 leading-relaxed">
                  <span className="text-cyan-400 font-semibold">הנחיית AI: </span>
                  {tpl.instructions}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Custom Template */}
      <div className="lg:col-span-4">
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-white/10 bg-slate-900/70 backdrop-blur-md p-5 space-y-4 sticky top-6"
        >
          <h3 className="font-bold text-white flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            צור תבנית סיכום מותאמת
          </h3>

          <div className="space-y-1">
            <label className="text-xs text-slate-400">שם התבנית</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: פגישת מוצר רבעונית"
              required
              className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400">קטגוריה</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="מוצר / לקוחות / פיתוח"
              className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400">תיאור קצר</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="מתי להשתמש בתבנית הזו?"
              className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400">הנחיות סיכום ל-Gemini</label>
            <textarea
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="לדוגמה: ציין החלטות מרכזיות, תקציב, תאריכי יעד ואחראים לכל משימה."
              required
              className="w-full bg-slate-950 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-l from-cyan-400 to-indigo-500 hover:brightness-110 disabled:opacity-50 text-slate-950 font-bold py-2.5 rounded-xl text-sm transition"
          >
            <Plus className="w-4 h-4" />
            {saving ? "שומר תבנית..." : "שמור תבנית חדשה"}
          </button>
        </form>
      </div>
    </div>
  );
}
