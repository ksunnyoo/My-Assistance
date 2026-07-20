# Security Policy

이 저장소는 개인용 AI 비서 실습 프로젝트입니다. 아래 원칙을 따릅니다.

## 비밀 값 관리
- `GEMINI_API_KEY`는 서버(Serverless Function) 환경변수로만 존재하며 저장소에는 절대 커밋하지 않습니다.
- `VITE_GOOGLE_CLIENT_ID`는 공개되어도 안전한 값(OAuth Client ID)만 프론트엔드에 노출합니다.
- 로컬 비밀 값은 `.env`에 두고 `.gitignore`로 커밋을 차단합니다. 배포 비밀 값은 Vercel/Netlify
  대시보드의 환경변수 설정에만 등록합니다.

## 만약 키가 실수로 커밋되었다면
1. 즉시 Google AI Studio / Google Cloud Console에서 해당 키를 **재발급(rotate)** 하세요.
   삭제 커밋만으로는 Git 이력에 남은 값을 제거할 수 없습니다.
2. `git filter-repo` 또는 BFG Repo-Cleaner로 이력에서 제거합니다.
3. 저장소가 Public이었다면 이미 노출되었다고 가정하고 키 재발급을 최우선으로 처리하세요.

## 취약점 신고
개인 실습 프로젝트이므로 별도 신고 채널은 없습니다. 이슈(Issue)로 등록해주세요.
