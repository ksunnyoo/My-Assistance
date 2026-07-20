export default function LoginScreen({ onSignIn, loading, error }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <p className="eyebrow mb-3">Personal AI Assistant</p>
        <h1 className="mb-4 text-3xl font-bold leading-tight text-paper sm:text-4xl">
          나의 일정과 메일을
          <br />
          <span className="text-gold-400">한 번에 정리</span>하세요
        </h1>
        <p className="mb-10 text-sm leading-relaxed text-mute">
          Google 계정으로 안전하게 연결하면, Gemini가 오늘 일정과 안 읽은 메일을 요약하고
          답장 초안까지 대신 준비해 드립니다. 토큰은 이 브라우저 메모리에만 저장됩니다.
        </p>

        <button className="btn-primary w-full py-3" onClick={onSignIn} disabled={loading}>
          {loading ? "연결 중..." : "Google 계정으로 연결"}
        </button>

        {error && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="mt-10 grid grid-cols-3 gap-3 text-left">
          {[
            ["📅", "일정 요약"],
            ["📬", "메일 요약"],
            ["✍️", "답장 초안"],
          ].map(([icon, label]) => (
            <div key={label} className="card py-4 text-center">
              <div className="mb-1 text-xl">{icon}</div>
              <div className="text-xs text-mute">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
