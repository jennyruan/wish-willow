import { v } from "convex/values";
import { action } from "./_generated/server";

/**
 * Transcribe an uploaded voice clip with Deepgram. The clip is deleted from
 * storage once transcribed. Requires DEEPGRAM_API_KEY in the Convex env.
 */
export const transcribe = action({
  args: { storageId: v.id("_storage") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) throw new Error("DEEPGRAM_API_KEY is not set on this deployment");

    const audio = await ctx.storage.get(args.storageId);
    if (!audio) throw new Error("voice clip not found");

    try {
      const res = await fetch(
        "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true",
        {
          method: "POST",
          headers: {
            Authorization: `Token ${key}`,
            "Content-Type": audio.type || "application/octet-stream",
          },
          body: audio,
        },
      );
      if (!res.ok) throw new Error(`Deepgram transcription failed (${res.status})`);
      const data = (await res.json()) as {
        results?: {
          channels?: Array<{ alternatives?: Array<{ transcript?: string }> }>;
        };
      };
      return data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";
    } finally {
      await ctx.storage.delete(args.storageId);
    }
  },
});
