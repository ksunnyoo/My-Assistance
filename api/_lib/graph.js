// ============================================================
// LangGraph 기반 "AI 비서" 노드 구성
// ------------------------------------------------------------
// 이 파일은 실습 요구사항의 2단계(LangGraph 설치 및 노드 구성)와
// 3단계(비서 노드 구성)를 실제로 구현합니다.
//
//                     ┌───────────────────┐
//                     │  classifyIntent    │  (Gemini: 의도 분류)
//                     └─────────┬──────────┘
//              ┌───────┬────────┼────────┬────────┐
//              ▼       ▼        ▼        ▼        ▼
//        calendarRead calendarWrite gmailRead gmailDraft briefing  fallback
//              │            │          │                              │
//              ▼            ▼          ▼                              │
//      summarizeEvents formatCreateEvent summarizeMails                │
//              │            │          │                              │
//              └────────────┴──────────┴───────────┬──────────────────┘
//                                                   ▼
//                                                  END
//
// - Calendar/Gmail 노드는 사용자의 Google OAuth Access Token으로 실제 API를 호출합니다.
// - 이 토큰은 요청(invoke) 동안에만 메모리에 존재하며, 서버에 저장하거나 로그로 남기지 않습니다.
// ============================================================

import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { askGemini, extractJson } from "./gemini.js";
import {
  intentPrompt,
  eventParsePrompt,
  summarizeEventsPrompt,
  summarizeMailsPrompt,
  draftReplyPrompt,
  dailyBriefingPrompt,
  shareEmailPrompt,
} from "./prompts.js";
import { listEvents, createEvent } from "../../src/lib/calendarApi.js";
import { listRecentMails, createDraft } from "../../src/lib/gmailApi.js";

// ── 1. 그래프 State 스키마 정의 ──
// 각 노드는 State의 일부만 반환(patch)하며, LangGraph가 자동으로 병합합니다.
const AssistantState = Annotation.Root({
  userText: Annotation(),      // 사용자가 입력한 자연어 명령
  forcedIntent: Annotation(),  // 버튼 클릭 등 UI에서 직접 지정하는 의도(분류 단계 생략용)
  nowIso: Annotation(),        // 상대 시간("내일") 해석 기준 시각
  accessToken: Annotation(),   // Google OAuth Access Token (요청 단위로만 사용)
  mail: Annotation(),          // 답장 초안 대상 메일(선택된 경우)
  instruction: Annotation(),   // 답장 작성 시 추가 지시사항

  intent: Annotation(),        // 분류된 의도
  events: Annotation(),        // Calendar 조회 결과
  mails: Annotation(),         // Gmail 조회 결과
  createdEvent: Annotation(),  // 새로 등록된 일정
  message: Annotation(),       // 채팅창에 표시할 텍스트 응답
  markdown: Annotation(),      // 하루 브리핑 Markdown
  draft: Annotation(),         // 메일 답장 초안 텍스트
  sharedTo: Annotation(),      // 공유 초안을 만든 수신자 목록
});

// ── 2. 노드 정의 ──

/** 의도 분류 노드: 자연어 명령을 6가지 intent 중 하나로 분류합니다. */
async function classifyIntentNode(state) {
  if (state.forcedIntent) return { intent: state.forcedIntent };
  const raw = await askGemini(intentPrompt(state.userText, state.nowIso));
  const { intent } = extractJson(raw);
  return { intent };
}

/** Calendar 노드 (읽기): Google Calendar API에서 오늘 일정을 가져옵니다. */
async function calendarReadNode(state) {
  const events = await listEvents(state.accessToken);
  return { events };
}

/** Calendar 노드 (쓰기): 자연어를 일정 데이터로 파싱해 새 일정을 등록합니다. */
async function calendarWriteNode(state) {
  const raw = await askGemini(eventParsePrompt(state.userText, state.nowIso));
  const parsed = extractJson(raw);
  const created = await createEvent(state.accessToken, parsed);
  return { createdEvent: { ...parsed, id: created.id } };
}

function formatCreateEventNode(state) {
  const e = state.createdEvent;
  const when = new Date(e.start).toLocaleString("ko-KR");
  return { message: `일정을 등록했습니다 ✅\n"${e.summary}" (${when})` };
}

/** Gmail 노드 (읽기): 최근 안 읽은 메일을 가져옵니다. */
async function gmailReadNode(state) {
  const mails = await listRecentMails(state.accessToken, { maxResults: 5 });
  return { mails };
}

/** Gmail 노드 (초안): 선택된 메일에 대한 답장 초안을 Gemini로 생성합니다. */
async function gmailDraftNode(state) {
  if (!state.mail) {
    return { message: "답장을 작성할 메일을 먼저 목록에서 선택해주세요." };
  }
  const draft = await askGemini(
    draftReplyPrompt(state.mail.body || state.mail.snippet || "", state.instruction)
  );
  return { draft, message: "답장 초안을 생성했습니다. 아래 내용을 확인하고 필요하면 수정해주세요." };
}

/** Gemini 요약 노드: 조회된 일정을 사람이 읽기 좋은 형태로 요약합니다. */
async function summarizeEventsNode(state) {
  const summary = await askGemini(summarizeEventsPrompt(JSON.stringify(state.events || [])));
  return { message: summary };
}

/** Gemini 요약 노드: 조회된 메일을 요약합니다. */
async function summarizeMailsNode(state) {
  const summary = await askGemini(summarizeMailsPrompt(JSON.stringify(state.mails || [])));
  return { message: summary };
}

/** 브리핑 노드: Calendar + Gmail을 함께 조회한 뒤 Gemini로 종합 브리핑을 생성합니다. */
async function briefingNode(state) {
  const [events, mails] = await Promise.all([
    listEvents(state.accessToken),
    listRecentMails(state.accessToken, { maxResults: 5 }),
  ]);
  const markdown = await askGemini(
    dailyBriefingPrompt(JSON.stringify(events), JSON.stringify(mails), state.nowIso)
  );
  return { events, mails, markdown, message: "오늘의 브리핑을 생성했습니다. 브리핑 패널을 확인해주세요 📋" };
}

/**
 * Gmail 노드 (공유): 오늘 일정을 정리해 팀/특정 수신자에게 "공유용 새 메일 초안"을 만듭니다.
 * 실제 발송은 하지 않고 Gmail 임시보관함에만 저장합니다(발송 권한 없음).
 */
async function shareSummaryNode(state) {
  const events = await listEvents(state.accessToken);
  const raw = await askGemini(shareEmailPrompt(state.userText, JSON.stringify(events), state.nowIso));
  const { recipients, subject, body } = extractJson(raw);

  if (!recipients || recipients.length === 0) {
    return {
      events,
      message:
        "일정은 정리했는데, 공유받을 분의 이메일 주소를 못 찾았어요. " +
        '예) "내일 일정 정리해서 minsu@company.com 에게 공유해줘" 처럼 이메일을 포함해 다시 말씀해주세요.',
    };
  }

  await createDraft(state.accessToken, { to: recipients.join(","), subject, bodyText: body });

  return {
    events,
    sharedTo: recipients,
    message:
      `${recipients.join(", ")} 앞으로 일정 공유 메일 초안을 Gmail 임시보관함에 만들었습니다 ✅\n` +
      "Gmail에서 내용을 확인하고 직접 발송해주세요(자동 발송되지 않습니다).",
  };
}

/** 결과 반환 노드(기본): 분류되지 않은 명령에 대한 안내 메시지 */
function fallbackNode() {
  return {
    message:
      "죄송해요, 이해하지 못했어요. '오늘 일정 요약해줘', '메일 요약해줘', '내일 3시 회의 등록해줘'처럼 말씀해보세요.",
  };
}

// ── 3. 조건부 라우팅: classifyIntent 노드 다음에 어느 노드로 갈지 결정 ──
function routeByIntent(state) {
  switch (state.intent) {
    case "list_events":
      return "calendarRead";
    case "create_event":
      return "calendarWrite";
    case "summarize_mail":
      return "gmailRead";
    case "draft_reply":
      return "gmailDraft";
    case "share_summary":
      return "shareSummary";
    case "daily_briefing":
      return "briefing";
    default:
      return "fallback";
  }
}

// ── 4. 그래프 조립 ──
const graph = new StateGraph(AssistantState)
  .addNode("classifyIntent", classifyIntentNode)
  .addNode("calendarRead", calendarReadNode)
  .addNode("calendarWrite", calendarWriteNode)
  .addNode("formatCreateEvent", formatCreateEventNode)
  .addNode("gmailRead", gmailReadNode)
  .addNode("gmailDraft", gmailDraftNode)
  .addNode("shareSummary", shareSummaryNode)
  .addNode("summarizeEvents", summarizeEventsNode)
  .addNode("summarizeMails", summarizeMailsNode)
  .addNode("briefing", briefingNode)
  .addNode("fallback", fallbackNode)

  .addEdge(START, "classifyIntent")
  .addConditionalEdges("classifyIntent", routeByIntent, {
    calendarRead: "calendarRead",
    calendarWrite: "calendarWrite",
    gmailRead: "gmailRead",
    gmailDraft: "gmailDraft",
    shareSummary: "shareSummary",
    briefing: "briefing",
    fallback: "fallback",
  })

  .addEdge("calendarRead", "summarizeEvents")
  .addEdge("summarizeEvents", END)

  .addEdge("calendarWrite", "formatCreateEvent")
  .addEdge("formatCreateEvent", END)

  .addEdge("gmailRead", "summarizeMails")
  .addEdge("summarizeMails", END)

  .addEdge("gmailDraft", END)
  .addEdge("shareSummary", END)
  .addEdge("briefing", END)
  .addEdge("fallback", END);

export const assistantGraph = graph.compile();
