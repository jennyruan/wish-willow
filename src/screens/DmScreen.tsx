import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { ActivityIndicator, FlatList, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Composer } from "../components/Composer";
import { KeyboardAvoider, TopBar } from "../components/Chrome";
import { MediaView } from "../components/Media";
import { T } from "../components/ui";
import type { Me } from "../identity";
import { timeAgo } from "../media";
import { colors, useScale } from "../theme";
import { Empty } from "./MenuScreen";

/** A 1:1 DM thread, newest at the bottom, live. */
export function DmScreen({ me, conversationId, otherId, onBack }: { me: Me; conversationId: Id<"conversations">; otherId: Id<"users">; onBack: () => void }) {
  const { s } = useScale();
  const otherHandle = useQuery(api.users.handles, { ids: [otherId] })?.[0]?.handle ?? "…";
  const { results, status, loadMore } = usePaginatedQuery(api.dms.listMessages, { conversationId }, { initialNumItems: 30 });
  const sendMessage = useMutation(api.dms.sendMessage);

  return (
    <KeyboardAvoider>
      <TopBar title={`@${otherHandle}`} onBack={onBack} />
      <FlatList
        inverted
        data={results}
        keyExtractor={(m) => m._id}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 22 * s, paddingVertical: 10 * s, flexGrow: 1 }}
        onEndReached={() => status === "CanLoadMore" && loadMore(30)}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          status === "LoadingFirstPage" ? (
            <ActivityIndicator color={colors.red} style={{ marginTop: 24 * s }} />
          ) : (
            <View style={{ transform: [{ scaleY: -1 }] }}>
              <Empty text={`Say hi to @${otherHandle}.`} />
            </View>
          )
        }
        renderItem={({ item: m }) => {
          const mine = m.authorId === me._id;
          return (
            <View style={{ maxWidth: "80%", alignSelf: mine ? "flex-end" : "flex-start", marginVertical: 4 * s }}>
              <View
                style={{
                  backgroundColor: mine ? colors.red : colors.cream,
                  borderWidth: mine ? 0 : 1.5,
                  borderColor: colors.line,
                  borderRadius: 14 * s,
                  borderBottomRightRadius: mine ? 4 * s : 14 * s,
                  borderBottomLeftRadius: mine ? 14 * s : 4 * s,
                  paddingVertical: 9 * s,
                  paddingHorizontal: 12 * s,
                  minWidth: m.mediaUrl ? 200 * s : undefined,
                }}
              >
                {m.mediaUrl && <MediaView url={m.mediaUrl} kind={m.mediaContentType?.startsWith("video/") ? "video" : "photo"} />}
                {m.body ? <T style={{ fontSize: 13.5 * s, lineHeight: 13.5 * s * 1.35, color: mine ? colors.cream : colors.ink, marginTop: m.mediaUrl ? 6 * s : 0 }}>{m.body}</T> : null}
              </View>
              <T style={{ fontSize: 10 * s, color: colors.faint, marginTop: 2 * s, alignSelf: mine ? "flex-end" : "flex-start" }}>{timeAgo(m.createdAt)}</T>
            </View>
          );
        }}
      />
      <Composer placeholder={`message @${otherHandle}…`} onSend={({ body, mediaId }) => sendMessage({ conversationId, authorId: me._id, body, mediaId })} />
    </KeyboardAvoider>
  );
}
