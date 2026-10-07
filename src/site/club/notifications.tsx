import { siteUrl } from "@/lib/site-path";
("use client");
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  BellRing,
  CheckCheck,
  MessageCircle,
  CalendarCheck,
  Users,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { clubDb } from "@/lib/club-db";
import "./notifications.css";
type Notice = {
  id: string;
  entry_id: string | null;
  link_path?: string | null;
  kind: string;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
};
const pushUrl =
  "https://pqasdmiqnlyyjwmmqeyc.supabase.co/functions/v1/svoya-push";
function supportsPush() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}
export async function disableDevicePush(userId: string) {
  if (!supportsPush()) return;
  const reg = await navigator.serviceWorker.getRegistration(siteUrl("/"));
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  const result = await clubDb()
    .from("svoya_push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", sub.endpoint);
  if (result.error) throw result.error;
  await sub.unsubscribe();
}
export function NotificationCenter({
  userId,
  onOpen,
  onLogin,
}: {
  userId?: string;
  onOpen: (entryId: string | null, linkPath?: string | null) => void;
  onLogin: () => void;
}) {
  const [open, setOpen] = useState(false),
    [filter, setFilter] = useState("all"),
    [rows, setRows] = useState<Notice[]>([]),
    [count, setCount] = useState(0),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [device, setDevice] = useState<
      "off" | "on" | "blocked" | "unsupported" | "ios"
    >("off");
  const lastSeen = useRef<string | null>(null);
  const generation = useRef(0);
  const loadLock = useRef(false);
  const db = clubDb();
  const checkDevice = useCallback(async () => {
    const ios =
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (ios && !window.matchMedia("(display-mode: standalone)").matches) {
      setDevice("ios");
      return;
    }
    if (!supportsPush()) {
      setDevice("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setDevice("blocked");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration(siteUrl("/"));
      const sub = await reg?.pushManager.getSubscription();
      if (!sub || !userId) {
        setDevice("off");
        return;
      }
      const r = await db
        .from("svoya_push_subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("endpoint", sub.endpoint)
        .maybeSingle();
      setDevice(r.data ? "on" : "off");
    } catch {
      setDevice("off");
    }
  }, [userId, db]);
  const load = useCallback(async () => {
    if (!userId || loadLock.current) return;
    loadLock.current = true;
    const g = generation.current;
    setLoading(true);
    try {
      const [list, unread] = await Promise.all([
        db
          .from("svoya_notifications")
          .select("id,entry_id,kind,title,body,created_at,read_at,link_path")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100),
        db
          .from("svoya_notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("read_at", null),
      ]);
      if (list.error || unread.error) throw list.error ?? unread.error;
      if (g !== generation.current) return;
      const data = list.data ?? [];
      setRows(data);
      setCount(unread.count ?? 0);
      setError("");
      const newest = data[0]?.created_at;
      if (
        lastSeen.current &&
        newest &&
        newest > lastSeen.current &&
        document.visibilityState === "visible" &&
        data[0].read_at === null
      )
        toast.info(data[0].title, { description: data[0].body });
      if (newest) lastSeen.current = newest;
    } catch {
      if (g === generation.current) setError("Не вдалося оновити сповіщення.");
    } finally {
      loadLock.current = false;
      if (g === generation.current) setLoading(false);
    }
  }, [db, userId]);
  useEffect(() => {
    generation.current++;
    lastSeen.current = null;
    setRows([]);
    setCount(0);
    setError("");
    void load();
    void checkDevice();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 20000);
    const visible = () => {
      if (document.visibilityState === "visible") {
        void load();
        void checkDevice();
      }
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      generation.current++;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load, checkDevice]);
  useEffect(() => {
    if (open) {
      void load();
      void checkDevice();
    }
  }, [open, load, checkDevice]);
  useEffect(() => {
    if (!userId) return;
    const id = new URLSearchParams(location.search).get("notification");
    if (id && /^[0-9a-f-]{36}$/.test(id)) {
      void db
        .from("svoya_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId)
        .then(() => void load());
    }
  }, [db, userId, load]);
  async function mark(id?: string) {
    if (!userId) return;
    const cutoff = new Date().toISOString();
    let q = db
      .from("svoya_notifications")
      .update({ read_at: cutoff })
      .eq("user_id", userId)
      .is("read_at", null);
    q = id ? q.eq("id", id) : q.lte("created_at", cutoff);
    const r = await q;
    if (r.error) {
      toast.error("Не вдалося позначити прочитаним.");
      return;
    }
    await load();
  }
  async function enable() {
    if (!userId || busy) return;
    setBusy(true);
    try {
      if (!supportsPush())
        throw new Error(
          "Цей браузер не підтримує push. Сповіщення залишаються доступними у клубі.",
        );
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setDevice(permission === "denied" ? "blocked" : "off");
        return;
      }
      const config = await fetch(pushUrl);
      if (!config.ok)
        throw new Error("Не вдалося підключити сповіщення. Спробуй пізніше.");
      const parsed = (await config.json()) as { publicKey?: unknown };
      if (typeof parsed.publicKey !== "string")
        throw new Error("Сервіс сповіщень тимчасово недоступний.");
      const publicKey = parsed.publicKey;
      const registration = await navigator.serviceWorker.register(
        siteUrl("/svoya-sw.js"),
        { scope: siteUrl("/") },
      );
      await navigator.serviceWorker.ready;
      let sub = await registration.pushManager.getSubscription();
      if (sub) {
        const current = await db
          .from("svoya_push_subscriptions")
          .select("id")
          .eq("user_id", userId)
          .eq("endpoint", sub.endpoint)
          .maybeSingle();
        if (current.error) throw current.error;
        if (current.data) {
          setDevice("on");
          return;
        }
        await sub.unsubscribe();
      }
      const base64 = publicKey.replace(/-/g, "+").replace(/_/g, "/");
      const key = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
      const value = sub.toJSON();
      const saved = await db.from("svoya_push_subscriptions").insert({
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: value.keys?.p256dh,
        auth: value.keys?.auth,
      });
      if (saved.error) {
        await sub.unsubscribe();
        throw saved.error;
      }
      setDevice("on");
      toast.success("Сповіщення на цьому пристрої увімкнено.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Не вдалося увімкнути сповіщення.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    if (!userId) return;
    setBusy(true);
    try {
      await disableDevicePush(userId);
      setDevice("off");
      toast.success("Push на цьому пристрої вимкнено.");
    } catch {
      toast.error("Не вдалося вимкнути push. Спробуй ще раз.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="sv-bell"
        aria-label={`Сповіщення${count ? `, непрочитаних: ${count}` : ""}`}
        onClick={() => setOpen(true)}
      >
        <Bell size={20} />
        {count > 0 && <span>{count > 99 ? "99+" : count}</span>}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sv-notifications">
          <SheetHeader>
            <SheetTitle>
              Твої сповіщення <span>{count > 0 ? count : ""}</span>
            </SheetTitle>
            <SheetDescription>
              Заявки, підтвердження та новини твоїх кіл.
            </SheetDescription>
          </SheetHeader>
          {!userId ? (
            <div className="sv-notification-empty">
              <Bell size={32} />
              <h3>Тут будуть новини для тебе.</h3>
              <p>Увійди або створи профіль, щоб бачити свої сповіщення.</p>
              <button
                className="sv-btn"
                onClick={() => {
                  setOpen(false);
                  onLogin();
                }}
              >
                До профілю
              </button>
            </div>
          ) : (
            <>
              <div className="sv-push-setting">
                <Smartphone size={23} />
                <div>
                  <strong>
                    {device === "on"
                      ? "Push увімкнені"
                      : "Не пропускай свої зустрічі"}
                  </strong>
                  <p>
                    {device === "on"
                      ? "На цьому пристрої — навіть коли сайт закритий."
                      : device === "blocked"
                        ? "Дозволь сповіщення у налаштуваннях браузера для цього сайту."
                        : device === "ios"
                          ? "На iPhone відкрий сайт у Safari, додай на початковий екран і ввімкни push у встановленому клубі."
                          : device === "unsupported"
                            ? "У цьому браузері push недоступні. Усі сповіщення зберігаються тут."
                            : "Отримуй push на цей пристрій. Без тексту приватних розмов на екрані блокування."}
                  </p>
                  {device === "on" ? (
                    <button disabled={busy} onClick={() => void disable()}>
                      Вимкнути на пристрої
                    </button>
                  ) : device === "off" ? (
                    <button
                      disabled={busy}
                      className="sv-btn"
                      onClick={() => void enable()}
                    >
                      {busy ? "Підключаємо…" : "Увімкнути push"}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="sv-notification-toolbar">
                <Tabs value={filter} onValueChange={setFilter}>
                  <TabsList variant="line">
                    <TabsTrigger value="all">Усі</TabsTrigger>
                    <TabsTrigger value="unread">Непрочитані</TabsTrigger>
                  </TabsList>
                </Tabs>
                <button
                  aria-label="Оновити сповіщення"
                  disabled={loading}
                  onClick={() => void load()}
                >
                  <RefreshCw size={17} />
                </button>
                <button
                  title="Прочитати всі"
                  aria-label="Позначити всі прочитаними"
                  disabled={!count}
                  onClick={() => void mark()}
                >
                  <CheckCheck size={20} />
                </button>
              </div>
              {error && (
                <p className="sv-notification-error" role="alert">
                  {error}
                </p>
              )}
              <div className="sv-notification-list">
                {loading && !rows.length ? (
                  <p className="sv-notification-empty">Завантажуємо…</p>
                ) : rows.filter((r) => filter === "all" || !r.read_at)
                    .length === 0 ? (
                  <div className="sv-notification-empty">
                    <BellRing size={30} />
                    <h3>
                      {filter === "unread" ? "Усе прочитано." : "Поки що тихо."}
                    </h3>
                    <p>
                      Нові заявки, відповіді та повідомлення з’являтимуться тут.
                    </p>
                  </div>
                ) : (
                  rows
                    .filter((r) => filter === "all" || !r.read_at)
                    .map((n) => (
                      <button
                        key={n.id}
                        className={`sv-notification-row ${n.read_at ? "" : "unread"}`}
                        onClick={() => {
                          void mark(n.id);
                          setOpen(false);
                          onOpen(n.entry_id, n.link_path);
                        }}
                      >
                        <span className="sv-notification-icon">
                          {n.kind === "chat" ? (
                            <MessageCircle size={19} />
                          ) : n.kind.includes("status") ? (
                            <CalendarCheck size={19} />
                          ) : (
                            <Users size={19} />
                          )}
                        </span>
                        <span>
                          <strong>{n.title}</strong>
                          <p>{n.body}</p>
                          <time dateTime={n.created_at}>
                            {new Intl.DateTimeFormat("uk-UA", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(n.created_at))}
                          </time>
                        </span>
                        {!n.read_at && <i aria-label="Непрочитане" />}
                      </button>
                    ))
                )}
              </div>
              <p className="sv-notification-footer">
                Останні 100 сповіщень. Оновлюються автоматично.
              </p>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
