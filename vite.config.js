import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// ============================================================
// 로컬 개발 전용 미니 API 서버
// ------------------------------------------------------------
// Vercel 계정/CLI 없이도 "npm run dev" 하나로 /api/agent.js 를
// 실제로 실행할 수 있도록, Vite 개발 서버에 미들웨어를 추가합니다.
// - Vercel 스타일 (req, res) 핸들러를 그대로 재사용합니다.
// - 이 코드는 개발 모드(vite dev)에서만 동작하며, "vite build"로
//   만든 배포 산출물(dist)에는 포함되지 않습니다.
// - 실제 배포(Vercel) 시에는 이 미들웨어 없이 api/ 폴더가 그대로
//   Vercel Functions로 인식되어 동일한 핸들러 코드가 사용됩니다.
// ============================================================
function localApiPlugin(mode) {
  return {
    name: "local-api-dev-middleware",
    apply: "serve", // 개발 서버에서만 적용 (빌드 산출물에는 영향 없음)
    configureServer(server) {
      // .env의 서버 전용 변수(GEMINI_API_KEY 등)를 이 프로세스에 주입합니다.
      // (VITE_ 접두어가 없는 값은 브라우저로는 절대 전달되지 않고,
      //  여기 Node 프로세스 안에서만 사용됩니다.)
      const env = loadEnv(mode, process.cwd(), "");
      Object.assign(process.env, env);

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();

        try {
          const { pathname } = new URL(req.url, "http://localhost");
          const fnName = pathname.replace(/^\/api\//, "").replace(/\/$/, "");
          const mod = await server.ssrLoadModule(`/api/${fnName}.js`);
          const handler = mod.default;

          if (typeof handler !== "function") {
            res.statusCode = 404;
            return res.end(JSON.stringify({ error: `핸들러를 찾을 수 없습니다: /api/${fnName}` }));
          }

          let raw = "";
          req.on("data", (chunk) => (raw += chunk));
          req.on("end", async () => {
            try {
              req.body = raw ? JSON.parse(raw) : {};
            } catch {
              req.body = {};
            }

            // Vercel 핸들러가 기대하는 res.status()/res.json() 헬퍼 추가
            res.status = (code) => {
              res.statusCode = code;
              return res;
            };
            res.json = (obj) => {
              res.setHeader("Content-Type", "application/json; charset=utf-8");
              res.end(JSON.stringify(obj));
            };

            try {
              await handler(req, res);
            } catch (err) {
              console.error("[local-api] handler error:", err);
              if (!res.writableEnded) {
                res.status(500).json({ error: "로컬 API 처리 중 오류가 발생했습니다." });
              }
            }
          });
        } catch (err) {
          console.error("[local-api] middleware error:", err);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "로컬 API 서버 오류" }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), localApiPlugin(mode)],
  server: {
    port: 5173,
  },
}));
