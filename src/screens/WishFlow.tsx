import { useAction, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Animated, BackHandler, Easing, Image, Linking, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { KeyboardAvoider, TopBar } from "../components/Chrome";
import { Twig } from "../components/Logo";
import { Chip, Chips, CtaButton, GroupLabel, Kicker, Question, Select, Sub, T, VoiceField } from "../components/ui";
import { colors, fonts, useScale } from "../theme";
import { uploadToConvex } from "../upload";
import { EXAMPLE_WISHES, type WishKind } from "../wishKinds";

type StepId = "locality" | "location" | "config" | "track" | "photos" | "budget" | "ask" | "extra" | "privacy" | "blow";
type Clarify = FunctionReturnType<typeof api.ai.clarifyWish>;
type Research = FunctionReturnType<typeof api.ai.research>;
type TimeUnit = "days" | "weeks" | "months" | "years";
type Place = { label: string; lat: number; lng: number; source: string; fetchedAt: number };

const STEPS: Record<WishKind, StepId[]> = {
  girlfriend: ["locality", "photos", "budget", "ask", "extra", "privacy", "blow"],
  boyfriend: ["locality", "photos", "budget", "ask", "extra", "privacy", "blow"],
  iphone: ["config", "location", "budget", "ask", "extra", "privacy", "blow"],
  hackathon: ["track", "ask", "extra", "privacy", "blow"],
  other: ["budget", "ask", "extra", "privacy", "blow"],
};

const FINISHES: Record<string, string> = { Silver: "#DCDEE1", Black: "#2A2A2C", Glacier: "#C9DCE6", Burgundy: "#5E2733" };
const TRACKS = ["Who’s winning", "Timeline", "Prizes + sponsors", "The buzz"];
const NUMBERS = Array.from({ length: 30 }, (_, i) => i + 1);
const UNITS: TimeUnit[] = ["days", "weeks", "months", "years"];
const REWARDS = [0, 25, 50, 100];

type Answers = {
  locality?: "local" | "remote";
  locationText: string;
  place: Place | null;
  config: { model?: string; finish?: string; storage?: string };
  track: string[];
  photos: string[];
  note: string;
  budget: string;
  timeNum: number;
  timeUnit: TimeUnit;
  aiAnswers: string[];
  extra: string;
  visibility?: "private" | "public";
  reward: string;
};

function wishText(kind: WishKind, customText: string, a: Answers) {
  if (kind === "iphone") return `I have an iPhone 18 ${a.config.model ?? "Pro"}`;
  if (kind === "other") return /^i\s/i.test(customText) ? customText : `I wish ${customText}`;
  return EXAMPLE_WISHES.find((w) => w.kind === kind)!.text;
}

const digits = (t: string) => t.replace(/[^0-9]/g, "");

/** Adaptive clarify steps (plus Willow's AI questions) → anything else → private/public → blow, then wishes.create and ai.research. */
export function WishFlow({
  me,
  kind,
  customText = "",
  onExit,
  onDone,
  onAvatar,
}: {
  me: { _id: Id<"users">; handle: string };
  kind: WishKind;
  customText?: string;
  onExit: () => void;
  onDone: () => void;
  onAvatar: () => void;
}) {
  const { s } = useScale();
  const steps = STEPS[kind];
  const [i, setI] = useState(0);
  const [a, setA] = useState<Answers>({ locationText: "", place: null, config: {}, track: [], photos: [], note: "", budget: "", timeNum: 3, timeUnit: "months", aiAnswers: [], extra: "", reward: "" });
  const [castState, setCastState] = useState<"casting" | "cast" | "failed">("casting");
  const [clarify, setClarify] = useState<Clarify | null>(null);
  const [wishId, setWishId] = useState<Id<"wishes"> | null>(null);
  const [research, setResearch] = useState<Research | null>(null);
  const [showResults, setShowResults] = useState(false);
  const create = useMutation(api.wishes.create);
  const clarifyWish = useAction(api.ai.clarifyWish);
  const runResearch = useAction(api.ai.research);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const step = steps[i];
  const set = (patch: Partial<Answers>) => setA((prev) => ({ ...prev, ...patch }));
  const next = () => setI(i + 1);
  const back = () => (i === 0 ? onExit() : setI(i - 1));

  useEffect(() => {
    clarifyWish({ wishText: wishText(kind, customText, a), kind })
      .then(setClarify)
      .catch(() => setClarify({ status: "error", message: "Couldn’t reach Willow — check your connection." }));
  }, []);

  const startResearch = (id: Id<"wishes">) => {
    setResearch(null);
    runResearch({ wishId: id })
      .then(setResearch)
      .catch(() => setResearch({ status: "error", message: "Couldn’t reach Willow — check your connection." }));
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step !== "blow") back();
      return true;
    });
    return () => sub.remove();
  });

  const cast = async () => {
    setI(steps.indexOf("blow"));
    setCastState("casting");
    try {
      const photoIds = await Promise.all(a.photos.map(async (uri) => uploadToConvex(uri, await generateUploadUrl(), "image/jpeg")));
      const wantsPlace = kind === "iphone" || a.locality === "local";
      const hasBudget = steps.includes("budget");
      const intake = JSON.parse(
        JSON.stringify({
          config: kind === "iphone" ? a.config : undefined,
          track: kind === "hackathon" ? a.track : undefined,
          note: a.note.trim() || undefined,
          extra: a.extra.trim() || undefined,
          photoIds: photoIds.length ? photoIds : undefined,
          place: wantsPlace ? a.place ?? undefined : undefined,
          clarify:
            clarify?.status === "ok"
              ? {
                  ...clarify.intake,
                  answers: clarify.questions.map((question, n) => ({ question, answer: a.aiAnswers[n]?.trim() })).filter((qa) => qa.answer),
                }
              : undefined,
        }),
      );
      const id = await create({
        ownerId: me._id,
        text: wishText(kind, customText, a),
        kind,
        intake,
        locality: a.locality,
        location: wantsPlace ? a.place?.label ?? (a.locationText.trim() || undefined) : undefined,
        budget: hasBudget && a.budget ? Number(a.budget) : undefined,
        timeNum: hasBudget ? a.timeNum : undefined,
        timeUnit: hasBudget ? a.timeUnit : undefined,
        visibility: a.visibility ?? "private",
        reward: a.visibility === "public" && a.reward ? Number(a.reward) : undefined,
      });
      setWishId(id);
      setCastState("cast");
      startResearch(id);
    } catch {
      setCastState("failed");
    }
  };

  if (step === "blow" && showResults && wishId) {
    return (
      <>
        <TopBar handle={me.handle} />
        <Results research={research} onRetry={() => startResearch(wishId)} onDone={onDone} />
      </>
    );
  }

  if (step === "blow") {
    return (
      <>
        <TopBar handle={me.handle} />
        <Blow state={castState} isPublic={a.visibility === "public"} onSee={() => setShowResults(true)} onRetry={cast} />
      </>
    );
  }

  const questionSteps = steps.filter((x) => x !== "blow");
  const isPhone = kind === "iphone";

  return (
    <KeyboardAvoider>
      <TopBar onBack={back} handle={me.handle} onAvatar={onAvatar} />
      <View style={{ flexDirection: "row", gap: 6 * s, justifyContent: "center", paddingTop: 12 * s, paddingBottom: 2 * s }}>
        {questionSteps.map((x) => (
          <View key={x} style={{ height: 6 * s, width: (x === step ? 18 : 6) * s, borderRadius: 4 * s, backgroundColor: x === step ? colors.red : colors.line }} />
        ))}
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22 * s, paddingTop: 12 * s, paddingBottom: 14 * s }}>
        {step === "locality" && (
          <>
            <Kicker>Willow asks</Kicker>
            <Question>Local, or is remote fine?</Question>
            <Sub>For your {kind} — someone nearby, or anywhere?</Sub>
            <Chips>
              <Chip label="Local — nearby" on={a.locality === "local"} onPress={() => set({ locality: "local" })} />
              <Chip label="Remote is fine" on={a.locality === "remote"} onPress={() => set({ locality: "remote" })} />
            </Chips>
            {a.locality === "local" && (
              <LocationField text={a.locationText} placeholder="city or ZIP" onText={(locationText) => set({ locationText, place: null })} onPlace={(place) => set({ place })} />
            )}
          </>
        )}

        {step === "location" && (
          <>
            <Kicker>Willow asks</Kicker>
            <Question>Where are you?</Question>
            <LocationField text={a.locationText} placeholder="e.g. “San Francisco, happy to travel a bit”" onText={(locationText) => set({ locationText, place: null })} onPlace={(place) => set({ place })} />
          </>
        )}

        {step === "config" && (
          <>
            <Kicker>Willow asks</Kicker>
            <Question>Which configuration?</Question>
            <GroupLabel>Model</GroupLabel>
            <Chips>
              {["Pro", "Pro Max"].map((v) => (
                <Chip key={v} label={v} on={a.config.model === v} onPress={() => set({ config: { ...a.config, model: v } })} />
              ))}
            </Chips>
            <Sub style={{ marginTop: 4 * s }}>Pro is 6.3″ · Pro Max is 6.9″</Sub>
            <GroupLabel>Finish</GroupLabel>
            <Chips>
              {Object.entries(FINISHES).map(([v, swatch]) => (
                <Chip key={v} label={v} swatch={swatch} on={a.config.finish === v} onPress={() => set({ config: { ...a.config, finish: v } })} />
              ))}
            </Chips>
            <GroupLabel>Storage</GroupLabel>
            <Chips>
              {["256GB", "512GB", "1TB", "2TB"].map((v) => (
                <Chip key={v} label={v} on={a.config.storage === v} onPress={() => set({ config: { ...a.config, storage: v } })} />
              ))}
            </Chips>
          </>
        )}

        {step === "track" && (
          <>
            <Kicker>Willow asks</Kicker>
            <Question>What do you want to know?</Question>
            <Chips>
              {TRACKS.map((v) => (
                <Chip key={v} label={v} on={a.track.includes(v)} onPress={() => set({ track: a.track.includes(v) ? a.track.filter((t) => t !== v) : [...a.track, v] })} />
              ))}
            </Chips>
            <VoiceField value={a.note} onChangeText={(note) => set({ note })} placeholder="anything specific? (voice ok)" />
          </>
        )}

        {step === "photos" && (
          <>
            <Kicker>Willow asks</Kicker>
            <Question>Show me your type</Question>
            <Sub>Upload a few photos of the kind of person you're drawn to — pick several at once.</Sub>
            <PhotoPicker photos={a.photos} onChange={(photos) => set({ photos })} />
            <VoiceField value={a.note} onChangeText={(note) => set({ note })} placeholder="anything specific? (voice ok)" />
          </>
        )}

        {step === "budget" && (
          <>
            <Kicker>Willow asks</Kicker>
            <Question>{isPhone ? "Budget & timing?" : "Any budget or timing?"}</Question>
            <Sub>{isPhone ? "What can you spend, and by when?" : "Willow stays within whatever you set."}</Sub>
            <VoiceField
              value={a.budget}
              onChangeText={(t) => set({ budget: digits(t) })}
              placeholder={isPhone ? "900" : "80"}
              keyboardType="number-pad"
              inputMode="numeric"
              style={{ marginTop: 18 * s }}
              prefix={<T style={{ fontFamily: fonts.anton, fontSize: 20 * s, color: colors.red }}>$</T>}
              suffix={<T numberOfLines={1} style={{ flexShrink: 0, fontSize: 11 * s, color: colors.faint }}>{isPhone ? "budget" : "per step"}</T>}
            />
            <GroupLabel>By when?</GroupLabel>
            <View style={{ flexDirection: "row", gap: 10 * s, marginTop: 8 * s }}>
              <Select label="How many" value={a.timeNum} options={NUMBERS} onChange={(timeNum) => set({ timeNum })} />
              <Select label="Unit" value={a.timeUnit} options={UNITS} onChange={(timeUnit) => set({ timeUnit })} />
            </View>
          </>
        )}

        {step === "ask" && (
          <>
            <Kicker>Willow asks</Kicker>
            {clarify === null && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 * s, marginTop: 14 * s }}>
                <ActivityIndicator color={colors.red} />
                <Sub style={{ marginTop: 0 }}>Willow is thinking about your wish…</Sub>
              </View>
            )}
            {clarify !== null && clarify.status !== "ok" && (
              <>
                <Question>A few more questions</Question>
                <Sub>{clarify.status === "not_configured" ? "Willow’s AI isn’t set up yet — tap Next to keep going." : `Willow couldn’t think this one through (${clarify.message}). Tap Next to keep going.`}</Sub>
              </>
            )}
            {clarify?.status === "ok" && (
              <>
                <Sub>{clarify.intake.summary}</Sub>
                {clarify.questions.map((question, n) => (
                  <View key={question}>
                    <Question size={19} style={{ marginTop: 18 * s }}>{question}</Question>
                    {clarify.options?.[n]?.length ? (
                      <Chips style={{ marginTop: 10 * s, marginBottom: 10 * s }}>
                        {clarify.options[n].map((option) => (
                          <Chip key={option} label={option} on={a.aiAnswers[n] === option} onPress={() => set({ aiAnswers: Object.assign([...a.aiAnswers], { [n]: option }) })} />
                        ))}
                      </Chips>
                    ) : null}
                    <VoiceField
                      value={a.aiAnswers[n] ?? ""}
                      onChangeText={(t) => set({ aiAnswers: Object.assign([...a.aiAnswers], { [n]: t }) })}
                      placeholder="type or speak…"
                    />
                  </View>
                ))}
              </>
            )}
          </>
        )}

        {step === "extra" && (
          <>
            <Kicker>One more thing</Kicker>
            <Question>Anything else I should know?</Question>
            <VoiceField multiline value={a.extra} onChangeText={(extra) => set({ extra })} placeholder="speak freely — the more I know you, the better I help…" style={{ marginTop: 20 * s }} />
          </>
        )}

        {step === "privacy" && (
          <>
            <Question size={23}>Who keeps this wish?</Question>
            <Option title="🔒 Private" body="Just you & Willow. Willow works on it quietly." on={a.visibility === "private"} onPress={() => set({ visibility: "private" })} />
            <Option title="🌍 Public" body="You, Willow & the community — others can help, and you reward whoever does." on={a.visibility === "public"} onPress={() => set({ visibility: "public" })}>
              {a.visibility === "public" && <RewardBox value={a.reward} onChange={(reward) => set({ reward })} />}
            </Option>
            <CtaButton label="Confirm & cast" onPress={cast} disabled={!a.visibility} />
          </>
        )}

        {step !== "privacy" && (
          <>
            <View style={{ flex: 1 }} />
            <CtaButton label="Next" onPress={next} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoider>
  );
}

/** City/ZIP field that geocodes as you type (debounced) through the geo.geocode action. */
function LocationField({ text, placeholder, onText, onPlace }: { text: string; placeholder: string; onText: (t: string) => void; onPlace: (p: Place | null) => void }) {
  const { s } = useScale();
  const geocode = useAction(api.geo.geocode);
  const [status, setStatus] = useState<{ kind: "idle" | "reading" | "missing" | "offline" } | { kind: "found"; label: string }>({ kind: "idle" });

  useEffect(() => {
    const query = text.trim();
    if (query.length < 3) {
      setStatus({ kind: "idle" });
      return;
    }
    setStatus({ kind: "reading" });
    let live = true;
    const timer = setTimeout(() => {
      geocode({ query })
        .then((place) => {
          if (!live) return;
          onPlace(place);
          setStatus(place ? { kind: "found", label: place.label } : { kind: "missing" });
        })
        .catch(() => live && setStatus({ kind: "offline" }));
    }, 600);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [text]);

  return (
    <>
      <VoiceField value={text} onChangeText={onText} placeholder={placeholder} autoCorrect={false} />
      {status.kind !== "idle" && (
        <View style={{ marginTop: 12 * s, backgroundColor: colors.paper2, borderWidth: 1, borderColor: colors.line, borderRadius: 12 * s, paddingVertical: 10 * s, paddingHorizontal: 12 * s }}>
          <T style={{ fontSize: 12.5 * s, color: colors.note }}>
            {status.kind === "reading" && "Reading…"}
            {status.kind === "missing" && "Hmm, couldn’t find that — try a city name or 5-digit ZIP."}
            {status.kind === "offline" && "Couldn’t reach the location service — check your connection."}
            {status.kind === "found" && (
              <>
                Got it — <T style={{ fontFamily: fonts.sansBold, color: colors.redDeep }}>📍 {status.label}</T> · Willow will search nearby.
              </>
            )}
          </T>
        </View>
      )}
    </>
  );
}

function PhotoPicker({ photos, onChange }: { photos: string[]; onChange: (photos: string[]) => void }) {
  const { s } = useScale();
  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, quality: 0.7 });
    if (!result.canceled) onChange([...photos, ...result.assets.map((asset) => asset.uri)]);
  };
  return (
    <>
      <Pressable onPress={pick} accessibilityRole="button" style={{ alignSelf: "flex-start", marginTop: 14 * s, borderWidth: 1.5, borderColor: colors.red, borderRadius: 12 * s, paddingVertical: 11 * s, paddingHorizontal: 16 * s }}>
        <T style={{ fontFamily: fonts.sansBold, fontSize: 13 * s, color: colors.red }}>＋ Add photos</T>
      </Pressable>
      {photos.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 * s, marginTop: 12 * s }}>
          {photos.map((uri) => (
            <Pressable key={uri} onPress={() => onChange(photos.filter((p) => p !== uri))} accessibilityLabel="Remove photo">
              <View style={{ width: 64 * s, height: 84 * s, borderWidth: 2, borderStyle: "dashed", borderColor: colors.red, borderRadius: 10 * s, overflow: "hidden", backgroundColor: colors.cream }}>
                <Image source={{ uri }} style={{ width: "100%", height: "100%" }} />
              </View>
              <View style={{ position: "absolute", top: -6, right: -6, width: 18 * s, height: 18 * s, borderRadius: 9 * s, backgroundColor: colors.red, alignItems: "center", justifyContent: "center" }}>
                <T style={{ color: colors.cream, fontSize: 11 * s, lineHeight: 13 * s }}>×</T>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );
}

function Option({ title, body, on, onPress, children }: { title: string; body: string; on: boolean; onPress: () => void; children?: ReactNode }) {
  const { s } = useScale();
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: on }} style={{ marginTop: 12 * s, paddingBottom: on ? 0 : 3 * s }}>
      {on && <View style={{ position: "absolute", left: 0, right: 0, bottom: -3 * s, top: 3 * s, borderRadius: 14 * s, backgroundColor: "rgba(178,58,44,.25)" }} />}
      <View style={{ borderWidth: 1.5, borderColor: on ? colors.red : colors.line, borderRadius: 14 * s, paddingVertical: 13 * s, paddingHorizontal: 14 * s, backgroundColor: colors.cream }}>
        <T style={{ fontFamily: fonts.anton, fontSize: 14 * s, letterSpacing: 14 * s * 0.04, textTransform: "uppercase" }}>{title}</T>
        <T style={{ fontSize: 11.5 * s, lineHeight: 11.5 * s * 1.35, color: colors.body, marginTop: 5 * s }}>{body}</T>
        {children}
      </View>
    </Pressable>
  );
}

function RewardBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { s } = useScale();
  return (
    <View style={{ marginTop: 11 * s, backgroundColor: colors.paper2, borderWidth: 1, borderStyle: "dashed", borderColor: colors.red, borderRadius: 11 * s, paddingVertical: 10 * s, paddingHorizontal: 12 * s }}>
      <View style={{ flexDirection: "row", gap: 6 * s, marginBottom: 9 * s }}>
        {REWARDS.map((v) => {
          const on = value === String(v);
          return (
            <Pressable key={v} onPress={() => onChange(String(v))} accessibilityRole="button" accessibilityState={{ selected: on }} style={{ flex: 1, paddingBottom: 2 * s }}>
              {on && <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: 2 * s, borderRadius: 16 * s, backgroundColor: colors.redDeep }} />}
              <View style={{ alignItems: "center", borderWidth: 1.5, borderColor: colors.red, borderRadius: 16 * s, paddingVertical: 7 * s, backgroundColor: on ? colors.red : "transparent" }}>
                <T style={{ fontFamily: fonts.sansBold, fontSize: 12 * s, color: on ? colors.cream : colors.red }}>${v}</T>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 * s }}>
        <T style={{ fontFamily: fonts.anton, fontSize: 20 * s, color: colors.red }}>$</T>
        <TextInput
          value={value}
          onChangeText={(t) => onChange(digits(t))}
          placeholder="price it"
          placeholderTextColor={colors.faint}
          keyboardType="number-pad"
          inputMode="numeric"
          maxFontSizeMultiplier={1.25}
          style={{ flex: 1, fontFamily: fonts.sans, fontSize: 14 * s, color: colors.ink, paddingVertical: 4 * s, outlineStyle: "none" } as object}
        />
        <T style={{ fontSize: 10 * s, letterSpacing: 10 * s * 0.08, color: colors.faint }}>reward</T>
      </View>
    </View>
  );
}

const native = Platform.OS !== "web";
const CATKINS: Array<[number, number, number, number]> = [
  [-70, -120, 220, 0], [60, -150, -180, 0.2], [-110, -60, 160, 0.4], [120, -80, -200, 0.6],
  [-40, -180, 120, 0.8], [90, -130, -140, 1], [-130, -110, 200, 1.2], [40, -170, 90, 1.4],
];

function Catkin({ dx, dy, rotate, delay }: { dx: number; dy: number; rotate: number; delay: number }) {
  const { s } = useScale();
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(t, { toValue: 1, duration: 2600, easing: Easing.out(Easing.ease), useNativeDriver: native }));
    const timer = setTimeout(() => loop.start(), delay * 1000);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [t, delay]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: "50%",
        top: "48%",
        width: 7 * s,
        height: 11 * s,
        borderRadius: 5 * s,
        backgroundColor: colors.cream,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,.08)",
        zIndex: 3,
        opacity: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, dx * s] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, dy * s] }) },
          { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${rotate}deg`] }) },
        ],
      }}
    />
  );
}

const host = (url: string) => url.replace(/^https?:\/\/(www\.)?/i, "").split(/[/?#]/)[0];

/** Willow's researched options: each card links to the real page and lists the sources that back it. */
function Results({ research, onRetry, onDone }: { research: Research | null; onRetry: () => void; onDone: () => void }) {
  const { s } = useScale();
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22 * s, paddingTop: 12 * s, paddingBottom: 16 * s }}>
      <Kicker>Willow found</Kicker>
      <Question>{research?.status === "ok" ? "Real paths to your wish" : "Willow’s on it"}</Question>
      {research === null && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 * s, marginTop: 14 * s }}>
          <ActivityIndicator color={colors.red} />
          <Sub style={{ marginTop: 0, flex: 1 }}>Searching live sources for options within your budget and timeline…</Sub>
        </View>
      )}
      {research?.status === "not_configured" && <Sub>Willow’s AI isn’t set up yet, so there’s no research for this wish. It’s saved — check back once Willow is configured.</Sub>}
      {research?.status === "error" && (
        <>
          <Sub>Willow couldn’t finish the research ({research.message}).</Sub>
          <CtaButton label="Try again" onPress={onRetry} />
        </>
      )}
      {research?.status === "ok" && (
        <>
          <Sub>{research.summary}</Sub>
          {research.options.length === 0 && <Sub>Willow couldn’t verify any options against a real source yet.</Sub>}
          {research.options.map((o) => (
            <View key={o.url + o.title} style={{ marginTop: 12 * s, borderWidth: 1.5, borderColor: colors.line, borderRadius: 13 * s, padding: 13 * s, backgroundColor: colors.cream }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 * s }}>
                <T style={{ flex: 1, fontFamily: fonts.sansBold, fontSize: 14 * s }}>{o.title}</T>
                {o.price && <T style={{ fontFamily: fonts.anton, fontSize: 14 * s, color: colors.red }}>{o.price}</T>}
              </View>
              <T style={{ fontSize: 12.5 * s, lineHeight: 12.5 * s * 1.4, color: colors.note, marginTop: 5 * s }}>{o.detail}</T>
              <Pressable onPress={() => Linking.openURL(o.url)} accessibilityRole="link" style={{ alignSelf: "flex-start", marginTop: 10 * s, backgroundColor: colors.red, borderRadius: 10 * s, paddingVertical: 8 * s, paddingHorizontal: 14 * s }}>
                <T style={{ fontFamily: fonts.sansBold, fontSize: 12 * s, color: colors.cream }}>{o.action} ↗</T>
              </Pressable>
              <T style={{ fontSize: 10.5 * s, color: colors.faint, marginTop: 8 * s }}>
                Sources:{" "}
                {o.sources.map((src, n) => (
                  <T key={src} onPress={() => Linking.openURL(src)} style={{ textDecorationLine: "underline" }}>
                    {host(src)}
                    {n < o.sources.length - 1 ? ", " : ""}
                  </T>
                ))}
                {" · fetched "}
                {new Date(research.fetchedAt).toLocaleString()}
              </T>
            </View>
          ))}
        </>
      )}
      <View style={{ flex: 1 }} />
      <CtaButton label="See my wishes" onPress={onDone} />
    </ScrollView>
  );
}

/** Catkins scatter from the twig while the wish is saved; the CTA fades in once it's cast. */
function Blow({ state, isPublic, onSee, onRetry }: { state: "casting" | "cast" | "failed"; isPublic: boolean; onSee: () => void; onRetry: () => void }) {
  const { s } = useScale();
  const cta = useRef(new Animated.Value(0)).current;
  const [minElapsed, setMinElapsed] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), 1800);
    return () => clearTimeout(timer);
  }, []);
  const ready = (minElapsed && state === "cast") || state === "failed";
  useEffect(() => {
    Animated.timing(cta, { toValue: ready ? 1 : 0, duration: 500, useNativeDriver: native }).start();
  }, [ready, cta]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20 * s }}>
      {CATKINS.map(([dx, dy, rotate, delay], idx) => (
        <Catkin key={idx} dx={dx} dy={dy} rotate={rotate} delay={delay} />
      ))}
      <Twig width={58 * s} height={112 * s} />
      <Question size={24} style={{ marginTop: 22 * s, textAlign: "center" }}>Wish cast 🌬</Question>
      <Sub style={{ textAlign: "center" }}>
        {state === "failed" ? "Couldn’t save your wish — check your connection and try again." : isPublic ? "Posted to the grove. Willow’s on it." : "Willow’s on it."}
      </Sub>
      <Animated.View style={{ opacity: cta, width: "100%", maxWidth: 220 * s, marginTop: 6 * s }} pointerEvents={ready ? "auto" : "none"}>
        <CtaButton label={state === "failed" ? "Try again" : "See what Willow found"} onPress={state === "failed" ? onRetry : onSee} />
      </Animated.View>
    </View>
  );
}
