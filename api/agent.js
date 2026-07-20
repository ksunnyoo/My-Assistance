import { assistantGraph } from "./_lib/graph.js";

// ⚠️ 이 파일은 Vercel Serverless Function 진입점입니다.
// 실제 AI 비서 로직(의도 분류 → Calendar/Gmail 노드 → Gemini 요약)은
// ./_lib/graph.js 의 LangGraph StateGraph가 전담합니다. 여기서는
// HTTP 요청/응답 처리, 입력 검증, CORS만 담당합니다.

const MAX_INPUT_CHARS = 8000; // 과도한 토큰 사용/비용 방지용 상한

function setCors(res, origin) {
  // 배포 시에는 ALLOWED_ORIGIN 환경변수에 자신의 프론트 도메인만 등록하세요.
  const allowed = process.env.ALLOWED_ORIGIN;
  res.setHeader("Access-Control-Allow-Origin", allowed || origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function clip(value) {
  if (value == null) return value;
  const str = typeof value === "string" ? value : JSON.stringify(value);
  return str.length > MAX_INPUT_CHARS ? str.slice(0, MAX_INPUT_CHARS) : str;
}

export default async function handler(req, res) {
  setCors(res, req.headers.origin);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 허용됩니다." });
  }

  try {
    const { action, payload = {} } = req.body || {};

    if (action !== "runCommand") {
      return res.status(400).json({ error: `알 수 없는 action: ${action}` });
    }

    // accessToken이 실제로 필요한지 여부는 그래프 내부(Calendar/Gmail 노드)에서
    // 노드가 호출될 때 자연스럽게 검증됩니다(draft_reply는 토큰 없이도 동작).
    const result = await assistantGraph.invoke({
      userText: clip(payload.userText || ""),
      forcedIntent: payload.forcedIntent,
      accessToken: payload.accessToken, // 요청 처리 동안만 메모리에 존재, 저장/로그 금지
      mail: payload.mail
        ? {
            body: clip(payload.mail.body),
            snippet: clip(payload.mail.snippet),
            subject: payload.mail.subject,
            from: payload.mail.from,
            threadId: payload.mail.threadId,
          }
        : undefined,
      instruction: clip(payload.instruction || ""),
      nowIso: new Date().toISOString(),
    });

    return res.status(200).json({
      intent: result.intent,
      message: result.message,
      events: result.events,
      mails: result.mails,
      markdown: result.markdown,
      draft: result.draft,
      createdEvent: result.createdEvent,
      sharedTo: result.sharedTo,
    });
  } catch (err) {
    // 사용자에게는 일반화된 메시지만 반환하고, 상세 스택/토큰은 서버 로그에도 남기지 않습니다.
    console.error("[api/agent] error:", err.message);
    return res.status(500).json({ error: "AI 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." });
  }
}
