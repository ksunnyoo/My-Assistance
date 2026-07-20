import ReactMarkdown from "react-markdown";

export default function BriefingPreview({ markdown, loading, onGenerate }) {
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="eyebrow">Daily Briefing</p>
          <h2 className="text-lg font-semibold">오늘의 브리핑</h2>
        </div>
        <button className="btn-primary px-3 py-1.5 text-xs" onClick={onGenerate} disabled={loading}>
          {loading ? "생성 중..." : "브리핑 생성"}
        </button>
      </div>

      {markdown ? (
        <div className="prose-briefing max-w-none text-sm leading-relaxed text-paper/90">
          <ReactMarkdown
            components={{
              h2: (props) => <h3 className="mb-2 mt-4 text-base font-semibold text-gold-400" {...props} />,
              li: (props) => <li className="ml-4 list-disc text-sm text-paper/85" {...props} />,
              strong: (props) => <strong className="text-teal-300" {...props} />,
            }}
          >
            {markdown}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-mute">
          "브리핑 생성"을 누르면 오늘 일정과 메일을 종합해 요약해 드립니다.
        </p>
      )}
    </div>
  );
}
