// 모든 "공개되어도 되는" 설정값은 이 파일 하나로 모읍니다.
// 절대 여기에 실제 API Key, 이메일 주소, 개인 식별정보를 하드코딩하지 마세요.
// 값은 .env(.env.example 참고) 또는 배포 플랫폼의 환경변수에서만 주입됩니다.

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

// 필요한 최소 권한만 요청 (최소 권한 원칙 / Principle of Least Privilege)
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose", // 발송이 아닌 "임시보관함 초안"까지만
  "https://www.googleapis.com/auth/userinfo.email", // 대시보드에 로그인 계정 표시용
].join(" ");

if (!GOOGLE_CLIENT_ID) {
  // 콘솔에만 경고 — 실제 값이 아니라 "누락되었다"는 사실만 노출합니다.
  console.warn(
    "[config] VITE_GOOGLE_CLIENT_ID가 설정되지 않았습니다. .env 파일을 확인하세요."
  );
}
