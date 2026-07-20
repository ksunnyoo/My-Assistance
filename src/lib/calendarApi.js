const CAL_BASE = "https://www.googleapis.com/calendar/v3";

async function callCalendar(accessToken, path, options = {}) {
  const res = await fetch(`${CAL_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Calendar API 오류(${res.status}): ${body}`);
  }
  return res.json();
}

/** 지정한 기간(기본: 오늘)의 일정을 가져옵니다. */
export async function listEvents(accessToken, { timeMin, timeMax } = {}) {
  const now = new Date();
  const start = timeMin || new Date(now.setHours(0, 0, 0, 0)).toISOString();
  const end =
    timeMax || new Date(new Date(start).getTime() + 24 * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams({
    timeMin: start,
    timeMax: end,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "20",
  });

  const data = await callCalendar(accessToken, `/calendars/primary/events?${params}`);
  return data.items || [];
}

/** 자연어 파싱 결과(JSON)를 받아 새 일정을 등록합니다. */
export async function createEvent(accessToken, { summary, description, start, end, attendees }) {
  const body = {
    summary,
    description,
    start: { dateTime: start, timeZone: "Asia/Seoul" },
    end: { dateTime: end, timeZone: "Asia/Seoul" },
    ...(attendees?.length ? { attendees: attendees.map((email) => ({ email })) } : {}),
  };

  return callCalendar(accessToken, "/calendars/primary/events", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** 기존 일정을 수정합니다. */
export async function updateEvent(accessToken, eventId, patch) {
  return callCalendar(accessToken, `/calendars/primary/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
