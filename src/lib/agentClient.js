// 프론트엔드는 Gemini API Key를 절대 알지 못합니다.
// 이 모듈은 오직 우리 서버(/api/agent)만 호출하며, 서버는 LangGraph
// StateGraph(api/_lib/graph.js)를 실행해 의도 분류 → Calendar/Gmail 노드 →
// Gemini 요약까지 한 번의 요청으로 처리합니다.

/**
 * AI 비서에게 명령을 실행시킵니다.
 * @param {object} params
 * @param {string} [params.userText] - 자연어 명령 (forcedIntent가 없으면 필수)
 * @param {string} [params.forcedIntent] - "daily_briefing" 등 UI에서 직접 지정하는 의도
 * @param {string} [params.accessToken] - Google OAuth Access Token (Calendar/Gmail 노드용)
 * @param {object} [params.mail] - 답장 초안 대상 메일
 * @param {string} [params.instruction] - 답장 작성 추가 지시
 */
export async function runCommand({ userText, forcedIntent, accessToken, mail, instruction }) {
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "runCommand",
      payload: { userText, forcedIntent, accessToken, mail, instruction },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `AI 서버 오류 (${res.status})`);
  }
  return data;
  // data: { intent, message, events?, mails?, markdown?, draft?, createdEvent? }
}
