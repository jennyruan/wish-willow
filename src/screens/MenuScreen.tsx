import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { TopBar, type Tab } from "../components/Chrome";
import { Chip, Chips, Question, StatusLabel, T } from "../components/ui";
import { colors, fonts, useScale } from "../theme";
import { WISH_EMOJI } from "../wishKinds";

export type MenuTab = Exclude<Tab, "community">;

/** The @handle menu: Notifications · Wishes · DMs. Wishes is the live wish list. */
export function MenuScreen({ me, tab, onTab, onBack }: { me: { _id: Id<"users">; handle: string }; tab: MenuTab; onTab: (tab: MenuTab) => void; onBack: () => void }) {
  const { s } = useScale();
  return (
    <>
      <TopBar title={`@${me.handle}`} onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22 * s, paddingTop: 12 * s, paddingBottom: 14 * s }}>
        <Chips style={{ marginTop: 2 * s }}>
          <Chip label="🔔 Notifications" on={tab === "notif"} onPress={() => onTab("notif")} />
          <Chip label="🌳 Wishes" on={tab === "wishes"} onPress={() => onTab("wishes")} />
          <Chip label="✉️ DMs" on={tab === "dms"} onPress={() => onTab("dms")} />
        </Chips>
        <View style={{ marginTop: 6 * s }}>
          {tab === "wishes" ? (
            <WishList ownerId={me._id} />
          ) : (
            <Empty text={tab === "notif" ? "No notifications yet." : "No messages yet."} />
          )}
        </View>
      </ScrollView>
    </>
  );
}

function WishList({ ownerId }: { ownerId: Id<"users"> }) {
  const { s } = useScale();
  const wishes = useQuery(api.wishes.listMine, { ownerId });
  if (wishes === undefined) return <ActivityIndicator color={colors.red} style={{ marginTop: 24 * s }} />;
  if (wishes.length === 0) return <Empty text="No wishes yet — make your first one from the home screen." />;
  return wishes.map((w) => (
    <Row key={w._id} icon={WISH_EMOJI[w.kind]}>
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

export function Row({ icon, children }: { icon: string; children: ReactNode }) {
  const { s } = useScale();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 * s, borderWidth: 1.5, borderColor: colors.line, borderRadius: 13 * s, paddingVertical: 12 * s, paddingHorizontal: 13 * s, marginTop: 9 * s, backgroundColor: colors.cream }}>
      <T style={{ fontSize: 20 * s }}>{icon}</T>
      {children}
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  const { s } = useScale();
  return <T style={{ fontFamily: fonts.sans, fontSize: 13 * s, color: colors.muted, marginTop: 18 * s, textAlign: "center" }}>{text}</T>;
}
