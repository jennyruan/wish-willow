import { useConvex, useMutation, useQuery } from "convex/react";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { TopBar, type Tab } from "../components/Chrome";
import { Chip, Chips, CtaButton, Question, StatusLabel, T, VoiceField } from "../components/ui";
import type { Me } from "../identity";
import { timeAgo } from "../media";
import { colors, fonts, useScale } from "../theme";
import { WISH_EMOJI } from "../wishKinds";

export type MenuTab = Exclude<Tab, "community">;

/** The @handle menu: Notifications · Wishes · DMs, and Log out. Wishes is the live wish list, DMs the live inbox. */
export function MenuScreen({
  me,
  tab,
  onTab,
  onBack,
  onOpenWish,
  onOpenDm,
  onLogOut,
}: {
  me: Me;
  tab: MenuTab;
  onTab: (tab: MenuTab) => void;
  onBack: () => void;
  onOpenWish: (wishId: Id<"wishes">) => void;
  onOpenDm: (userId: Id<"users">) => void;
  onLogOut: () => void;
}) {
  const { s } = useScale();
  return (
    <>
      <TopBar title={`@${me.handle}`} onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22 * s, paddingTop: 12 * s, paddingBottom: 14 * s }} keyboardShouldPersistTaps="handled">
        <Chips style={{ marginTop: 2 * s }}>
          <Chip label="🔔 Notifications" on={tab === "notif"} onPress={() => onTab("notif")} />
          <Chip label="🌳 Wishes" on={tab === "wishes"} onPress={() => onTab("wishes")} />
          <Chip label="✉️ DMs" on={tab === "dms"} onPress={() => onTab("dms")} />
        </Chips>
        <View style={{ marginTop: 6 * s }}>
          {tab === "wishes" && <WishList ownerId={me._id} onOpen={onOpenWish} />}
          {tab === "dms" && <Inbox me={me} onOpen={onOpenDm} />}
          {tab === "notif" && (
            <>
              <DailyNudge userId={me._id} />
              <Notifications userId={me._id} onOpen={onOpenWish} />
            </>
          )}
        </View>
        <Pressable
          onPress={onLogOut}
          accessibilityRole="button"
          accessibilityLabel={`Log out of @${me.handle}`}
          style={({ pressed }) => ({ alignSelf: "center", marginTop: 28 * s, borderWidth: 1.5, borderColor: pressed ? colors.redDeep : colors.red, borderRadius: 10 * s, paddingVertical: 9 * s, paddingHorizontal: 18 * s })}
        >
          <T style={{ fontFamily: fonts.sansBold, fontSize: 13 * s, color: colors.red }}>Log out</T>
        </Pressable>
        <T style={{ fontSize: 11 * s, color: colors.faint, marginTop: 6 * s, textAlign: "center" }}>Rejoin with @{me.handle} any time to pick up where you left off.</T>
      </ScrollView>
    </>
  );
}

function WishList({ ownerId, onOpen }: { ownerId: Id<"users">; onOpen: (wishId: Id<"wishes">) => void }) {
  const { s } = useScale();
  const wishes = useQuery(api.wishes.listMine, { ownerId });
  if (wishes === undefined) return <ActivityIndicator color={colors.red} style={{ marginTop: 24 * s }} />;
  if (wishes.length === 0) return <Empty text="No wishes yet — make your first one from the home screen." />;
  return wishes.map((w) => (
    <Row key={w._id} icon={WISH_EMOJI[w.kind]} onPress={() => onOpen(w._id)}>
      <View style={{ flex: 1 }}>
        <Question size={15}>{w.text}</Question>
        <T style={{ fontSize: 11 * s, color: colors.muted, marginTop: 2 * s }}>
          {w.visibility === "public" ? `🌍 Public${w.reward ? ` · $${w.reward} reward` : ""}` : "🔒 Private"}
        </T>
      </View>
      <StatusLabel realized={w.realized} />
    </Row>
  ));
}

const NOTIF_ICON = { comment: "💬", fund: "💸", rsvp: "🎟️", reward: "🎁", match: "💞" } as const;

function Notifications({ userId, onOpen }: { userId: Id<"users">; onOpen: (wishId: Id<"wishes">) => void }) {
  const { s } = useScale();
  const items = useQuery(api.notifications.listMine, { userId });
  if (items === undefined) return <ActivityIndicator color={colors.red} style={{ marginTop: 24 * s }} />;
  if (items.length === 0) return <Empty text="No notifications yet." />;
  return items.map((n) => {
    const wishId = n.wishId;
    return (
      <Row key={n._id} icon={NOTIF_ICON[n.kind]} onPress={wishId ? () => onOpen(wishId) : undefined}>
        <T style={{ flex: 1, fontSize: 13 * s, lineHeight: 13 * s * 1.35, color: colors.note }}>{n.text}</T>
        <T style={{ fontFamily: fonts.sansBold, fontSize: 10 * s, color: colors.faint }}>{timeAgo(n.createdAt)}</T>
      </Row>
    );
  });
}

/**
 * Opt in to Willow's daily check-in over text (Keiki: the free shared iMessage
 * number or Telegram), bound to the user's own iMessage number or Telegram ID.
 */
function DailyNudge({ userId }: { userId: Id<"users"> }) {
  const { s } = useScale();
  const nudge = useQuery(api.nudge.status, { userId });
  const join = useQuery(api.nudge.joinInfo, {});
  const setDailyNudge = useMutation(api.nudge.setDailyNudge);
  const [editing, setEditing] = useState(false);
  const [channel, setChannel] = useState<"imessage" | "telegram">("imessage");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const turnOn = async () => {
    setError(null);
    try {
      await setDailyNudge({ userId, enabled: true, channel, address });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^.*Uncaught Error: /, "").split("\n")[0] : "Couldn't turn it on.");
    }
  };

  const shownChannel = nudge?.enabled ? nudge.channel : channel;
  const where = nudge?.recipient?.replace(/^tg:/, "Telegram ");
  const hint =
    shownChannel === "telegram"
      ? join?.telegramBot && `Message @${join.telegramBot} on Telegram once so Willow can text you back.`
      : join?.imessageNumber && join.joinCode && `Text ${join.joinCode} to ${join.imessageNumber} once so Willow can text you back.`;

  return (
    <View>
      <Row
        icon="💬"
        onPress={nudge === undefined ? undefined : nudge.enabled ? () => setDailyNudge({ userId, enabled: false }) : () => setEditing(!editing)}
      >
        <View style={{ flex: 1 }}>
          <Question size={14}>Daily nudge over text</Question>
          <T style={{ fontSize: 11.5 * s, color: colors.muted, marginTop: 2 * s }}>
            {nudge?.enabled && where ? `Willow texts your daily wish check-in to ${where}.` : "Willow texts your daily wish check-in."}
          </T>
        </View>
        <T style={{ fontFamily: fonts.sansBold, fontSize: 11 * s, color: nudge?.enabled ? colors.red : colors.faint }}>
          {nudge === undefined ? "…" : nudge.enabled ? "ON" : "OFF"}
        </T>
      </Row>
      {!nudge?.enabled && editing && (
        <View style={{ marginBottom: 10 * s }}>
          <Chips>
            <Chip label="iMessage" on={channel === "imessage"} onPress={() => setChannel("imessage")} />
            <Chip label="Telegram" on={channel === "telegram"} onPress={() => setChannel("telegram")} />
          </Chips>
          <VoiceField
            value={address}
            onChangeText={setAddress}
            placeholder={channel === "imessage" ? "Your iMessage number, e.g. +14155550123" : "Your numeric Telegram user ID"}
            keyboardType={channel === "imessage" ? "phone-pad" : "number-pad"}
            autoCapitalize="none"
            onSubmit={turnOn}
          />
          {hint && <T style={{ fontSize: 11.5 * s, color: colors.muted, marginTop: 6 * s }}>{hint}</T>}
          {error && <T style={{ fontSize: 11.5 * s, color: colors.redDeep, marginTop: 6 * s }}>{error}</T>}
          <CtaButton label="Turn on daily nudge" disabled={!address.trim()} onPress={turnOn} />
        </View>
      )}
      {nudge?.enabled && nudge.delivery !== "delivered" && nudge.delivery !== "queued" && (
        <T style={{ fontSize: 11.5 * s, color: nudge.delivery === "unreachable" ? colors.redDeep : colors.muted, marginBottom: 10 * s }}>
          {nudge.delivery === "unreachable" ? "Willow couldn't reach you yet. " : ""}
          {hint || "Text Willow once first so it can reach you."}
        </T>
      )}
    </View>
  );
}

function Inbox({ me, onOpen }: { me: Me; onOpen: (userId: Id<"users">) => void }) {
  const { s } = useScale();
  const convex = useConvex();
  const conversations = useQuery(api.dms.listMine, { userId: me._id });
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    const wanted = handle.trim().replace(/^@/, "");
    if (!wanted) return;
    setError(null);
    const user = await convex.query(api.users.getByHandle, { handle: wanted });
    if (!user) return setError(`No one goes by @${wanted} yet.`);
    if (user._id === me._id) return setError("That’s you — pick someone else.");
    setHandle("");
    onOpen(user._id);
  };

  return (
    <>
      <VoiceField value={handle} onChangeText={setHandle} placeholder="message someone — @handle" autoCapitalize="none" autoCorrect={false} onSubmit={start} />
      {error && <T style={{ fontSize: 11.5 * s, color: colors.redDeep, marginTop: 6 * s }}>{error}</T>}
      {conversations === undefined ? (
        <ActivityIndicator color={colors.red} style={{ marginTop: 24 * s }} />
      ) : conversations.length === 0 ? (
        <Empty text="No messages yet." />
      ) : (
        conversations.map((c) => {
          const who = c.otherHandle ?? "unknown";
          return (
            <Row key={c._id} onPress={() => onOpen(c.otherId)} icon={<Initial handle={who} />}>
              <View style={{ flex: 1 }}>
                <Question size={14}>@{who}</Question>
                <T numberOfLines={1} style={{ fontSize: 11.5 * s, color: colors.muted, marginTop: 2 * s }}>
                  {c.lastBody ?? (c.lastHasMedia ? "📎 Attachment" : "No messages yet")}
                </T>
              </View>
              <T style={{ fontFamily: fonts.sansBold, fontSize: 10 * s, color: colors.faint }}>{timeAgo(c.lastAt)}</T>
            </Row>
          );
        })
      )}
    </>
  );
}

function Initial({ handle }: { handle: string }) {
  const { s } = useScale();
  return (
    <View style={{ width: 30 * s, height: 30 * s, borderRadius: 15 * s, backgroundColor: colors.red, alignItems: "center", justifyContent: "center" }}>
      <T style={{ fontFamily: fonts.sansBold, fontSize: 13 * s, color: colors.cream }}>{handle.charAt(0).toUpperCase()}</T>
    </View>
  );
}

export function Row({ icon, onPress, children }: { icon: ReactNode; onPress?: () => void; children: ReactNode }) {
  const { s } = useScale();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10 * s,
        borderWidth: 1.5,
        borderColor: pressed ? colors.red : colors.line,
        borderRadius: 13 * s,
        paddingVertical: 12 * s,
        paddingHorizontal: 13 * s,
        marginTop: 9 * s,
        backgroundColor: colors.cream,
      })}
    >
      {typeof icon === "string" ? <T style={{ fontSize: 20 * s }}>{icon}</T> : icon}
      {children}
    </Pressable>
  );
}

export function Empty({ text }: { text: string }) {
  const { s } = useScale();
  return <T style={{ fontFamily: fonts.sans, fontSize: 13 * s, color: colors.muted, marginTop: 18 * s, textAlign: "center" }}>{text}</T>;
}
