import { useConvex, useQuery } from "convex/react";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { TopBar, type Tab } from "../components/Chrome";
import { Chip, Chips, Question, StatusLabel, T, VoiceField } from "../components/ui";
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
          {tab === "notif" && <Empty text="No notifications yet." />}
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
