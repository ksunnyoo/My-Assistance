import { GOOGLE_CLIENT_ID, GOOGLE_SCOPES } from "../config";

// ⚠️ 보안 설계 메모
// - Access Token은 절대 localStorage에 저장하지 않습니다 (XSS 시 영구 탈취 위험).
// - 메모리(React state)에만 보관하며, 새로고침하면 재인증이 필요합니다.
// - 이 앱은 사용자 자신의 브라우저에서 자신의 Google 계정에만 접근하므로
//   토큰이 서버로 전송되지 않고, Google API로만 직접 전달됩니다(Gmail/Calendar 호출 시).

let tokenClient = null;

/** Google Identity Services 스크립트 로드 완료를 기다립니다. */
function waitForGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (window.google?.accounts?.oauth2) {
        clearInterval(timer);
        resolve();
      } else if (tries > 100) {
        clearInterval(timer);
        reject(new Error("Google Identity Services 로드에 실패했습니다."));
      }
    }, 50);
  });
}

/**
 * 사용자에게 Google 로그인 + 동의 화면을 띄우고 Access Token을 발급받습니다.
 * @returns {Promise<{accessToken: string, expiresAt: number}>}
 */
export async function signInWithGoogle() {
  await waitForGis();

  if (!GOOGLE_CLIENT_ID) {
    throw new Error(
      "Google Client ID가 설정되지 않았습니다. .env의 VITE_GOOGLE_CLIENT_ID를 확인하세요."
    );
  }

  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        const expiresAt = Date.now() + Number(response.expires_in || 3600) * 1000;
        resolve({ accessToken: response.access_token, expiresAt });
      },
      error_callback: (err) => reject(new Error(err.message || "로그인이 취소되었습니다.")),
    });

    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

/** 로그인한 계정 표시용 최소 정보(이메일)만 가져옵니다. */
export async function getUserInfo(accessToken) {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json(); // { email, ... }
}

/** 저장된 토큰을 무효화하고 로그아웃 처리합니다. */
export function revokeGoogleToken(accessToken) {
  if (!accessToken || !window.google?.accounts?.oauth2) return;
  window.google.accounts.oauth2.revoke(accessToken, () => {});
}
