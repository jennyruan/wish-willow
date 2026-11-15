import { WhopClient, WhopEnvironment } from "@whop/sdk";
import { unwrapWebhook } from "@whop/sdk/helpers";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  httpAction,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { paymentKind } from "./schema";

/**
 * Whop is the merchant-of-record rail for Engine B; Convex holds reward state.
 *
 * Escrow is charge-on-select: when the wisher picks a helper they pay the reward
 * through a Whop checkout. When Whop's payment.succeeded webhook reaches /whop
 * the helper is locked in and the money is paid out to them as a Whop claim link
 * (a transfer anyone holding the URL can redeem into their Whop balance), so the
 * helper needs no Whop account linked up front. Crowdfunding contributions take
 * the same path with the wisher as the recipient.
 *
 * Requires WHOP_API_KEY, WHOP_WEBHOOK_SECRET and WHOP_ENVIRONMENT in the Convex
 * env. Anything other than WHOP_ENVIRONMENT=production talks to the sandbox.
 */
function whopClient() {
  const token = process.env.WHOP_API_KEY;
  if (!token) throw new Error("WHOP_API_KEY is not set on this deployment");
  return new WhopClient({
    token,
    environment:
      process.env.WHOP_ENVIRONMENT === "production"
        ? WhopEnvironment.Production
        : WhopEnvironment.Sandbox,
  });
}

const money = (amount: number) => `$${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;

async function handleOf(ctx: MutationCtx, userId: Id<"users">) {
  return (await ctx.db.get(userId))?.handle ?? "someone";
}

async function notify(
  ctx: MutationCtx,
  userId: Id<"users">,
  kind: "reward" | "fund",
  text: string,
  wishId: Id<"wishes">,
) {
  await ctx.db.insert("notifications", {
    userId,
    kind,
    text,
    wishId,
    read: false,
    createdAt: Date.now(),
  });
}

/**
 * Validate a reward selection or a crowdfunding contribution and record it as a
 * pending payment. A $0 (free, thanks-only) reward releases immediately.
 *
 * Only one reward checkout is live per wish: picking the same helper again
 * reuses the open checkout, and picking someone else cancels the old one (its
 * Whop checkout is deleted by the caller; a payment that still slips through on
 * it is refunded by settlePayment).
 */
export const openPayment = internalMutation({
  args: {
    wishId: v.id("wishes"),
    userId: v.id("users"),
    kind: paymentKind,
    helperId: v.optional(v.id("users")),
    amount: v.optional(v.number()),
  },
  returns: v.union(
    v.object({ type: v.literal("released") }),
    v.object({ type: v.literal("reuse"), purchaseUrl: v.string() }),
    v.object({
      type: v.literal("new"),
      paymentId: v.id("payments"),
      amount: v.number(),
      title: v.string(),
      cancelCheckoutIds: v.array(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const wish = await ctx.db.get(args.wishId);
    if (!wish) throw new Error("wish not found");
    if (wish.visibility !== "public") {
      throw new Error("only public wishes take rewards or contributions");
    }
    if (!(await ctx.db.get(args.userId))) throw new Error("user not found");

    if (args.kind === "fund") {
      const amount = Math.round((args.amount ?? 0) * 100) / 100;
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("contribution must be a positive amount");
      }
      const paymentId = await ctx.db.insert("payments", {
        wishId: wish._id,
        payerId: args.userId,
        kind: "fund",
        recipientId: wish.ownerId,
        amount,
        status: "pending",
        createdAt: Date.now(),
      });
      return {
        type: "new" as const,
        paymentId,
        amount,
        title: `Chip in: ${wish.text}`.slice(0, 80),
        cancelCheckoutIds: [],
      };
    }

    if (wish.ownerId !== args.userId) {
      throw new Error("only the wisher can select a helper");
    }
    if (wish.helperId !== undefined) {
      throw new Error("a helper was already selected for this wish");
    }
    const helperId = args.helperId;
    if (!helperId) throw new Error("select a helper to reward");
    if (helperId === wish.ownerId) throw new Error("you can't reward yourself");
    const replied = await ctx.db
      .query("comments")
      .withIndex("by_wish", (q) => q.eq("wishId", wish._id))
      .filter((q) => q.eq(q.field("authorId"), helperId))
      .first();
    if (!replied) throw new Error("the helper must have replied to this wish");

    const amount = wish.reward ?? 0;
    if (amount === 0) {
      const now = Date.now();
      await ctx.db.patch(wish._id, { helperId, rewardReleasedAt: now });
      const [owner, helper] = await Promise.all([
        handleOf(ctx, wish.ownerId),
        handleOf(ctx, helperId),
      ]);
      await notify(ctx, helperId, "reward", `@${owner} picked you as the helper for “${wish.text}” — thank you!`, wish._id);
      await notify(ctx, wish.ownerId, "reward", `You thanked @${helper} for helping with your wish`, wish._id);
      return { type: "released" as const };
    }

    const open = await ctx.db
      .query("payments")
      .withIndex("by_wish", (q) => q.eq("wishId", wish._id))
      .filter((q) =>
        q.and(q.eq(q.field("kind"), "reward"), q.eq(q.field("status"), "pending")),
      )
      .collect();
    const same = open.find(
      (p) => p.recipientId === helperId && p.amount === amount && p.checkoutUrl,
    );
    if (same?.checkoutUrl) return { type: "reuse" as const, purchaseUrl: same.checkoutUrl };

    const cancelCheckoutIds: string[] = [];
    for (const p of open) {
      await ctx.db.patch(p._id, { status: "canceled" });
      if (p.checkoutId) cancelCheckoutIds.push(p.checkoutId);
    }
    const paymentId = await ctx.db.insert("payments", {
      wishId: wish._id,
      payerId: args.userId,
      kind: "reward",
      recipientId: helperId,
      amount,
      status: "pending",
      createdAt: Date.now(),
    });
    return {
      type: "new" as const,
      paymentId,
      amount,
      title: `Reward: ${wish.text}`.slice(0, 80),
      cancelCheckoutIds,
    };
  },
});

/** Store the Whop checkout on its payment; false when the payment was superseded meanwhile. */
export const attachCheckout = internalMutation({
  args: {
    paymentId: v.id("payments"),
    checkoutId: v.string(),
    checkoutUrl: v.string(),
    accountId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, { paymentId, ...checkout }) => {
    const payment = await ctx.db.get(paymentId);
    if (!payment || payment.status !== "pending") return false;
    await ctx.db.patch(paymentId, checkout);
    return true;
  },
});

/**
 * Create a Whop checkout for a wish. kind "reward": the wisher (userId) selects
 * helperId and is charged the wish's reward (charge-on-select). kind "fund": any
 * user chips in `amount` toward the wish. Returns the Whop purchase_url for the
 * app to open, or null when a free reward released with nothing to charge.
 */
export const createCheckout = action({
  args: {
    wishId: v.id("wishes"),
    userId: v.id("users"),
    kind: paymentKind,
    helperId: v.optional(v.id("users")),
    amount: v.optional(v.number()),
  },
  returns: v.object({ purchaseUrl: v.union(v.string(), v.null()) }),
  handler: async (ctx, args): Promise<{ purchaseUrl: string | null }> => {
    const opened = await ctx.runMutation(internal.whop.openPayment, args);
    if (opened.type === "released") return { purchaseUrl: null };
    if (opened.type === "reuse") return { purchaseUrl: opened.purchaseUrl };

    const whop = whopClient();
    await Promise.all(
      opened.cancelCheckoutIds.map((id) =>
        whop.checkoutConfigurations.delete({ id }).catch((e) => {
          console.warn(`could not delete superseded checkout ${id}`, e);
        }),
      ),
    );

    const checkout = await whop.checkoutConfigurations.create({
      metadata: {
        userId: args.userId,
        wishId: args.wishId,
        paymentId: opened.paymentId,
        kind: args.kind,
        ...(args.helperId ? { helperId: args.helperId } : {}),
      },
      variant: {
        title: opened.title,
        initial_price: opened.amount,
        billing_type: "one_time",
        currency: "usd",
      },
    });
    if (!checkout.purchase_url) throw new Error("Whop returned no purchase_url");
    const active = await ctx.runMutation(internal.whop.attachCheckout, {
      paymentId: opened.paymentId,
      checkoutId: checkout.id,
      checkoutUrl: checkout.purchase_url,
      accountId: checkout.account_id,
    });
    if (!active) {
      await whop.checkoutConfigurations.delete({ id: checkout.id }).catch(() => {});
      throw new Error("this checkout was replaced by a newer one — try again");
    }
    return { purchaseUrl: checkout.purchase_url };
  },
});

/**
 * Apply a successful Whop payment. Idempotent: Whop delivers each event at least
 * once, so a payment already settled is left alone. A reward payment that lands
 * on a canceled checkout, or after the wish already has a paid helper, is
 * refunded instead of being kept.
 */
export const settlePayment = internalMutation({
  args: { paymentId: v.string(), whopPaymentId: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const id = ctx.db.normalizeId("payments", args.paymentId);
    const payment = id && (await ctx.db.get(id));
    if (!payment) return "unknown payment";
    if (payment.status !== "pending" && payment.status !== "canceled") return "duplicate";

    const wish = await ctx.db.get(payment.wishId);
    const excess =
      !wish ||
      (payment.kind === "reward" &&
        (payment.status === "canceled" || wish.helperId !== undefined));
    if (excess) {
      await ctx.db.patch(payment._id, {
        status: "refunding",
        whopPaymentId: args.whopPaymentId,
        paidAt: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.whop.refundPayment, {
        paymentId: payment._id,
      });
      if (wish) {
        await notify(ctx, payment.payerId, payment.kind, `A duplicate ${money(payment.amount)} charge for “${wish.text}” is being refunded`, wish._id);
      }
      return "refunding excess payment";
    }

    await ctx.db.patch(payment._id, {
      status: "paid",
      whopPaymentId: args.whopPaymentId,
      paidAt: Date.now(),
      payout: "sending",
    });
    const recipient = await handleOf(ctx, payment.recipientId);
    if (payment.kind === "reward") {
      await ctx.db.patch(wish._id, { helperId: payment.recipientId });
      await notify(ctx, wish.ownerId, "reward", `Payment received — sending your ${money(payment.amount)} reward to @${recipient}`, wish._id);
    } else {
      await ctx.db.patch(wish._id, { funded: (wish.funded ?? 0) + payment.amount });
    }
    await ctx.scheduler.runAfter(0, internal.whop.payout, { paymentId: payment._id });
    return "paid";
  },
});

export const getPayment = internalQuery({
  args: { paymentId: v.id("payments") },
  handler: async (ctx, args) => await ctx.db.get(args.paymentId),
});

/** Send a paid payment's amount to its recipient as a Whop claim link. */
export const payout = internalAction({
  args: { paymentId: v.id("payments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.runQuery(internal.whop.getPayment, args);
    if (!payment || payment.payout !== "sending") return null;
    try {
      if (!payment.accountId) throw new Error("payment has no Whop account to pay out from");
      const link = await whopClient().transfers.create({
        type: "claim_link",
        origin_id: payment.accountId,
        amount: payment.amount,
        currency: "usd",
      });
      if (!("claim_url" in link)) throw new Error("Whop did not return a claim link");
      await ctx.runMutation(internal.whop.recordPayout, {
        paymentId: payment._id,
        claimUrl: link.claim_url,
      });
    } catch (e) {
      console.error(`payout for ${payment._id} failed`, e);
      await ctx.runMutation(internal.whop.recordPayout, { paymentId: payment._id });
    }
    return null;
  },
});

/** Record a payout outcome: with claimUrl it succeeded, without it failed. */
export const recordPayout = internalMutation({
  args: { paymentId: v.id("payments"), claimUrl: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { paymentId, claimUrl }) => {
    const payment = await ctx.db.get(paymentId);
    if (!payment || payment.payout !== "sending") return null;
    const wish = await ctx.db.get(payment.wishId);
    if (!wish) return null;

    if (!claimUrl) {
      await ctx.db.patch(paymentId, { payout: "failed" });
      await notify(ctx, wish.ownerId, payment.kind, `Sending ${money(payment.amount)} to @${await handleOf(ctx, payment.recipientId)} failed — open the wish to retry`, wish._id);
      return null;
    }

    await ctx.db.patch(paymentId, { payout: "sent", claimUrl });
    const payer = await handleOf(ctx, payment.payerId);
    if (payment.kind === "reward") {
      await ctx.db.patch(wish._id, { rewardReleasedAt: Date.now() });
      await notify(ctx, payment.recipientId, "reward", `@${payer} picked you — your ${money(payment.amount)} reward for “${wish.text}” is ready to claim`, wish._id);
      await notify(ctx, wish.ownerId, "reward", `Your ${money(payment.amount)} reward was released to @${await handleOf(ctx, payment.recipientId)}`, wish._id);
    } else {
      await notify(ctx, wish.ownerId, "fund", `@${payer} chipped in ${money(payment.amount)} toward “${wish.text}” — ready to claim`, wish._id);
    }
    return null;
  },
});

/** Retry a failed payout. Only the wisher who owns the wish may retry. */
export const retryPayout = mutation({
  args: { paymentId: v.id("payments"), userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.db.get(args.paymentId);
    if (!payment || payment.payout !== "failed") throw new Error("nothing to retry");
    const wish = await ctx.db.get(payment.wishId);
    if (!wish || wish.ownerId !== args.userId) throw new Error("only the wisher can retry a payout");
    await ctx.db.patch(payment._id, { payout: "sending" });
    await ctx.scheduler.runAfter(0, internal.whop.payout, { paymentId: payment._id });
    return null;
  },
});

/** Refund an excess reward payment in full. */
export const refundPayment = internalAction({
  args: { paymentId: v.id("payments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.runQuery(internal.whop.getPayment, args);
    if (!payment || payment.status !== "refunding" || !payment.whopPaymentId) return null;
    await whopClient().payments.refund({ id: payment.whopPaymentId });
    await ctx.runMutation(internal.whop.markRefunded, args);
    return null;
  },
});

export const markRefunded = internalMutation({
  args: { paymentId: v.id("payments") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.paymentId, { status: "refunded" });
    return null;
  },
});

/**
 * Payouts on a wish that concern `userId`: claim links addressed to them, and,
 * for the wisher, the state of every paid payout so a failed one can be retried.
 * Claim URLs are only returned to their recipient.
 */
export const payoutsForWish = query({
  args: { wishId: v.id("wishes"), userId: v.id("users") },
  returns: v.array(
    v.object({
      paymentId: v.id("payments"),
      kind: paymentKind,
      amount: v.number(),
      recipientId: v.id("users"),
      payout: v.union(v.literal("sending"), v.literal("sent"), v.literal("failed")),
      claimUrl: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const wish = await ctx.db.get(args.wishId);
    if (!wish) return [];
    const rows = await ctx.db
      .query("payments")
      .withIndex("by_wish", (q) => q.eq("wishId", args.wishId))
      .filter((q) => q.eq(q.field("status"), "paid"))
      .take(200);
    return rows.flatMap((p) => {
      const mine = p.recipientId === args.userId;
      if (!p.payout || (!mine && wish.ownerId !== args.userId)) return [];
      return [{
        paymentId: p._id,
        kind: p.kind,
        amount: p.amount,
        recipientId: p.recipientId,
        payout: p.payout,
        claimUrl: mine ? p.claimUrl : undefined,
      }];
    });
  },
});

type WhopEvent = {
  type: string;
  data: { id: string; metadata?: Record<string, unknown> | null };
};

/** POST /whop: Whop webhook receiver, verified with the Standard Webhooks signature. */
export const webhook = httpAction(async (ctx, request) => {
  const key = process.env.WHOP_WEBHOOK_SECRET;
  if (!key) return new Response("webhook secret is not configured", { status: 500 });

  const raw = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, name) => {
    headers[name] = value;
  });

  let event: WhopEvent;
  try {
    event = unwrapWebhook<WhopEvent>(raw, { headers, key });
  } catch {
    return new Response("bad signature", { status: 401 });
  }

  if (event.type === "payment.succeeded" || event.type === "payment_succeeded") {
    const paymentId = event.data.metadata?.paymentId;
    if (typeof paymentId === "string") {
      await ctx.runMutation(internal.whop.settlePayment, {
        paymentId,
        whopPaymentId: event.data.id,
      });
    }
  }
  return new Response(null, { status: 200 });
});
