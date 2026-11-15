import { v } from "convex/values";
import { action, mutation } from "./_generated/server";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const transcribe = action({
  args: { storageId: v.id("_storage") },
  returns: v.string(),
  handler: async (ctx, { storageId }): Promise<string> => {
    const audio = await ctx.storage.get(storageId);
    if (!audio) throw new Error("Recording not found");
    try {
      const apiKey = process.env.DEEPGRAM_API_KEY;
      if (!apiKey) throw new Error("DEEPGRAM_API_KEY is not set in the Convex environment");
      const response = await fetch(
        "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true",
        {
          method: "POST",
          headers: {
            Authorization: `Token ${apiKey}`,
            "Content-Type": audio.type || "audio/mp4",
          },
          body: audio,
        },
      );
      if (!response.ok) throw new Error(`Deepgram responded ${response.status}`);
      const body = await response.json();
      const transcript: string = body.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
      return transcript.trim();
    } finally {
      await ctx.storage.delete(storageId);
    }
  },
});
