export type WishKind = "girlfriend" | "boyfriend" | "iphone" | "hackathon" | "other";

export const WISH_EMOJI: Record<WishKind, string> = {
  girlfriend: "💛",
  boyfriend: "💙",
  iphone: "📱",
  hackathon: "📊",
  other: "🌟",
};

export const EXAMPLE_WISHES: Array<{ kind: Exclude<WishKind, "other">; text: string }> = [
  { kind: "girlfriend", text: "I have a girlfriend" },
  { kind: "boyfriend", text: "I have a boyfriend" },
  { kind: "iphone", text: "I have an iPhone 18 Pro" },
  { kind: "hackathon", text: "I can see how the YC Consumer Mobile Hackathon’s going" },
];
