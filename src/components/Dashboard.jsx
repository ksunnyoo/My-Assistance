import EventCard from "./EventCard";
import MailCard from "./MailCard";
import ChatPanel from "./ChatPanel";
import BriefingPreview from "./BriefingPreview";

export default function Dashboard({
  events,
  mails,
  loadingEvents,
  loadingMails,
  loadingBriefing,
  briefingMarkdown,
  onRefreshEvents,
  onRefreshMails,
  onGenerateBriefing,
  onSelectMail,
  onCommand,
  chatLog,
  chatBusy,
  onSignOut,
  userEmail,
}) {
  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="eyebrow">My AI Assistant</p>
          <h1 className="text-2xl font-bold">오늘의 대시보드</h1>
        </div>
        <div className="flex items-center gap-3">
          {userEmail && <span className="hidden text-xs text-mute sm:inline">{userEmail}</span>}
          <button className="btn-secondary px-3 py-1.5 text-xs" onClick={onSignOut}>
            로그아웃
          </button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="grid gap-5 sm:grid-cols-2">
            <EventCard events={events} loading={loadingEvents} onRefresh={onRefreshEvents} />
            <MailCard
              mails={mails}
              loading={loadingMails}
              onRefresh={onRefreshMails}
              onSelectMail={onSelectMail}
            />
          </div>
          <BriefingPreview
            markdown={briefingMarkdown}
            loading={loadingBriefing}
            onGenerate={onGenerateBriefing}
          />
        </div>

        <div className="lg:col-span-1">
          <ChatPanel onCommand={onCommand} log={chatLog} busy={chatBusy} />
        </div>
      </div>
    </div>
  );
}
