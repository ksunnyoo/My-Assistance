import { useState, useRef, useEffect } from "react";

export default function ChatPanel({ onCommand, log, busy }) {
  const [text, setText] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    onCommand(text.trim());
    setText("");
  };

  return (
    <div className="card flex h-full flex-col">
      <div className="mb-3">
        <p className="eyebrow">AI Assistant</p>
        <h2 className="text-lg font-semibold">명령 입력</h2>
      </div>

      <div className="mb-3 flex-1 space-y-3 overflow-y-auto pr-1" style={{ maxHeight: 320 }}>
        {log.length === 0 && (
          <p className="text-sm text-mute">
            예) "내일 오전 10시에 팀 회의 등록해줘", "오늘 일정 요약해줘", "안 읽은 메일 요약해줘"
          </p>
        )}
        {log.map((item, i) => (
          <div key={i} className={item.role === "user" ? "text-right" : "text-left"}>
            <span
              className={
                item.role === "user"
                  ? "inline-block max-w-[85%] rounded-2xl rounded-br-sm bg-gold-500 px-3 py-2 text-sm text-ink-950"
                  : "inline-block max-w-[85%] rounded-2xl rounded-bl-sm bg-ink-800 px-3 py-2 text-sm text-paper whitespace-pre-wrap"
              }
            >
              {item.text}
            </span>
          </div>
        ))}
        {busy && <p className="text-xs text-teal-300">AI가 처리 중입니다...</p>}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="자연어로 명령을 입력하세요..."
          className="flex-1 rounded-xl border border-ink-700 bg-ink-900 px-3 py-2.5 text-sm outline-none focus:border-teal-400"
        />
        <button type="submit" className="btn-primary" disabled={busy}>
          전송
        </button>
      </form>
    </div>
  );
}
