import { superoak } from "https://deno.land/x/superoak@4.7.0/mod.ts";
import { assertEquals } from "https://deno.land/std@0.90.0/testing/asserts.ts";
import { app, newId } from "./server.ts";

Deno.test("it should make new sessions", async () => {
  const HostAddr = "0x1234567890HOST";
  const UserAddr = "0x1234567890USER";
  const request1 = await superoak(app);
  const r1 = await request1.post(`/sessions/${HostAddr}/${UserAddr}`).expect(
    200,
  );

  const request2 = await superoak(app);
  const r2 = await request2.get(`/sessions/${r1.body.sessionId}`).expect(200);

  assertEquals(r2.body.hostAddress, HostAddr);
  assertEquals(r2.body.userAddress, UserAddr);
});

// Deno.test("createSession", async () => {

//     const walletAddress = "0x12345...";
//     const session = await createSession(walletAddress);

//     assertEquals(session.walletAddress, walletAddress);
//     assert(session.id.length > 0);
//     assert(session.createdAt instanceof Date);

// });

// Deno.test("getExistingSession", async () => {

//     const walletAddress = "0x12345...";
//     const session1 = await createSession(walletAddress);

//     const session2 = getSession(session1.id);

//     assertEquals(session1.id, session2.id);

// });

// Deno.test("getNonExistingSession", () => {

//     const invalidSessionId = "invalid-id";
//     const session = getSession(invalidSessionId);

//     assertEquals(session, null);

// });
