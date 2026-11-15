import { useVideoPlayer, VideoView } from "expo-video";
import { Image, Pressable, View } from "react-native";
import { colors, fonts, useScale } from "../theme";
import type { Attachment } from "../media";
import { T } from "./ui";

/** A posted photo or video, rounded to sit inside a card or bubble. */
export function MediaView({ url, kind }: { url: string; kind: "photo" | "video" }) {
  const { s } = useScale();
  const frame = { width: "100%" as const, height: 190 * s, borderRadius: 12 * s, backgroundColor: colors.paper2 };
  if (kind === "video") return <Video url={url} style={frame} />;
  return <Image source={{ uri: url }} resizeMode="cover" style={frame} accessibilityLabel="Photo reply" />;
}

function Video({ url, style }: { url: string; style: object }) {
  const player = useVideoPlayer(url);
  return <VideoView player={player} nativeControls contentFit="cover" style={[style, { overflow: "hidden" }]} />;
}

/** The staged attachment above a composer, with a remove ×. */
export function AttachmentPreview({ attachment, onRemove }: { attachment: Attachment; onRemove: () => void }) {
  const { s } = useScale();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 * s, marginTop: 8 * s }}>
      <View style={{ width: 52 * s, height: 52 * s, borderWidth: 2, borderStyle: "dashed", borderColor: colors.red, borderRadius: 10 * s, overflow: "hidden", backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" }}>
        {attachment.kind === "photo" ? <Image source={{ uri: attachment.uri }} style={{ width: "100%", height: "100%" }} /> : <T style={{ fontSize: 20 * s }}>🎬</T>}
      </View>
      <T style={{ flex: 1, fontSize: 12 * s, color: colors.muted }}>{attachment.kind === "photo" ? "Photo attached" : "Video attached"}</T>
      <Pressable onPress={onRemove} hitSlop={10} accessibilityRole="button" accessibilityLabel="Remove attachment">
        <T style={{ fontFamily: fonts.sansBold, fontSize: 12 * s, color: colors.red }}>Remove</T>
      </Pressable>
    </View>
  );
}
