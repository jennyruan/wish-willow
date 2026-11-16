import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { Composer } from "../components/Composer";
import { KeyboardAvoider, TopBar } from "../components/Chrome";
import { MediaView } from "../components/Media";
import { CtaButton, GroupLabel, Kicker, Pill, Question, StatusLabel, T } from "../components/ui";
import type { Me } from "../identity";
import { timeAgo } from "../media";
import { colors, fonts, useScale } from "../theme";
import { WISH_EMOJI } from "../wishKinds";
import { Empty } from "./MenuScreen";

type Comment = FunctionReturnType<typeof api.comments.listForWish>[number];

/** One wish: status, the owner's "mark it reality", and its public reply thread. */
export function WishScreen({ me, wishId, onBack, onMessage }: { me: Me; wishId: Id<"wishes">; onBack: () => void; onMessage: (userId: Id<"users">) => void }) {
  const { s } = useScale();
  const wish = useQuery(api.wishes.get, { wishId });
  const owner = useQuery(api.users.handles, wish ? { ids: [wish.ownerId] } : "skip")?.[0];
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const addComment = useMutation(api.comments.add);

  if (wish === undefined) return <ActivityIndicator color={colors.red} style={{ marginTop: 40 * s }} />;
  if (wish === null) {
    return (
      <>
        <TopBar title="WISH" onBack={onBack} />
        <Empty text="This wish is gone." />
      </>
    );
  }

  const isOwner = wish.ownerId === me._id;
  const isPublic = wish.visibility === "public";
  return (
    <KeyboardAvoider>
      <TopBar title="WISH" onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22 * s, paddingTop: 12 * s, paddingBottom: 16 * s }} keyboardShouldPersistTaps="handled">
        <Kicker>{wish.realized ? "✓ came true" : "in progress"}</Kicker>
        <Question size={22}>
          {WISH_EMOJI[wish.kind]} {wish.text}
        </Question>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 * s, marginTop: 9 * s }}>
          <StatusLabel realized={wish.realized} />
          <T style={{ fontSize: 11.5 * s, color: colors.muted }}>
            {[owner && (isOwner ? "your wish" : `@${owner.handle}`), isPublic ? "🌍 Public" : "🔒 Private", wish.reward ? `$${wish.reward} reward` : null, timeAgo(wish.createdAt)].filter(Boolean).join(" · ")}
          </T>
        </View>

        {isOwner ? <RealityControl wish={wish} me={me} /> : owner && <CtaButton label={`✉️ Message @${owner.handle}`} onPress={() => onMessage(wish.ownerId)} />}

        {isPublic ? (
          <Thread wish={wish} me={me} isOwner={isOwner} onReply={setReplyTo} onMessage={onMessage} />
        ) : (
          <T style={{ fontSize: 12.5 * s, color: colors.muted, marginTop: 20 * s }}>Private wish — only you can see it, so there are no replies.</T>
        )}
      </ScrollView>
      {isPublic && (
        <Composer
          placeholder={replyTo ? `reply to @${replyTo.authorHandle ?? "someone"}…` : "add a reply — text, photo, or video"}
          above={
            replyTo && (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 * s }}>
                <T style={{ flex: 1, fontSize: 11.5 * s, color: colors.muted }} numberOfLines={1}>
                  Replying to @{replyTo.authorHandle ?? "someone"}
                </T>
                <Pressable onPress={() => setReplyTo(null)} hitSlop={10} accessibilityRole="button">
                  <T style={{ fontFamily: fonts.sansBold, fontSize: 12 * s, color: colors.red }}>Cancel</T>
                </Pressable>
              </View>
            )
          }
          onSend={async ({ body, mediaId, kind }) => {
            await addComment({ wishId, authorId: me._id, kind, body, mediaId, parentId: replyTo?._id });
            setReplyTo(null);
          }}
        />
      )}
    </KeyboardAvoider>
  );
}

function RealityControl({ wish, me }: { wish: Doc<"wishes">; me: Me }) {
  const { s } = useScale();
  const markRealized = useMutation(api.wishes.markRealized);
  const [busy, setBusy] = useState(false);
  const set = async (realized: boolean) => {
    setBusy(true);
    try {
      await markRealized({ wishId: wish._id, requesterId: me._id, realized });
    } finally {
      setBusy(false);
    }
  };
  if (!wish.realized) return <CtaButton label="Mark it reality 🌳" disabled={busy} onPress={() => set(true)} />;
  return (
    <View style={{ marginTop: 16 * s, borderRadius: 13 * s, backgroundColor: colors.ochre, paddingVertical: 12 * s, paddingHorizontal: 14 * s, flexDirection: "row", alignItems: "center" }}>
      <T style={{ flex: 1, fontFamily: fonts.anton, fontSize: 14 * s, letterSpacing: 14 * s * 0.05, textTransform: "uppercase", color: colors.ochreInk }}>
        🌳 Reality{wish.realizedAt ? ` · ${timeAgo(wish.realizedAt) === "now" ? "just now" : `${timeAgo(wish.realizedAt)} ago`}` : ""}
      </T>
      <Pressable onPress={() => set(false)} disabled={busy} hitSlop={10} accessibilityRole="button" accessibilityLabel="Undo mark as reality">
        <T style={{ fontFamily: fonts.sansBold, fontSize: 11.5 * s, color: colors.ochreInk, textDecorationLine: "underline" }}>Undo</T>
      </Pressable>
    </View>
  );
}

function Thread({ wish, me, isOwner, onReply, onMessage }: { wish: Doc<"wishes">; me: Me; isOwner: boolean; onReply: (c: Comment) => void; onMessage: (userId: Id<"users">) => void }) {
  const { s } = useScale();
  const newestFirst = useQuery(api.comments.listForWish, { wishId: wish._id, onlyApproved: true, order: "desc" });
  if (newestFirst === undefined) return <ActivityIndicator color={colors.red} style={{ marginTop: 20 * s }} />;
  const comments = [...newestFirst].reverse();

  const ids = new Set(comments.map((c) => c._id));
  const roots = comments.filter((c) => !c.parentId || !ids.has(c.parentId));
  const repliesTo = (id: Id<"comments">) => comments.filter((c) => c.parentId === id);
  const item = (c: Comment, depth: number) => (
    <CommentRow key={c._id} c={c} depth={depth} me={me} wish={wish} canRemove={isOwner} onReply={() => onReply(c)} onMessage={onMessage} />
  );

  return (
    <>
      <GroupLabel>{comments.length === 1 ? "1 reply" : `${comments.length} replies`}</GroupLabel>
      {comments.length === 0 && <Empty text="No replies yet — be the first to help." />}
      {roots.map((c) => (
        <View key={c._id}>
          {item(c, 0)}
          {repliesTo(c._id).map((r) => item(r, 1))}
        </View>
      ))}
    </>
  );
}

function CommentRow({ c, depth, me, wish, canRemove, onReply, onMessage }: { c: Comment; depth: number; me: Me; wish: Doc<"wishes">; canRemove: boolean; onReply: () => void; onMessage: (userId: Id<"users">) => void }) {
  const { s } = useScale();
  const reject = useMutation(api.comments.reject);
  const [confirming, setConfirming] = useState(false);
  const mine = c.authorId === me._id;
  const handle = c.authorHandle ?? "unknown";
  const action = { fontFamily: fonts.sansBold, fontSize: 11.5 * s, color: colors.red };
  return (
    <View style={{ marginLeft: depth * 26 * s, marginTop: 9 * s, borderWidth: 1.5, borderColor: colors.line, borderRadius: 13 * s, padding: 12 * s, backgroundColor: colors.cream }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 * s }}>
        <View style={{ width: 24 * s, height: 24 * s, borderRadius: 12 * s, backgroundColor: colors.red, alignItems: "center", justifyContent: "center" }}>
          <T style={{ fontFamily: fonts.sansBold, fontSize: 11 * s, color: colors.cream }}>{handle.charAt(0).toUpperCase()}</T>
        </View>
        <Pressable disabled={mine} onPress={() => onMessage(c.authorId)} accessibilityRole="button" accessibilityLabel={`Message @${handle}`} style={{ flex: 1 }}>
          <T numberOfLines={1} style={{ fontFamily: fonts.sansBold, fontSize: 12.5 * s }}>
            @{handle}
            {c.authorId === wish.ownerId ? <T style={{ color: colors.ochre }}> · owner</T> : null}
            <T style={{ fontFamily: fonts.sans, color: colors.faint }}> · {timeAgo(c.createdAt)}</T>
          </T>
        </Pressable>
        {c.kind === "match" && <Pill tone="true" text="match" />}
      </View>
      {c.body ? <T style={{ fontSize: 13.5 * s, lineHeight: 13.5 * s * 1.4, color: colors.note, marginTop: 6 * s }}>{c.body}</T> : null}
      {c.mediaUrl && (c.kind === "photo" || c.kind === "video") && (
        <View style={{ marginTop: 8 * s }}>
          <MediaView url={c.mediaUrl} kind={c.kind} />
        </View>
      )}
      <View style={{ flexDirection: "row", gap: 16 * s, marginTop: 8 * s }}>
        {depth === 0 && (
          <Pressable onPress={onReply} hitSlop={8} accessibilityRole="button">
            <T style={action}>Reply</T>
          </Pressable>
        )}
        {canRemove &&
          (confirming ? (
            <>
              <Pressable onPress={() => reject({ wishId: wish._id, commentId: c._id, requesterId: me._id })} hitSlop={8} accessibilityRole="button">
                <T style={action}>Confirm remove</T>
              </Pressable>
              <Pressable onPress={() => setConfirming(false)} hitSlop={8} accessibilityRole="button">
                <T style={{ ...action, color: colors.muted }}>Keep</T>
              </Pressable>
            </>
          ) : (
            <Pressable onPress={() => setConfirming(true)} hitSlop={8} accessibilityRole="button">
              <T style={{ ...action, color: colors.muted }}>Remove</T>
            </Pressable>
          ))}
      </View>
    </View>
  );
}
