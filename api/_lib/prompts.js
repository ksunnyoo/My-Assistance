// 모든 프롬프트는 "오늘 날짜/시간"을 함께 넘겨 상대 표현("내일", "이번 주")을
// 서버가 아닌 클라이언트 타임존 기준으로 정확히 해석하도록 합니다.

export function intentPrompt(userText, nowIso) {
  return `당신은 일정/메일 비서의 의도 분류기입니다.
현재 시각(ISO): ${nowIso}
사용자 입력: "${userText}"

다음 중 하나의 intent로만 분류하고, 반드시 아래 JSON 형식으로만 답하세요(설명 금지):
- "list_events": 일정 조회/요약 요청 (공유·전달 언급 없음)
- "create_event": 새 일정 등록 요청
- "summarize_mail": 메일 요약 요청
- "draft_reply": 메일 답장 작성 요청
- "share_summary": 일정을 정리해서 "공유해줘/전달해줘/보내줘/알려줘"처럼 다른 사람에게 보내달라는 요청
- "daily_briefing": 오늘 하루 브리핑(일정+메일 종합) 요청
- "unknown": 위에 해당하지 않음

{"intent": "..."}`;
}

export function shareEmailPrompt(userText, eventsJson, nowIso) {
  return `현재 시각(ISO, Asia/Seoul): ${nowIso}
사용자가 아래처럼 일정을 정리해서 팀/특정 사람에게 "공유"해달라고 요청했습니다.

사용자 요청: "${userText}"

오늘 일정 데이터:
${eventsJson}

이 요청에서 받는 사람의 이메일 주소를 찾아내고, 위 일정 데이터를 바탕으로 공유용 이메일의
제목과 본문을 한국어로 작성하세요. 본문은 정중하고 간결한 사무 톤으로, 일정을 불릿으로 정리하세요.
받는 사람 이메일이 텍스트에 전혀 언급되지 않았다면 recipients를 빈 배열로 두세요.

반드시 아래 JSON 형식으로만 답하세요:
{
  "recipients": ["email@example.com"],
  "subject": "이메일 제목",
  "body": "이메일 본문 (인사말/맺음말 포함)"
}`;
}

export function eventParsePrompt(userText, nowIso) {
  return `현재 시각(ISO, Asia/Seoul): ${nowIso}
아래 사용자 요청에서 캘린더 일정 정보를 추출해 JSON으로만 답하세요.

사용자 요청: "${userText}"

형식:
{
  "summary": "일정 제목",
  "description": "선택적 설명(없으면 빈 문자열)",
  "start": "ISO8601 (예: 2026-07-20T10:00:00+09:00)",
  "end": "ISO8601, 명시 안되면 start+1시간",
  "attendees": ["email@example.com"]  // 언급 없으면 빈 배열
}
JSON 외 다른 텍스트는 출력하지 마세요.`;
}

export function summarizeEventsPrompt(eventsJson) {
  return `다음은 사용자의 오늘 일정 데이터(JSON)입니다. 바쁜 직장인이 5초 안에 훑어볼 수 있도록
한국어로 핵심만 요약하세요. 일정이 없으면 "오늘은 예정된 일정이 없습니다."라고 답하세요.
불릿 포인트 형식, 각 항목은 "시간 - 제목" 형태로 시작하세요.

일정 데이터:
${eventsJson}`;
}

export function summarizeMailsPrompt(mailsJson) {
  return `다음은 사용자의 최근 안 읽은 메일 데이터(JSON)입니다. 각 메일을 3줄 이내로 한국어 요약하세요.
형식:
### [보낸사람] 제목
- 핵심 요약 (최대 3줄)

메일 데이터:
${mailsJson}`;
}

export function draftReplyPrompt(mailBody, instruction) {
  return `다음은 원본 메일 본문입니다:
"""
${mailBody}
"""

사용자 추가 지시사항: "${instruction || "정중하고 간결하게 답장 작성"}"

위 내용을 바탕으로 한국어 답장 초안을 작성하세요. 인사말과 맺음말을 포함하되,
과장된 표현 없이 간결하고 사무적인 톤을 유지하세요. 답장 본문만 출력하세요(제목 제외).`;
}

export function dailyBriefingPrompt(eventsJson, mailsJson, nowIso) {
  return `현재 시각(ISO): ${nowIso}
아래 일정과 메일 데이터를 바탕으로 "오늘의 브리핑"을 Markdown으로 작성하세요.

구성:
## 📅 오늘의 일정
(시간순 불릿, 없으면 "예정된 일정 없음")

## 📬 주요 메일
(발신자/제목/한줄요약 불릿, 없으면 "읽지 않은 메일 없음")

## ✅ 오늘의 우선순위 제안
(위 데이터를 근거로 한 2~3개의 실행 가능한 제안)

일정 데이터:
${eventsJson}

메일 데이터:
${mailsJson}`;
}
