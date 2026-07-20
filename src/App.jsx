import { useState, useCallback } from "react";
import LoginScreen from "./components/LoginScreen";
import Dashboard from "./components/Dashboard";
import MailDraftModal from "./components/MailDraftModal";
import { signInWithGoogle, revokeGoogleToken, getUserInfo } from "./lib/googleAuth";
import { listEvents } from "./lib/calendarApi";
import { listRecentMails, createDraftReply } from "./lib/gmailApi";
import { runCommand } from "./lib/agentClient";

function extractEmailAddress(fromHeader) {
  const match = fromHeader?.match(/<(.+)>/);
  return match ? match[1] : fromHeader;
}

export default function App() {
  // ── 인증 상태 (토큰은 메모리에만 존재, localStorage 미사용) ──
  const [session, setSession] = useState(null); // { accessToken, expiresAt, email }
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // ── 데이터 상태 ──
  const [events, setEvents] = useState([]);
  const [mails, setMails] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingMails, setLoadingMails] = useState(false);

  // ── 브리핑 ──
  const [briefingMarkdown, setBriefingMarkdown] = useState("");
  const [loadingBriefing, setLoadingBriefing] = useState(false);

  // ── 채팅 ──
  const [chatLog, setChatLog] = useState([]);
  const [chatBusy, setChatBusy] = useState(false);

  // ── 메일 답장 모달 ──
  const [selectedMail, setSelectedMail] = useState(null);

  const pushChat = (role, text) => setChatLog((log) => [...log, { role, text }]);

  const requireToken = () => {
    if (!session?.accessToken || Date.now() > session.expiresAt) {
      throw new Error("세션이 만료되었습니다. 다시 로그인해주세요.");
    }
    return session.accessToken;
  };

  // 대시보드의 단순 "새로고침" 버튼은 AI를 거치지 않고 Google API를 바로 호출합니다
  // (요약이 필요 없는 단순 조회이므로 Gemini 호출 비용을 아낍니다).
  const refreshEvents = useCallback(async () => {
    setLoadingEvents(true);
    try {
      const items = await listEvents(requireToken());
      setEvents(items);
      return items;
    } finally {
      setLoadingEvents(false);
    }
  }, [session]);

  const refreshMails = useCallback(async () => {
    setLoadingMails(true);
    try {
      const items = await listRecentMails(requireToken(), { maxResults: 5 });
      setMails(items);
      return items;
    } finally {
      setLoadingMails(false);
    }
  }, [session]);

  const handleSignIn = async () => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const { accessToken, expiresAt } = await signInWithGoogle();
      const info = await getUserInfo(accessToken);
      setSession({ accessToken, expiresAt, email: info?.email || "" });
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = () => {
    revokeGoogleToken(session?.accessToken);
    setSession(null);
    setEvents([]);
    setMails([]);
    setBriefingMarkdown("");
    setChatLog([]);
  };

  // "브리핑 생성" 버튼: LangGraph의 briefing 노드(Calendar+Gmail 조회 → Gemini 종합)를 직접 실행
  const handleGenerateBriefing = async () => {
    setLoadingBriefing(true);
    try {
      const result = await runCommand({ forcedIntent: "daily_briefing", accessToken: requireToken() });
      if (result.events) setEvents(result.events);
      if (result.mails) setMails(result.mails);
      setBriefingMarkdown(result.markdown || "");
    } catch (err) {
      pushChat("assistant", `브리핑 생성 중 오류: ${err.message}`);
    } finally {
      setLoadingBriefing(false);
    }
  };

  // 메일 카드에서 메일을 선택했을 때: LangGraph의 gmailDraft 노드를 직접 실행
  const handleGenerateDraft = async (mailBody, instruction) => {
    const result = await runCommand({
      forcedIntent: "draft_reply",
      mail: { body: mailBody },
      instruction,
    });
    return result.draft;
  };

  // 초안 저장은 AI 판단이 필요 없는 단순 Gmail API 호출이므로 클라이언트에서 바로 처리
  const handleSaveDraft = async (mail, draftText) => {
    const token = requireToken();
    await createDraftReply(token, {
      threadId: mail.threadId,
      to: extractEmailAddress(mail.from),
      subject: mail.subject?.startsWith("Re:") ? mail.subject : `Re: ${mail.subject}`,
      bodyText: draftText,
    });
  };

  // 채팅 입력: LangGraph 전체 파이프라인(의도 분류 → 해당 노드 → Gemini 요약)을 한 번에 실행
  const handleCommand = async (text) => {
    pushChat("user", text);
    setChatBusy(true);
    try {
      const result = await runCommand({ userText: text, accessToken: session?.accessToken });

      if (result.events) setEvents(result.events);
      if (result.mails) setMails(result.mails);
      if (result.markdown) setBriefingMarkdown(result.markdown);

      pushChat("assistant", result.message || "처리를 완료했습니다.");
    } catch (err) {
      pushChat("assistant", `오류가 발생했습니다: ${err.message}`);
    } finally {
      setChatBusy(false);
    }
  };

  if (!session) {
    return <LoginScreen onSignIn={handleSignIn} loading={authLoading} error={authError} />;
  }

  return (
    <>
      <Dashboard
        events={events}
        mails={mails}
        loadingEvents={loadingEvents}
        loadingMails={loadingMails}
        loadingBriefing={loadingBriefing}
        briefingMarkdown={briefingMarkdown}
        onRefreshEvents={refreshEvents}
        onRefreshMails={refreshMails}
        onGenerateBriefing={handleGenerateBriefing}
        onSelectMail={setSelectedMail}
        onCommand={handleCommand}
        chatLog={chatLog}
        chatBusy={chatBusy}
        onSignOut={handleSignOut}
        userEmail={session.email}
      />
      <MailDraftModal
        mail={selectedMail}
        onClose={() => setSelectedMail(null)}
        onGenerateDraft={handleGenerateDraft}
        onSaveDraft={handleSaveDraft}
      />
    </>
  );
}
