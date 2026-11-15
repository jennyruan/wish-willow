import OpenAI from "openai";
import type { Response } from "openai/resources/responses/responses";
import { v } from "convex/values";
import { api } from "./_generated/api";
import { action } from "./_generated/server";
import { wishKind } from "./schema";

const MODEL = "gpt-6-luna";
const NOT_CONFIGURED = "Willow’s AI isn’t configured yet — OPENAI_API_KEY is not set on this deployment.";

const notConfigured = v.object({ status: v.literal("not_configured"), message: v.string() });
const failed = v.object({ status: v.literal("error"), message: v.string() });

const clarifyResult = v.union(
  v.object({
    status: v.literal("ok"),
    intake: v.object({
      summary: v.string(),
      goal: v.string(),
      budget: v.union(v.number(), v.null()),
      timeline: v.union(v.string(), v.null()),
      location: v.union(v.string(), v.null()),
      details: v.array(v.string()),
    }),
    questions: v.array(v.string()),
  }),
  notConfigured,
  failed,
);

const researchOption = v.object({
  title: v.string(),
  detail: v.string(),
  price: v.union(v.string(), v.null()),
  action: v.string(),
  url: v.string(),
  sources: v.array(v.string()),
});

const researchResult = v.union(
  v.object({
    status: v.literal("ok"),
    summary: v.string(),
    options: v.array(researchOption),
    fetchedAt: v.number(),
  }),
  notConfigured,
  failed,
);

function client() {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? new OpenAI({ apiKey }) : null;
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Willow’s AI request failed";
}

const nullable = (type: string) => ({ type: [type, "null"] });

/**
 * Turn a spoken or typed wish into structured intake plus the next 1-3
 * clarifying questions. Returns status "not_configured" when OPENAI_API_KEY is
 * absent so the app keeps working before the key is set.
 */
export const clarifyWish = action({
  args: { wishText: v.string(), kind: wishKind },
  returns: clarifyResult,
  handler: async (_ctx, args) => {
    const openai = client();
    if (!openai) return { status: "not_configured" as const, message: NOT_CONFIGURED };

    const wishText = args.wishText.trim();
    if (!wishText) return { status: "error" as const, message: "wish text must not be empty" };

    try {
      const res = await openai.responses.create({
        model: MODEL,
        instructions: [
          "You are Willow, a devoted wish companion. A user has spoken or typed a wish.",
          "Extract structured intake from ONLY what the user said. Never invent facts: use null for budget, timeline, or location the user did not state.",
          "budget is a number in US dollars. details lists concrete preferences or constraints the user stated.",
          "Then write the 1 to 3 most useful clarifying questions that would let you research real, actionable options. Ask about what is missing, not what was already said. Keep each question short and warm.",
        ].join("\n"),
        input: `Wish category: ${args.kind}\nWish: ${wishText}`,
        text: {
          format: {
            type: "json_schema",
            name: "wish_intake",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["summary", "goal", "budget", "timeline", "location", "details", "questions"],
              properties: {
                summary: { type: "string" },
                goal: { type: "string" },
                budget: nullable("number"),
                timeline: nullable("string"),
                location: nullable("string"),
                details: { type: "array", items: { type: "string" } },
                questions: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
              },
            },
          },
        },
      });
      const { questions, ...intake } = JSON.parse(res.output_text) as {
        summary: string;
        goal: string;
        budget: number | null;
        timeline: string | null;
        location: string | null;
        details: string[];
        questions: string[];
      };
      return { status: "ok" as const, intake, questions: questions.slice(0, 3) };
    } catch (err) {
      return { status: "error" as const, message: errorMessage(err) };
    }
  },
});

function normalizeUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "trk") url.searchParams.delete(key);
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** Every URL the web_search tool actually visited or cited during this response. */
function visitedUrls(res: Response) {
  const urls = new Set<string>();
  const add = (raw: string | undefined) => {
    const url = raw && normalizeUrl(raw);
    if (url) urls.add(url);
  };
  for (const item of res.output) {
    if (item.type === "web_search_call") {
      const a = item.action as { sources?: Array<{ url?: string }>; url?: string | null };
      a.sources?.forEach((s) => add(s.url));
      add(a.url ?? undefined);
    }
    if (item.type === "message") {
      for (const part of item.content) {
        if (part.type !== "output_text") continue;
        for (const ann of part.annotations) if (ann.type === "url_citation") add(ann.url);
      }
    }
  }
  return urls;
}

/**
 * Research real options toward a wish within its budget and timeline using
 * OpenAI web search. Every option's link and sources must be URLs the search
 * actually returned; anything else is dropped (RULES.md real-info rule).
 */
export const research = action({
  args: { wishId: v.id("wishes") },
  returns: researchResult,
  handler: async (ctx, args) => {
    const openai = client();
    if (!openai) return { status: "not_configured" as const, message: NOT_CONFIGURED };

    const wish = await ctx.runQuery(api.wishes.get, { wishId: args.wishId });
    if (!wish) return { status: "error" as const, message: "wish not found" };

    const brief = [
      `Wish: ${wish.text}`,
      `Category: ${wish.kind}`,
      wish.budget !== undefined ? `Budget: $${wish.budget}` : "Budget: not stated",
      wish.timeNum !== undefined && wish.timeUnit ? `Timeline: within ${wish.timeNum} ${wish.timeUnit}` : "Timeline: not stated",
      wish.locality ? `Local or remote: ${wish.locality}` : null,
      wish.location ? `Location: ${wish.location}` : null,
      wish.intake ? `Intake: ${JSON.stringify(wish.intake)}` : null,
    ].filter(Boolean).join("\n");

    try {
      const fetchedAt = Date.now();
      const res = await openai.responses.create({
        model: MODEL,
        tools: [{ type: "web_search" }],
        include: ["web_search_call.action.sources"],
        instructions: [
          `You are Willow, doing real legwork to make a user's wish come true. Today is ${new Date(fetchedAt).toISOString().slice(0, 10)}.`,
          "Search the live web and assemble up to 5 real, actionable options toward the wish that fit its budget and timeline (or honest paths to close a gap, such as financing or crowdfunding when the budget is short).",
          "REAL INFO ONLY: every price, product, event, place, and date must come from a page you found in this search. Never guess or invent. If a price isn't on the page, use null.",
          "url is the real page where the user can take the action. sources lists the exact page URLs that back the option's facts. Only use URLs returned by your web search.",
          "action is a short verb phrase for the button, e.g. \"Buy on apple.com\", \"RSVP\", \"Apply\". summary is one or two sentences on the plan.",
        ].join("\n"),
        input: brief,
        text: {
          format: {
            type: "json_schema",
            name: "wish_research",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["summary", "options"],
              properties: {
                summary: { type: "string" },
                options: {
                  type: "array",
                  maxItems: 5,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["title", "detail", "price", "action", "url", "sources"],
                    properties: {
                      title: { type: "string" },
                      detail: { type: "string" },
                      price: nullable("string"),
                      action: { type: "string" },
                      url: { type: "string" },
                      sources: { type: "array", items: { type: "string" } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const visited = visitedUrls(res);
      const verified = (raw: string) => {
        const url = normalizeUrl(raw);
        return url !== null && visited.has(url);
      };
      const plan = JSON.parse(res.output_text) as {
        summary: string;
        options: Array<{ title: string; detail: string; price: string | null; action: string; url: string; sources: string[] }>;
      };
      const options = plan.options
        .filter((o) => verified(o.url))
        .map((o) => {
          const sources = o.sources.filter(verified);
          return { ...o, sources: sources.length ? sources : [o.url] };
        });
      return { status: "ok" as const, summary: plan.summary, options, fetchedAt };
    } catch (err) {
      return { status: "error" as const, message: errorMessage(err) };
    }
  },
});
