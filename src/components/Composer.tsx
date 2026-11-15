import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import type { Id } from "../../convex/_generated/dataModel";
import { pickMedia, useUploadMedia, type Attachment } from "../media";
import { colors, useScale } from "../theme";
import { AttachmentPreview } from "./Media";
import { T, VoiceField } from "./ui";

export type Outgoing = { body?: string; mediaId?: Id<"_storage">; kind: "text" | "photo" | "video" };

/** Text + voice + one photo/video, pinned under a thread. Uploads media, then hands off. */
export function Composer({ placeholder, onSend, above }: { placeholder: string; onSend: (msg: Outgoing) => Promise<unknown>; above?: React.ReactNode }) {
  const { s } = useScale();
  const upload = useUploadMedia();
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const body = text.trim() || undefined;
    if (sending || (!body && !attachment)) return;
    setSending(true);
    setError(null);
    try {
      const mediaId = attachment ? await upload(attachment) : undefined;
      await onSend({ body, mediaId, kind: attachment?.kind ?? "text" });
      setText("");
      setAttachment(null);
    } catch {
      setError("Couldn’t send — check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  const attach = async () => {
    const picked = await pickMedia();
    if (picked) setAttachment(picked);
  };

  return (
    <View style={{ paddingHorizontal: 22 * s, paddingBottom: 10 * s, borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.paper }}>
      {above}
      {attachment && <AttachmentPreview attachment={attachment} onRemove={() => setAttachment(null)} />}
      {error && <T style={{ fontSize: 11.5 * s, color: colors.redDeep, marginTop: 8 * s }}>{error}</T>}
      <VoiceField
        style={{ marginTop: 8 * s }}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        onSubmit={send}
        canSubmit={!sending && (text.trim().length > 0 || attachment !== null)}
        prefix={
          <Pressable onPress={attach} disabled={sending} hitSlop={8} accessibilityRole="button" accessibilityLabel="Attach a photo or video">
            <T style={{ fontSize: 18 * s, color: colors.red }}>＋</T>
          </Pressable>
        }
        suffix={sending ? <ActivityIndicator color={colors.red} /> : null}
      />
    </View>
  );
}
