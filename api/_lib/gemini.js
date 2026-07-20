import { GoogleGenerativeAI } from "@google/generative-ai";

// ⚠️ 이 파일은 Serverless Function(서버) 런타임에서만 실행됩니다.
// process.env.GEMINI_API_KEY는 브라우저 번들에 절대 포함되지 않습니다.
// (Vite는 VITE_ 접두어가 붙은 변수만 클라이언트로 노출하며, 이 변수는 접두어가 없습니다.)

// Google 무료 티어는 "모델별로 하루 요청 한도(예: 20회)"가 따로 계산됩니다.
// 한 모델의 한도를 다 쓰면 다음 후보 모델로 자동 전환해 계속 테스트할 수 있게 합니다.
// 목록 맨 앞이 항상 "현재 무료 티어 기본 모델"이 되도록 유지하면 됩니다.
const MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-3-flash",
  "gemini-flash-latest",
];

let client = null;
let workingModelName = null; // 이번 서버 프로세스에서 실제로 동작한 모델명 캐시
const exhaustedUntil = new Map(); // modelName -> 한도 초과로 잠시 건너뛸 시각(ms)

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY가 설정되지 않았습니다. 배포 플랫폼의 환경변수 설정을 확인하세요."
    );
  }
  if (!client) client = new GoogleGenerativeAI(apiKey);
  return client;
}

function isModelNotFoundError(err) {
  const msg = String(err?.message || "");
  return msg.includes("404") || msg.toLowerCase().includes("not found");
}

function isQuotaExceededError(err) {
  const msg = String(err?.message || "");
  return msg.includes("429") || msg.toLowerCase().includes("quota");
}

/**
 * 프롬프트 문자열을 Gemini에 보내고 텍스트 응답을 반환합니다.
 * - 모델명이 만료/변경되어 404가 나는 경우: 다음 후보 모델로 재시도
 * - 무료 티어 요청 한도(429)에 걸린 경우: 그 모델은 잠시 건너뛰고 다음 후보 모델로 재시도
 *   (한도는 모델별로 따로 계산되므로, 다른 모델은 아직 여유가 있을 수 있습니다)
 */
export async function askGemini(prompt) {
  const genAI = getClient();
  const now = Date.now();
  const order = workingModelName
    ? [workingModelName, ...MODEL_CANDIDATES.filter((m) => m !== workingModelName)]
    : MODEL_CANDIDATES;

  let lastError;
  let allQuotaExceeded = true;

  for (const modelName of order) {
    const skipUntil = exhaustedUntil.get(modelName);
    if (skipUntil && skipUntil > now) continue; // 최근에 한도 초과 확인된 모델은 잠시 건너뜀

    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      workingModelName = modelName; // 다음 호출부터는 이 모델을 먼저 시도
      exhaustedUntil.delete(modelName);
      return result.response.text();
    } catch (err) {
      lastError = err;

      if (isQuotaExceededError(err)) {
        // 무료 티어 일일 한도 초과로 추정 → 이 모델은 1시간 동안 건너뛰고 다음 후보 시도
        exhaustedUntil.set(modelName, now + 60 * 60 * 1000);
        console.warn(`[gemini] 모델 "${modelName}" 요청 한도 초과, 다음 후보로 재시도합니다.`);
        continue;
      }

      allQuotaExceeded = false;

      if (!isModelNotFoundError(err)) throw err; // 한도/모델없음 외 오류(네트워크 등)는 즉시 전달
      console.warn(`[gemini] 모델 "${modelName}" 사용 불가, 다음 후보로 재시도합니다.`);
    }
  }

  if (allQuotaExceeded) {
    throw new Error(
      "모든 후보 모델의 Gemini 무료 티어 일일 요청 한도를 초과했습니다. " +
        "잠시 후(보통 자정 UTC 기준 리셋) 다시 시도하거나, " +
        "https://aistudio.google.com/apikey 에서 다른 프로젝트로 새 API Key를 발급받아 " +
        ".env의 GEMINI_API_KEY를 교체해보세요."
    );
  }

  throw new Error(
    `사용 가능한 Gemini 모델을 찾지 못했습니다. 최신 모델명은 https://ai.google.dev/gemini-api/docs/models 에서 확인해 MODEL_CANDIDATES를 갱신하세요. (원본 오류: ${lastError?.message})`
  );
}

/** Gemini가 ```json 코드블록으로 감싸는 경우까지 방어적으로 처리하는 JSON 파서 */
export function extractJson(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}
