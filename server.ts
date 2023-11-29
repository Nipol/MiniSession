import { Application, crypto, Context, encodeHex, Router, Status } from "./deps.ts";

interface Session {
  id: string;
  hostAddress: string;
  userAddress: string;
  signature: string;
  createdAt: Date;
}

interface Socket {
  ws: any;
}

// 세션 만료 시간 (밀리초 단위)
const SESSION_EXPIRY_TIME = 3 * 60 * 1000; // 10분

// sessionId to Session Info
const sessions = new Map<string, Session>();

// sessionId -> toAddr -> Socket
const sockets = new Map<string, Map<string, WebSocket>>();
const router = new Router();

async function newId(addr: string): Promise<string> {
  const hash = new Uint8Array(
    await crypto.subtle.digest(
      "KECCAK-256",
      new TextEncoder().encode(addr),
    ),
  );
  return encodeHex(hash);
}

function handleCORS(ctx: Context, next: () => Promise<void>) {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  ctx.response.headers.set("Access-Control-Allow-Credentials", "true");
  
  // Preflight 요청에 대한 응답 처리
  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = Status.NoContent;
    return;
  }

  return next();
}

const wsMiddleware = async (ctx: any, next: () => Promise<void>) => {
  if (ctx.isUpgradable) {
    const httpRequest = ctx.request.serverRequest;
    const origin = httpRequest.headers.get("origin");

    // 허용되지 않은 오리진 검사
    if (origin !== "https://demos.bean.pink") {
      ctx.throw(Status.Forbidden, "Origin not allowed");
      return;
    }

    // 다음 미들웨어로 이동
    await next();
  } else {
    await next();
  }
};

// 신규 로그 함수 추가
function logInfo(message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] INFO: ${message}`);
}

function logError(message: string, error?: Error) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR: ${message}`, error);
}

router
  // sessionId + current Addr
  .get("/ws/:sessionId/:currentAddr", async (ctx) => {
    const sessionId = ctx?.params?.sessionId;
    const currentAddr = ctx?.params?.currentAddr;

    // 세션 있는지 검사, 없다면 연결 종료
    if (!sessions.has(sessionId)) {
      ctx.throw(Status.NotFound, "Session not found")
    }

    const attendeeAddr = sessions.get(sessionId)?.userAddress

    // 웹소켓으로의 업그레이드 가능 여부 체크
    if (!ctx.isUpgradable) {
      ctx.throw(Status.BadRequest, "Upgrade to WebSockets required.");
    }

    let ws = ctx.upgrade(); // 웹소켓 객체를 얻는다

    // 소켓 풀에서, 세션에 해당하는 소켓이 있는지 확인
    if (!sockets.has(sessionId)) {
      // 세션 할당후, 영역에 현재 연결된 웹소켓 할당
      sockets.set(sessionId, new Map<string, WebSocket>()).get(sessionId)?.set(currentAddr, ws);
    }

    // 세션에 연결된 소켓 가져오고
    const socket = sockets.get(sessionId);
    socket?.set(currentAddr, ws);

    // 소켓 열렸을 때.
    ws.onopen = () => logInfo(`WebSocket opened from ${currentAddr} to session ${sessionId}.`);

    // 소켓에 메시지가 전달 됐을 때.
    ws.onmessage = (event) => {
      const s = socket?.get(attendeeAddr as string);

      console.log("Received message from the client", event.data);
      // 해당 메시지를 연결된 다른 클라이언트에게 브로드캐스트
      s?.send(event.data);

      logInfo(`Broadcast message from ${currentAddr} to ${attendeeAddr}: ${event.data}`);
    };

    ws.onclose = () => {
      logInfo(`WebSocket closed from ${currentAddr}.`);
      // 연결 해제 시 소켓 목록에서 제거
      socket?.delete(currentAddr);
    };

    ws.onerror = (event) => logError("WebSocket encountered an error.", event.error);
  })
  .get("/sessions/:id", async (ctx) => {
    if (sessions.has(ctx?.params?.id)) {
      ctx.response.body = sessions.get(ctx.params.id);
    }
  })
  .post("/sessions/:host/:user", async (ctx) => {
    const sessionId: string = await newId(
      `${ctx.params.host}-${ctx.params.user}`,
    );

    sessions.set(sessionId, {
      id: sessionId,
      hostAddress: ctx.params.host,
      userAddress: ctx.params.user,
      createdAt: new Date(),
    } as Session);

    ctx.response.body = {
      sessionId,
    };

    // 10분 후 세션 만료 로직
    setTimeout(() => {
      // 만료된 세션을 세션 맵에서 삭제
      sessions.delete(sessionId);
      // 관련 웹소켓 연결 모두 종료 및 삭제
      const sessionSockets = sockets.get(sessionId);
      if (sessionSockets) {
        for (const [_, ws] of sessionSockets) {
          ws.close(); // 웹소켓 연결 종료
        }
      }
      // 웹소켓 맵에서 세션 삭제
      sockets.delete(sessionId);
    }, SESSION_EXPIRY_TIME);
  });

const app = new Application();

// 웹 서버의 모든 라우트에 대한 CORS 정책 적용
app.use(handleCORS);

// 웹소켓 라우트 미들웨어 추가
router.use("/ws/:id/:from", wsMiddleware);

app.use(router.routes());
app.use(router.allowedMethods());

app.addEventListener("listen", ({ port }) => {
  console.log(`Listening at http://localhost:${port}`);
});

if (import.meta.main) {
  await app.listen({ port: 1993 });
}

export { app, newId };
