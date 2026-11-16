/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

// No live Whop calls: the SDK client is replaced with these mocks (RULES.md).
const whop = vi.hoisted(() => ({
  transfersCreate: vi.fn(),
  paymentsRefund: vi.fn(),
  paymentsRetrieve: vi.fn(),
}));
vi.mock("@whop/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@whop/sdk")>();
  return {
    ...actual,
    WhopClient: class {
      transfers = { create: whop.transfersCreate };
      payments = { refund: whop.paymentsRefund, retrieve: whop.paymentsRetrieve };
    },
  };
});

const { WhopError } = await import("@whop/sdk");
const modules = import.meta.glob("./**/*.ts");

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("WHOP_API_KEY", "test-key");
  whop.transfersCreate.mockReset();
  whop.paymentsRefund.mockReset();
  whop.paymentsRetrieve.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function setup(kind: "reward" | "fund") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", { handle: "wisher", deviceToken: "a", createdAt: 0 });
    const helper = await ctx.db.insert("users", { handle: "helper", deviceToken: "b", createdAt: 0 });
    const wish = await ctx.db.insert("wishes", {
      ownerId: owner, text: "a bike", kind: "other", visibility: "public", reward: 20,
      status: "open", realized: false, createdAt: 0,
    });
    const payment = await ctx.db.insert("payments", {
      wishId: wish, payerId: kind === "reward" ? owner : helper, kind,
      recipientId: kind === "reward" ? helper : owner, amount: 20, status: "pending",
      checkoutId: "ch_1", accountId: "biz_1", createdAt: 0,
    });
    return { owner, helper, wish, payment };
  });
  return { t, ...ids };
}

const settle = (t: ReturnType<typeof convexTest>, paymentId: Id<"payments">, whopPaymentId: string) =>
  t.mutation(internal.whop.settlePayment, { paymentId, whopPaymentId });
const drain = (t: ReturnType<typeof convexTest>) => t.finishAllScheduledFunctions(vi.runAllTimers);
const payments = (t: ReturnType<typeof convexTest>) => t.run((ctx) => ctx.db.query("payments").collect());

describe("settlePayment", () => {
  test("a redelivered event for the same Whop charge settles once", async () => {
    const { t, payment } = await setup("fund");
    whop.transfersCreate.mockResolvedValue({ claim_url: "https://whop.com/claim/1" });
    expect(await settle(t, payment, "pay_1")).toBe("paid");
    expect(await settle(t, payment, "pay_1")).toBe("duplicate");
    await drain(t);
    expect(whop.transfersCreate).toHaveBeenCalledTimes(1);
  });

  test("a second distinct charge on a contribution checkout is credited on its own row", async () => {
    const { t, payment, wish } = await setup("fund");
    whop.transfersCreate.mockResolvedValue({ claim_url: "https://whop.com/claim/1" });
    expect(await settle(t, payment, "pay_1")).toBe("paid");
    expect(await settle(t, payment, "pay_2")).toBe("paid");
    await drain(t);
    const rows = await payments(t);
    expect(rows.map((p) => [p.whopPaymentId, p.status, p.payout])).toEqual([
      ["pay_1", "paid", "sent"],
      ["pay_2", "paid", "sent"],
    ]);
    expect((await t.run((ctx) => ctx.db.get(wish)))?.funded).toBe(40);
    const keys = whop.transfersCreate.mock.calls.map((c) => c[1].idempotencyKey);
    expect(new Set(keys).size).toBe(2);
  });

  test("a second distinct charge on a reward checkout is refunded", async () => {
    const { t, payment, helper, wish } = await setup("reward");
    whop.transfersCreate.mockResolvedValue({ claim_url: "https://whop.com/claim/1" });
    whop.paymentsRefund.mockResolvedValue({});
    await settle(t, payment, "pay_1");
    expect(await settle(t, payment, "pay_2")).toBe("refunding excess payment");
    await drain(t);
    const rows = await payments(t);
    expect(rows.find((p) => p.whopPaymentId === "pay_2")?.status).toBe("refunded");
    expect(whop.paymentsRefund).toHaveBeenCalledWith({ id: "pay_2" }, expect.objectContaining({ idempotencyKey: expect.any(String) }));
    expect((await t.run((ctx) => ctx.db.get(wish)))?.helperId).toBe(helper);
  });
});

describe("payout", () => {
  test("a retry after a lost response reuses the idempotency key and records one link", async () => {
    const { t, payment } = await setup("fund");
    whop.transfersCreate
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce({ claim_url: "https://whop.com/claim/1" });
    await settle(t, payment, "pay_1");
    await drain(t);
    const [first, second] = whop.transfersCreate.mock.calls;
    expect(first[1].idempotencyKey).toBe(second[1].idempotencyKey);
    const [row] = await payments(t);
    expect(row.payout).toBe("sent");
    expect(row.claimUrl).toBe("https://whop.com/claim/1");
  });

  test("ambiguous failures stop after bounded retries and the manual retry keeps the key", async () => {
    const { t, payment, owner } = await setup("fund");
    whop.transfersCreate.mockRejectedValue(new Error("timeout"));
    await settle(t, payment, "pay_1");
    await drain(t);
    expect(whop.transfersCreate).toHaveBeenCalledTimes(6);
    expect((await payments(t))[0].payout).toBe("failed");
    const key = whop.transfersCreate.mock.calls[0][1].idempotencyKey;

    whop.transfersCreate.mockReset().mockResolvedValue({ claim_url: "https://whop.com/claim/1" });
    await t.mutation(api.whop.retryPayout, { paymentId: payment, userId: owner });
    await drain(t);
    expect(whop.transfersCreate.mock.calls[0][1].idempotencyKey).toBe(key);
    expect((await payments(t))[0].payout).toBe("sent");
  });

  test("a definitive rejection fails at once and the retry uses a fresh key", async () => {
    const { t, payment, owner } = await setup("fund");
    whop.transfersCreate.mockRejectedValue(new WhopError({ message: "insufficient balance", statusCode: 400 }));
    await settle(t, payment, "pay_1");
    await drain(t);
    expect(whop.transfersCreate).toHaveBeenCalledTimes(1);
    expect((await payments(t))[0].payout).toBe("failed");
    const key = whop.transfersCreate.mock.calls[0][1].idempotencyKey;

    whop.transfersCreate.mockReset().mockResolvedValue({ claim_url: "https://whop.com/claim/1" });
    await t.mutation(api.whop.retryPayout, { paymentId: payment, userId: owner });
    await drain(t);
    expect(whop.transfersCreate.mock.calls[0][1].idempotencyKey).not.toBe(key);
  });
});

describe("refundPayment", () => {
  test("a transient failure is retried until the refund lands", async () => {
    const { t, payment } = await setup("reward");
    await t.run((ctx) => ctx.db.patch(payment, { status: "canceled" }));
    whop.paymentsRefund.mockRejectedValueOnce(new Error("503")).mockResolvedValueOnce({});
    whop.paymentsRetrieve.mockResolvedValue({ refunded_at: null });
    await settle(t, payment, "pay_1");
    await drain(t);
    expect(whop.paymentsRefund).toHaveBeenCalledTimes(2);
    expect((await payments(t))[0].status).toBe("refunded");
  });

  test("a refund that already went through is recorded when the retry is rejected", async () => {
    const { t, payment } = await setup("reward");
    await t.run((ctx) => ctx.db.patch(payment, { status: "canceled" }));
    whop.paymentsRefund.mockRejectedValue(new WhopError({ message: "already refunded", statusCode: 422 }));
    whop.paymentsRetrieve.mockResolvedValue({ refunded_at: "2026-11-15T00:00:00Z" });
    await settle(t, payment, "pay_1");
    await drain(t);
    expect((await payments(t))[0].status).toBe("refunded");
  });

  test("exhausted retries park the refund and reconcile recovers it", async () => {
    const { t, payment } = await setup("reward");
    await t.run((ctx) => ctx.db.patch(payment, { status: "canceled" }));
    whop.paymentsRefund.mockRejectedValue(new Error("timeout"));
    whop.paymentsRetrieve.mockResolvedValue({ refunded_at: null });
    await settle(t, payment, "pay_1");
    await drain(t);
    expect((await payments(t))[0].status).toBe("refund_failed");

    whop.paymentsRefund.mockReset().mockResolvedValue({});
    await t.mutation(internal.whop.reconcile, {});
    await drain(t);
    expect((await payments(t))[0].status).toBe("refunded");
  });
});

test("payoutsForWish pages newest first past any fixed cap", async () => {
  const { t, wish, owner, helper } = await setup("fund");
  await t.run(async (ctx) => {
    for (let i = 0; i < 25; i++) {
      await ctx.db.insert("payments", {
        wishId: wish, payerId: helper, kind: "fund", recipientId: owner, amount: i + 1,
        status: "paid", payout: "sent", claimUrl: `https://whop.com/claim/${i}`, createdAt: i,
      });
    }
  });
  const first = await t.query(api.whop.payoutsForWish, { wishId: wish, userId: owner, paginationOpts: { numItems: 20, cursor: null } });
  expect(first.page[0].amount).toBe(25);
  expect(first.isDone).toBe(false);
  const rest = await t.query(api.whop.payoutsForWish, { wishId: wish, userId: owner, paginationOpts: { numItems: 20, cursor: first.continueCursor } });
  expect([...first.page, ...rest.page]).toHaveLength(25);
  expect(rest.page.at(-1)?.amount).toBe(1);
});
