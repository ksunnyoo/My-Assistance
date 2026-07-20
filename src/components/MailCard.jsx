export default function MailCard({ mails, loading, onRefresh, onSelectMail }) {
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="eyebrow">Inbox</p>
          <h2 className="text-lg font-semibold">안 읽은 메일</h2>
        </div>
        <button className="btn-secondary px-3 py-1.5 text-xs" onClick={onRefresh} disabled={loading}>
          {loading ? "불러오는 중..." : "새로고침"}
        </button>
      </div>

      {mails.length === 0 ? (
        <p className="py-6 text-center text-sm text-mute">읽지 않은 메일이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {mails.map((mail) => (
            <li key={mail.id}>
              <button
                onClick={() => onSelectMail(mail)}
                className="w-full rounded-xl bg-ink-800/70 p-3 text-left transition hover:bg-ink-700/70"
              >
                <p className="truncate text-sm font-medium text-paper">{mail.subject}</p>
                <p className="truncate text-xs text-mute">{mail.from}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
