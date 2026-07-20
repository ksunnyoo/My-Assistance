function formatTime(dt) {
  if (!dt?.dateTime) return "종일";
  return new Date(dt.dateTime).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EventCard({ events, loading, onRefresh }) {
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="eyebrow">Today</p>
          <h2 className="text-lg font-semibold">오늘 일정</h2>
        </div>
        <button className="btn-secondary px-3 py-1.5 text-xs" onClick={onRefresh} disabled={loading}>
          {loading ? "불러오는 중..." : "새로고침"}
        </button>
      </div>

      {events.length === 0 ? (
        <p className="py-6 text-center text-sm text-mute">오늘 예정된 일정이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {events.map((ev) => (
            <li key={ev.id} className="flex items-start gap-3 rounded-xl bg-ink-800/70 p-3">
              <span className="mt-0.5 shrink-0 font-mono text-xs text-teal-300">
                {formatTime(ev.start)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-paper">{ev.summary || "(제목 없음)"}</p>
                {ev.location && <p className="truncate text-xs text-mute">{ev.location}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
