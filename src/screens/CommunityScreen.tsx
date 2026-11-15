import { usePaginatedQuery, useQuery } from "convex/react";
import { ActivityIndicator, FlatList, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { TopBar } from "../components/Chrome";
import { Kicker, Pill, Question, T } from "../components/ui";
import { colors, useScale } from "../theme";
import { WISH_EMOJI } from "../wishKinds";
import { Empty, Row } from "./MenuScreen";

/** The grove: everyone's public wishes, newest first, live. */
export function CommunityScreen({ onBack, onOpenWish }: { onBack: () => void; onOpenWish: (wishId: Id<"wishes">) => void }) {
  const { s } = useScale();
  const { results, status, loadMore } = usePaginatedQuery(api.wishes.listPublic, {}, { initialNumItems: 20 });
  const ownerIds = [...new Set(results.map((w) => w.ownerId))];
  const handles = useQuery(api.users.handles, ownerIds.length ? { ids: ownerIds } : "skip");
  const handleOf = new Map(handles?.map((u) => [u._id, u.handle]));

  return (
    <>
      <TopBar title="COMMUNITY" onBack={onBack} />
      <FlatList
        data={results}
        keyExtractor={(w) => w._id}
        contentContainerStyle={{ paddingHorizontal: 22 * s, paddingTop: 12 * s, paddingBottom: 14 * s }}
        ListHeaderComponent={<Kicker>The grove — public wishes</Kicker>}
        ListEmptyComponent={
          status === "LoadingFirstPage" ? (
            <ActivityIndicator color={colors.red} style={{ marginTop: 24 * s }} />
          ) : (
            <Empty text="No public wishes yet — cast one and choose Public." />
          )
        }
        ListFooterComponent={status === "LoadingMore" ? <ActivityIndicator color={colors.red} style={{ marginTop: 12 * s }} /> : null}
        onEndReached={() => status === "CanLoadMore" && loadMore(20)}
        onEndReachedThreshold={0.5}
        renderItem={({ item: w }) => {
          const meta = [handleOf.get(w.ownerId) && `@${handleOf.get(w.ownerId)}`, w.location && `📍 ${w.location}`, w.reward ? `$${w.reward}` : null]
            .filter(Boolean)
            .join(" · ");
          return (
            <Row icon={WISH_EMOJI[w.kind]} onPress={() => onOpenWish(w._id)}>
              <View style={{ flex: 1 }}>
                <Question size={14}>{w.text}</Question>
                {meta ? <T style={{ fontSize: 11 * s, color: colors.muted, marginTop: 2 * s }}>{meta}</T> : null}
              </View>
              {w.realized ? <Pill tone="true" text="✓ came true" /> : w.reward ? <Pill tone="true" text={`$${w.reward}`} /> : <Pill tone="prog" text="free" />}
            </Row>
          );
        }}
      />
    </>
  );
}
