import { Application, crypto, encodeHex, Router, Status } from "./deps.ts";

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

const sessions = new Map<string, Session>();
const sockets = new Map<string, Map<string, WebSocket>>();
const router = new Router();

async function newId(addr: string): Promise<string> {
  const hash = new Uint8Array(
    await crypto.subtle.digest(
      "BLAKE3",
      new TextEncoder().encode(addr),
    ),
  );
  return encodeHex(hash);
}

router
  .get("/ws/:id/:from", (ctx) => {
    const id = ctx?.params?.id;
    const fromAddr = ctx?.params?.from;

    if (!sessions.has(id)) {
      ctx.throw(Status.NotFound, "Session not found");
    }

    const targetAddr = sessions.get(id)?.userAddress;

    // 웹소켓으로의 업그레이드 가능 여부 체크
    if (!ctx.isUpgradable) {
      ctx.throw(Status.BadRequest, "Upgrade to WebSockets required.");
    }

    let ws = ctx.upgrade(); // 웹소켓 객체를 얻는다

    // 세션은 있는데, 소켓은 있나?
    // 없다면,
    if (!sockets.has(id)) {
      // 세션 할당
      sockets.set(id, new Map<string, WebSocket>());
      // 할당된 영역에 현재 연결된 웹소켓 할당
      const sessions = sockets.get(id);
      sessions?.set(fromAddr, ws);
    }

    // 세션 가져오기
    const socket = sockets.get(id);
    socket?.set(fromAddr, ws);

    // 소켓 열렸을 때.
    ws.onopen = () => console.log("Connected to WebSocket");

    // 소켓에 메시지가 전달 됐을 때.
    ws.onmessage = (event) => {
      const s = socket?.get(targetAddr as string);

      if (event.data.length === 1 && event.data == 0x9) {
        socket?.get(fromAddr)?.send((0xa).toString(16));
        return;
      }

      console.log("Received message from the client", event.data);
      // 해당 메시지를 연결된 다른 클라이언트에게 브로드캐스트
      s?.send(event.data);
    };

    ws.onclose = () => {
      console.log("WebSocket closed", fromAddr);
      // 연결 해제 시 소켓 목록에서 제거
      socket?.delete(fromAddr);
    };

    ws.onerror = (event) => console.error("WebSocket error", event);
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

app.use(router.routes());
app.use(router.allowedMethods());

app.addEventListener("listen", ({ port }) => {
  console.log(`Listening at http://localhost:${port}`);
});

if (import.meta.main) {
  await app.listen({ port: 1993 });
}

export { app, newId };
