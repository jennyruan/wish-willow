import { useMutation } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { BackHandler } from "react-native";
import { Screen, TabBar, type Tab } from "./components/Chrome";
import { useIdentity } from "./identity";
import { CommunityScreen } from "./screens/CommunityScreen";
import { DmScreen } from "./screens/DmScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { JoinScreen } from "./screens/JoinScreen";
import { MenuScreen, type MenuTab } from "./screens/MenuScreen";
import { Splash } from "./screens/Splash";
import { WishFlow } from "./screens/WishFlow";
import { WishScreen } from "./screens/WishScreen";
import { useStreak } from "./streak";
import type { WishKind } from "./wishKinds";

type Route =
  | { name: "home" }
  | { name: "menu"; tab: MenuTab }
  | { name: "community" }
  | { name: "wish"; wishId: Id<"wishes">; from: Route }
  | { name: "dm"; conversationId: Id<"conversations">; otherId: Id<"users">; from: Route }
  | { name: "flow"; kind: WishKind; customText?: string; key: number };

export function Root() {
  const { identity, join } = useIdentity();
  const getOrCreateConversation = useMutation(api.dms.getOrCreateConversation);
  const streak = useStreak();
  const [splashDone, setSplashDone] = useState(false);
  const [route, setRoute] = useState<Route>({ name: "home" });
  const finishSplash = useCallback(() => setSplashDone(true), []);
  const home = () => setRoute({ name: "home" });
  const openTab = (tab: Tab) => setRoute(tab === "community" ? { name: "community" } : { name: "menu", tab });

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (route.name === "home") return false;
      setRoute(route.name === "wish" || route.name === "dm" ? route.from : { name: "home" });
      return true;
    });
    return () => sub.remove();
  }, [route]);

  if (!splashDone) return <Splash ready={identity.status !== "loading"} onDone={finishSplash} />;
  if (identity.status !== "ready") {
    return <JoinScreen initialHandle={identity.status === "needsHandle" ? identity.handle : ""} error={identity.status === "needsHandle" ? identity.error : undefined} onJoin={join} />;
  }

  const me = identity.user;
  const openWish = (wishId: Id<"wishes">) => setRoute({ name: "wish", wishId, from: route });
  const openDm = async (otherId: Id<"users">) => {
    const conversationId = await getOrCreateConversation({ a: me._id, b: otherId });
    setRoute({ name: "dm", conversationId, otherId, from: route });
  };

  if (route.name === "dm") {
    return (
      <Screen>
        <DmScreen key={route.conversationId} me={me} conversationId={route.conversationId} otherId={route.otherId} onBack={() => setRoute(route.from)} />
      </Screen>
    );
  }

  if (route.name === "flow") {
    return (
      <Screen>
        <WishFlow
          key={route.key}
          me={me}
          kind={route.kind}
          customText={route.customText}
          onExit={home}
          onDone={() => setRoute({ name: "menu", tab: "wishes" })}
          onAvatar={() => setRoute({ name: "menu", tab: "notif" })}
        />
      </Screen>
    );
  }

  const tabRoute = route.name === "wish" ? route.from : route;
  const activeTab = tabRoute.name === "menu" ? tabRoute.tab : tabRoute.name === "community" ? "community" : null;
  return (
    <Screen tabBar={<TabBar active={activeTab} onSelect={openTab} />}>
      {route.name === "home" && (
        <HomeScreen
          handle={me.handle}
          streak={streak}
          onPick={(kind) => setRoute({ name: "flow", kind, key: Date.now() })}
          onCustom={(customText) => setRoute({ name: "flow", kind: "other", customText, key: Date.now() })}
          onAvatar={() => setRoute({ name: "menu", tab: "notif" })}
        />
      )}
      {route.name === "menu" && (
        <MenuScreen me={me} tab={route.tab} onTab={(tab) => setRoute({ name: "menu", tab })} onBack={home} onOpenWish={openWish} onOpenDm={openDm} />
      )}
      {route.name === "community" && <CommunityScreen onBack={home} onOpenWish={openWish} />}
      {route.name === "wish" && <WishScreen key={route.wishId} me={me} wishId={route.wishId} onBack={() => setRoute(route.from)} onMessage={openDm} />}
    </Screen>
  );
}
