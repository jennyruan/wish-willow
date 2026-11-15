import { useCallback, useEffect, useState } from "react";
import { BackHandler } from "react-native";
import { Screen, TabBar, type Tab } from "./components/Chrome";
import { useIdentity } from "./identity";
import { CommunityScreen } from "./screens/CommunityScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { JoinScreen } from "./screens/JoinScreen";
import { MenuScreen, type MenuTab } from "./screens/MenuScreen";
import { Splash } from "./screens/Splash";
import { WishFlow } from "./screens/WishFlow";
import { useStreak } from "./streak";
import type { WishKind } from "./wishKinds";

type Route =
  | { name: "home" }
  | { name: "menu"; tab: MenuTab }
  | { name: "community" }
  | { name: "flow"; kind: WishKind; customText?: string; key: number };

export function Root() {
  const { identity, join } = useIdentity();
  const streak = useStreak();
  const [splashDone, setSplashDone] = useState(false);
  const [route, setRoute] = useState<Route>({ name: "home" });
  const finishSplash = useCallback(() => setSplashDone(true), []);
  const home = () => setRoute({ name: "home" });
  const openTab = (tab: Tab) => setRoute(tab === "community" ? { name: "community" } : { name: "menu", tab });

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (route.name === "home") return false;
      setRoute({ name: "home" });
      return true;
    });
    return () => sub.remove();
  }, [route.name]);

  if (!splashDone) return <Splash ready={identity.status !== "loading"} onDone={finishSplash} />;
  if (identity.status !== "ready") {
    return <JoinScreen initialHandle={identity.status === "needsHandle" ? identity.handle : ""} error={identity.status === "needsHandle" ? identity.error : undefined} onJoin={join} />;
  }

  const me = identity.user;
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

  const activeTab = route.name === "menu" ? route.tab : route.name === "community" ? "community" : null;
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
      {route.name === "menu" && <MenuScreen me={me} tab={route.tab} onTab={(tab) => setRoute({ name: "menu", tab })} onBack={home} />}
      {route.name === "community" && <CommunityScreen onBack={home} />}
    </Screen>
  );
}
