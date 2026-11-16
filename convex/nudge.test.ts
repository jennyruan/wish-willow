/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
// No live Keiki calls: fetch is replaced with this mock (RULES.md).
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("KEIKI_API_KEY", "sk_test");
  vi.stubEnv("KEIKI_AGENT_ID", "agent_willow");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function setup() {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("users", { handle: "jenny", deviceToken: "a", createdAt: 0 });
    await ctx.db.insert("wishes", {
      ownerId: id, text: "learn to surf", kind: "other", visibility: "private",
      status: "open", realized: false, createdAt: 0,
    });
    return id;
  });
  return { t, userId };
}

describe("setDailyNudge", () => {
  test("binds the opt-in to a normalized iMessage number or Telegram identity", async () => {
    const { t, userId } = await setup();
    await t.mutation(api.nudge.setDailyNudge, { userId, enabled: true, channel: "imessage", address: "(415) 555-0123" });
    expect(await t.query(api.nudge.status, { userId })).toMatchObject({ enabled: true, channel: "imessage", recipient: "+14155550123" });
    await t.mutation(api.nudge.setDailyNudge, { userId, enabled: true, channel: "telegram", address: "123456789" });
    expect((await t.query(api.nudge.status, { userId })).recipient).toBe("tg:123456789");
  });

  test("refuses to opt in without a valid recipient", async () => {
    const { t, userId } = await setup();
    await expect(t.mutation(api.nudge.setDailyNudge, { userId, enabled: true })).rejects.toThrow();
    await expect(t.mutation(api.nudge.setDailyNudge, { userId, enabled: true, channel: "imessage", address: "555" })).rejects.toThrow();
    await expect(t.mutation(api.nudge.setDailyNudge, { userId, enabled: true, channel: "telegram", address: "@jenny" })).rejects.toThrow();
  });
});

describe("sendDailyNudge", () => {
  test("posts a notice to the user's conversation and records delivery", async () => {
    const { t, userId } = await setup();
    await t.mutation(api.nudge.setDailyNudge, { userId, enabled: true, channel: "imessage", address: "+14155550123" });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, results: [{ phone: "+14155550123", outcome: "ran" }] })));
    expect(await t.action(internal.nudge.sendDailyNudge, { userId })).toBe("delivered");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://onkeiki.com/api/v1/developer/agents/agent_willow/notice");
    expect(init.headers.Authorization).toBe("Bearer sk_test");
    const body = JSON.parse(init.body);
    expect(body.phone).toBe("+14155550123");
    expect(body.text).toContain("learn to surf");
    expect((await t.query(api.nudge.status, { userId })).delivery).toBe("delivered");
  });

  test("marks the user unreachable when Keiki has no conversation with them", async () => {
    const { t, userId } = await setup();
    await t.mutation(api.nudge.setDailyNudge, { userId, enabled: true, channel: "telegram", address: "123456789" });
    fetchMock.mockResolvedValue(new Response("not found", { status: 404 }));
    expect(await t.action(internal.nudge.sendDailyNudge, { userId })).toBe("unreachable");
    expect((await t.query(api.nudge.status, { userId })).delivery).toBe("unreachable");
  });

  test("only opted-in users with a recipient are due", async () => {
    const { t, userId } = await setup();
    await t.run((ctx) => ctx.db.patch(userId, { dailyNudge: true }));
    expect(await t.query(internal.nudge.dueUsers, {})).toEqual([]);
    await t.mutation(api.nudge.setDailyNudge, { userId, enabled: true, channel: "imessage", address: "+14155550123" });
    expect(await t.query(internal.nudge.dueUsers, {})).toEqual([userId]);
  });
});
