import { useState } from "react";

export default function MailDraftModal({ mail, onClose, onGenerateDraft, onSaveDraft }) {
  const [instruction, setInstruction] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!mail) return null;

  const handleGenerate = async () => {
    setBusy(true);
    setSaved(false);
    try {
      const text = await onGenerateDraft(mail.body || mail.snippet, instruction);
      setDraft(text);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await onSaveDraft(mail, draft);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card w-full max-w-lg">
        <div className="mb-4 flex items-start justify-between">
          <div className="min-w-0">
            <p className="eyebrow">Reply Draft</p>
            <h3 className="truncate text-base font-semibold">{mail.subject}</h3>
            <p className="truncate text-xs text-mute">{mail.from}</p>
          </div>
          <button onClick={onClose} className="text-mute hover:text-paper">
            ✕
          </button>
        </div>

        <p className="mb-3 max-h-28 overflow-y-auto rounded-lg bg-ink-800/70 p-3 text-xs text-mute">
          {mail.snippet}
        </p>

        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="추가 지시(선택): 예) 다음 주로 미루자고 정중히 답장해줘"
          className="mb-3 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-teal-400"
        />

        <button className="btn-secondary mb-3 w-full" onClick={handleGenerate} disabled={busy}>
          {busy && !draft ? "초안 생성 중..." : "AI 답장 초안 생성"}
        </button>

        {draft && (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={8}
              className="mb-3 w-full rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-teal-400"
            />
            <button className="btn-primary w-full" onClick={handleSave} disabled={busy}>
              {saved ? "Gmail 임시보관함에 저장됨 ✓" : "Gmail 임시보관함에 저장"}
            </button>
            <p className="mt-2 text-center text-xs text-mute">
              실제 발송은 Gmail에서 최종 확인 후 직접 눌러야 합니다(자동 발송 없음).
            </p>
          </>
        )}
      </div>
    </div>
  );
}
