# My AI Assistant

Google Calendar / Gmail을 Gemini와 연결해 **일정 요약, 메일 요약, 답장 초안, 일정 등록, 일정 공유,
하루 브리핑**을 자연어 명령으로 처리하는 개인 AI 비서 웹앱입니다. 전량 무료 티어(Vercel/Netlify Free +
Gemini API 무료 쿼터 + Google API 무료 쿼터)로 운영 가능하도록 설계했습니다.

## 아키텍처 요약

```
브라우저(React/Vite) ── OAuth 토큰으로 직접 호출 ──▶ Google Calendar / Gmail API
        │
        └── /api/agent (Vercel Serverless Function, Gemini API Key 서버 보관) ──▶ Gemini API
```

- **Gemini API Key는 브라우저에 절대 노출되지 않습니다.** `api/agent.js`(서버)에서만 사용합니다.
- Google Calendar/Gmail은 **사용자 본인의 OAuth Access Token**으로 브라우저가 직접 호출합니다
  (구글 서버가 요청을 인증 → 우리 서버를 거치지 않아 더 안전하고 빠릅니다).
- Access Token은 **localStorage에 저장하지 않고 메모리(React state)에만** 보관합니다. 새로고침 시
  재로그인이 필요하지만, XSS로 인한 토큰 영구 탈취 위험을 줄입니다.

## 폴더 구조

```
my-ai-assistant/
├── api/                  # Vercel Serverless Functions (Gemini/LangGraph 실행, 서버 전용)
│   ├── agent.js           # HTTP 진입점 (요청 검증 → assistantGraph.invoke() 호출)
│   └── _lib/
│       ├── graph.js        # ★ LangGraph StateGraph 정의 (노드 + 조건부 엣지)
│       ├── gemini.js        # Gemini 클라이언트 + askGemini/extractJson 헬퍼
│       └── prompts.js       # 노드별 프롬프트 템플릿
├── src/
│   ├── components/        # UI 컴포넌트
│   ├── lib/                 # googleAuth / calendarApi / gmailApi / agentClient
│   │                          (calendarApi.js, gmailApi.js는 브라우저와 graph.js
│   │                           양쪽에서 그대로 import되어 재사용됩니다)
│   ├── App.jsx
│   └── config.js
├── .env.example           # 실제 키가 없는 템플릿 (커밋 대상)
├── .gitignore              # .env, node_modules, dist 등 제외
└── package.json
```

## LangGraph 노드 구성 (`api/_lib/graph.js`)

이 프로젝트의 "AI 비서"는 `@langchain/langgraph`의 `StateGraph`로 구현되어 있습니다.
사용자 명령 하나가 들어오면 아래 그래프를 따라 노드를 거치며 처리됩니다.

```
                    ┌───────────────────┐
                    │  classifyIntent    │  Gemini: 자연어 → intent 분류
                    └─────────┬──────────┘
    ┌───────────┬─────────┬───┼─────┬───────────┬───────────┐
    ▼           ▼         ▼   ▼     ▼           ▼           ▼
calendarRead calendarWrite gmailRead gmailDraft shareSummary briefing  (미해당 시 fallback)
    │           │         │
    ▼           ▼         ▼
summarizeEvents formatCreateEvent summarizeMails
    │           │         │
    └───────────┴─────────┴──────────────────┬─────────────────┘
                                              ▼
                                             END
```

| 노드 | 역할 | 사용 API |
|---|---|---|
| `classifyIntent` | 자연어 명령을 7개 intent 중 하나로 분류 | Gemini |
| `calendarRead` | 오늘 일정 조회 | Google Calendar API |
| `calendarWrite` | 자연어 → 일정 JSON 파싱 후 등록 | Gemini + Google Calendar API |
| `gmailRead` | 안 읽은 메일 조회 | Gmail API |
| `gmailDraft` | 선택된 메일에 대한 답장 초안 생성 | Gemini |
| `shareSummary` | 오늘 일정을 정리해 팀/특정 수신자 앞 "공유 메일 초안"을 Gmail 임시보관함에 생성 | Gemini + Google Calendar API + Gmail API |
| `summarizeEvents` / `summarizeMails` | 조회 결과를 자연어로 요약 | Gemini |
| `briefing` | Calendar+Gmail 동시 조회 후 종합 브리핑 생성 | Gemini + 양쪽 API |
| `fallback` | 분류되지 않은 명령 안내 | - |

State(그래프 상태)는 `userText`, `accessToken`, `intent`, `events`, `mails`, `message`, `markdown`,
`draft` 등의 필드로 구성되며, 각 노드는 필요한 필드만 patch로 반환하고 LangGraph가 자동 병합합니다.
`Google OAuth Access Token`은 `invoke()` 호출 동안에만 메모리에 존재하고, 서버에 저장되거나 로그에
남지 않습니다.

프론트엔드는 이 전체 그래프를 **`/api/agent`에 대한 단일 POST 요청**(`agentClient.runCommand`)으로
실행시킵니다 — 즉 "채팅 입력 1번 = 그래프 실행 1번"입니다.

## 1. 사전 준비 (Google Cloud Console)

1. https://console.cloud.google.com 에서 새 프로젝트 생성
2. **API 및 서비스 → 라이브러리**에서 아래 2개 API 활성화
   - Google Calendar API
   - Gmail API
3. **API 및 서비스 → OAuth 동의 화면** 설정
   - User Type: 외부(Testing) 선택 후, 본인 계정을 "테스트 사용자"로 추가
   - Scopes에 아래 항목 추가:
     - `.../auth/calendar.events`, `.../auth/calendar.readonly`
     - `.../auth/gmail.readonly`, `.../auth/gmail.compose`
     - `.../auth/userinfo.email`
4. **API 및 서비스 → 사용자 인증 정보 → OAuth 클라이언트 ID 만들기**
   - 애플리케이션 유형: **웹 애플리케이션**
   - 승인된 자바스크립트 원본에 다음을 등록:
     - `http://localhost:5173` (로컬 개발)
     - 실제 배포 도메인 (예: `https://my-ai-assistant.vercel.app`)
   - 발급된 **클라이언트 ID**를 복사해둡니다.

## 2. Gemini API Key 발급

https://aistudio.google.com/apikey 에서 무료 API Key를 발급받습니다.

## 3. 로컬 환경 설정

```bash
git clone <your-repo-url>
cd my-ai-assistant
npm install
cp .env.example .env
```

`.env` 파일을 열어 아래 값을 채웁니다.

```
GEMINI_API_KEY=발급받은_Gemini_키
VITE_GOOGLE_CLIENT_ID=발급받은_OAuth_클라이언트_ID
```

> `.env`는 `.gitignore`에 포함되어 있어 `git add .` 를 해도 **GitHub에 올라가지 않습니다.**
> 커밋 전 `git status`로 `.env`가 목록에 없는지 반드시 확인하세요.

### 로컬 실행 (Vercel 계정 불필요)

```bash
npm run dev
```

`vite.config.js`에 개발 전용 미니 API 서버가 포함되어 있어서, **`npm run dev` 하나만으로 `/api/agent`까지
포함해 전체 기능이 로컬(`http://localhost:5173`)에서 동작합니다.** Vercel 계정을 만들거나 `vercel dev`를
실행할 필요가 없습니다.

> 이 미니 서버는 개발 모드에서만 동작하며, 실제 배포 시(`vercel` 또는 Vercel 대시보드에서 배포)에는
> `api/` 폴더가 자동으로 Vercel Serverless Functions로 인식되어 **같은 코드가 그대로** 실행됩니다.
> 즉 로컬과 배포 환경에서 코드를 다르게 관리할 필요가 없습니다.

배포까지 미리 테스트해보고 싶다면(선택 사항) Vercel CLI로도 실행할 수 있습니다.

```bash
npm i -g vercel
vercel dev   # 기본적으로 http://localhost:3000 에서 실행됩니다
```

## 4. GitHub 업로드 전 체크리스트 (개인정보 노출 방지)

- [ ] `git status`에서 `.env` 파일이 목록에 **없는지** 확인
- [ ] 코드 어디에도 실제 이메일 주소, 이름, API Key, 전화번호가 하드코딩되어 있지 않은지 검색
      ```bash
      grep -rniE "AIza[0-9A-Za-z_-]{35}|@gmail\.com|api[_-]?key\s*=\s*['\"]" src/ api/ --exclude-dir=node_modules
      ```
- [ ] `README.md`, 커밋 메시지, 코드 주석에 개인 계정 정보를 남기지 않았는지 확인
- [ ] 저장소를 Public으로 올릴 경우, GitHub의 **Secret scanning / Push protection**(Settings →
      Code security)을 활성화해 실수로 키가 커밋되는 것을 한 번 더 방지
- [ ] 이미 실수로 커밋한 적이 있다면 `git log`에서 이력까지 지워야 합니다(단순 삭제 커밋만으로는
      과거 이력에 키가 남습니다) → `git filter-repo` 또는 BFG Repo-Cleaner 사용 후 **반드시 해당 키를
      재발급(rotate)** 하세요.
- [ ] `.env.example`에는 플레이스홀더만 있는지 최종 확인

## 5. 배포 (Vercel, 무료)

1. GitHub 저장소를 Vercel에 Import
2. **Project Settings → Environment Variables**에 아래 값을 등록 (여기가 실제 키의 유일한 저장소입니다)
   - `GEMINI_API_KEY` (Production/Preview 모두)
   - `VITE_GOOGLE_CLIENT_ID`
   - `ALLOWED_ORIGIN` = 배포된 정확한 도메인 (예: `https://my-ai-assistant.vercel.app`)
3. Deploy
4. Google Cloud Console의 "승인된 자바스크립트 원본"에 실제 배포 URL 추가

Netlify를 사용할 경우 `api/agent.js`를 Netlify Functions 형식(`netlify/functions/agent.js`,
`event`/`context` 시그니처)으로 소폭 수정하면 동일하게 동작합니다.

## 6. 권한 및 보안 설계 요약

| 항목 | 설계 |
|---|---|
| Gemini API Key | 서버(Serverless Function)에만 존재, 브라우저 번들에 포함 안 됨 |
| Google OAuth 토큰 | 메모리에만 저장, localStorage 미사용, 새로고침 시 재인증 |
| 요청 권한(Scope) | 필요한 최소 권한만 요청 (Gmail은 읽기 + 임시보관함 초안까지만, 발송 권한 없음) |
| 메일 발송 | AI가 답장/공유 메일 모두 "초안"까지만 생성, 실제 발송은 사용자가 Gmail에서 직접 확인 후 클릭 |
| CORS | `ALLOWED_ORIGIN` 환경변수로 배포 도메인만 허용 가능 |
| 입력 길이 제한 | 서버에서 8,000자로 클리핑해 과도한 토큰 비용/악용 방지 |
| 에러 메시지 | 사용자에게는 일반화된 메시지만 노출, 상세 스택은 서버 로그에만 기록 |

## 7. 알려진 제한 사항 (실습/개인 프로젝트 기준)

- Gemini/Calendar/Gmail 무료 쿼터를 초과하면 일시적으로 요청이 실패할 수 있습니다.
- 다중 사용자 서비스로 확장 시에는 Refresh Token 저장(암호화 DB) 및 서버 측 Rate Limiting이 추가로
  필요합니다(현재는 개인 실습용 단일 사용자 기준 설계).
- Gmail 답장 초안은 원본 스레드(threadId) 기준으로 생성되며, 실제 발송 이메일의 `In-Reply-To`/
  `References` 헤더까지는 자동 설정하지 않습니다(Gmail 웹에서 초안을 열어 발송하면 정상 처리됩니다).

## 8. 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `Error 401: invalid_client` | `.env`의 `VITE_GOOGLE_CLIENT_ID`가 비어있거나 예시값 그대로임 | 실제 발급받은 Client ID로 교체 후 서버 재시작 |
| `Error 403: org_internal` | OAuth 동의 화면의 User Type이 "Internal"임 (Workspace 조직 프로젝트) | 개인 Gmail 계정으로 새 프로젝트를 만들고 User Type을 "External"로 설정 |
| `Gmail API 오류(403) ... has not been used ... or is disabled` | Google Cloud Console에서 Gmail API를 활성화하지 않음 | API 및 서비스 → 라이브러리에서 Gmail API 활성화 (Calendar API도 별도로 활성화 필요) |
| `models/gemini-1.5-flash is not found ... 404` | Google이 모델 라인업을 개편해 예전 모델명이 서비스 종료됨 | `api/_lib/gemini.js`의 `MODEL_CANDIDATES` 목록이 자동으로 다음 후보를 시도합니다. 그래도 안 되면 https://ai.google.dev/gemini-api/docs/models 에서 현재 사용 가능한 모델명을 확인해 목록 맨 앞에 추가하세요 |
| `429 Too Many Requests`, `Quota exceeded ... free_tier_requests` | Gemini 무료 티어의 **모델별 일일 요청 한도**(예: 20회)를 소진함 | `askGemini`가 자동으로 다음 후보 모델로 전환을 시도합니다(모델마다 한도가 별도). 모든 후보가 소진됐다면: (1) 자정(UTC) 리셋까지 대기하거나 (2) https://aistudio.google.com/apikey 에서 다른 프로젝트로 새 API Key를 발급받아 `.env`의 `GEMINI_API_KEY` 교체 |
| `/api/agent` 500 에러, 브라우저 콘솔엔 원인이 안 보임 | 서버 쪽 에러는 보안상 클라이언트에 상세히 노출하지 않음 | `npm run dev`를 실행 중인 **터미널 창**에서 `[api/agent] error:` 또는 `[gemini]` 로 시작하는 로그를 확인 |
| `package.json`을 바꿨는데 계속 에러 | `npm install`을 다시 안 함 | `npm install` 재실행 후 서버 재시작 |

## 라이선스

MIT
