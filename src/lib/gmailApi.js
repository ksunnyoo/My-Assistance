const GMAIL_BASE = "https://www.googleapis.com/gmail/v1/users/me";

async function callGmail(accessToken, path, options = {}) {
  const res = await fetch(`${GMAIL_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail API 오류(${res.status}): ${body}`);
  }
  return res.json();
}

function decodeBase64Url(data) {
  try {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    return decodeURIComponent(escape(atob(base64)));
  } catch {
    return "";
  }
}

function extractPlainText(payload) {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractPlainText(part);
      if (text) return text;
    }
  }
  return "";
}

function getHeader(headers, name) {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

/** 최근 읽지 않은 메일 목록을 요약용으로 가져옵니다. (최대 개수 제한) */
export async function listRecentMails(accessToken, { maxResults = 5, query = "is:unread" } = {}) {
  const params = new URLSearchParams({ maxResults: String(maxResults), q: query });
  const list = await callGmail(accessToken, `/messages?${params}`);
  const ids = list.messages || [];

  const mails = await Promise.all(
    ids.map(async ({ id }) => {
      const msg = await callGmail(accessToken, `/messages/${id}?format=full`);
      const headers = msg.payload?.headers || [];
      return {
        id: msg.id,
        threadId: msg.threadId,
        subject: getHeader(headers, "Subject") || "(제목 없음)",
        from: getHeader(headers, "From"),
        snippet: msg.snippet || "",
        body: extractPlainText(msg.payload).slice(0, 3000), // 과도한 페이로드 방지
      };
    })
  );

  return mails;
}

/** 답장 "임시보관함 초안"을 생성합니다. 실제 발송은 사용자가 Gmail에서 최종 확인 후 진행합니다. */
export async function createDraftReply(accessToken, { threadId, to, subject, bodyText }) {
  const raw = buildRawMessage({ to, subject, bodyText });
  return callGmail(accessToken, "/drafts", {
    method: "POST",
    body: JSON.stringify({
      message: { threadId, raw },
    }),
  });
}

/**
 * 답장이 아닌 "새 메일" 임시보관함 초안을 생성합니다 (예: 일정 요약을 팀에 공유).
 * 실제 발송은 사용자가 Gmail에서 최종 확인 후 진행합니다.
 */
export async function createDraft(accessToken, { to, subject, bodyText }) {
  const raw = buildRawMessage({ to, subject, bodyText });
  return callGmail(accessToken, "/drafts", {
    method: "POST",
    body: JSON.stringify({ message: { raw } }),
  });
}

function buildRawMessage({ to, subject, bodyText }) {
  const mail = [`To: ${to}`, `Subject: ${subject}`, "Content-Type: text/plain; charset=utf-8", "", bodyText].join(
    "\r\n"
  );
  const utf8 = unescape(encodeURIComponent(mail));
  const base64 = btoa(utf8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return base64;
}
