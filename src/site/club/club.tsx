import { allPages, entriesByIds, mergeEntries } from "@/lib/club-queries";
import { endClubSession } from "@/lib/club-session";
import { useCatalogue } from "./features/use-catalogue";
import { siteUrl } from "@/lib/site-path";
("use client");
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { User } from "@supabase/supabase-js";
import {
  CalendarDays,
  Users,
  HeartHandshake,
  Sparkles,
  BriefcaseBusiness,
  House,
  MapPin,
  Search,
  Plus,
  UserRound,
  MessageCircle,
  Check,
  LogOut,
  Flag,
  Share2,
  Send,
  Flower2,
  X,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
} from "@/components/ui/sidebar";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { clubDb, needsClubPasswordRecovery, finishClubPasswordRecovery } from "@/lib/club-db";
import { cataloguePhoto } from "@/lib/catalogue-photos";
import {
  labels,
  categories,
  type Kind,
  type Entry,
  type Profile,
  type Membership,
  type ClubRequest,
  type Message,
} from "@/lib/club-types";
import {
  MemberAvatar,
  ProfileGallery,
  ProfileEditor,
  PHOTO_BUCKET,
  newPhotoId,
  type ProfileValues,
  type PhotoDraft,
} from "./profile-photos";
import { NotificationCenter, disableDevicePush } from "./notifications";
import "./club.css";
import Brand from "../brand";
import AuthPanel from "./features/auth-panel";
import People, {
  Preferences,
  BlockList,
  SafetyControls,
} from "./features/people";
import Calendar from "./features/calendar";
import PublicationForm from "./features/publication-form";
import { Benefits, Stories } from "./features/community-content";
import Moderation from "./features/moderation";
import { MemberTitleBadge, MemberTitleGuide } from './features/member-titles';
import { EntryExtras, GreeterSelect } from "./features/entry-extras";
import { action, publicPhoto, messageFor } from "./features/shared";
import "./features/features.css";
type Section =
  | "feed"
  | Kind
  | "profile"
  | "discover"
  | "calendar"
  | "benefits"
  | "stories"
  | "moderation";
const navItems = [
  { id: "feed", label: "Стрічка", icon: House },
  { id: "event", label: "Події", icon: CalendarDays },
  { id: "circle", label: "Свої кола", icon: Users },
  { id: "beauty", label: "Б’юті", icon: Sparkles },
  { id: "business", label: "Бізнес", icon: BriefcaseBusiness },
  { id: "help", label: "Допомога", icon: HeartHandshake },
  { id: "discover", label: "Подруги", icon: Users },
  { id: "calendar", label: "Календар", icon: CalendarDays },
  { id: "benefits", label: "Привілеї", icon: HeartHandshake },
  { id: "stories", label: "Люди та історії", icon: MessageCircle },
] as const;
const introductions: Record<Kind, [string, string]> = {
  event: [
    "Зустрінемося?",
    "Знайди привід вийти з дому й людей, з якими хочеться зустрітися знову.",
  ],
  circle: [
    "Свої люди. Надовго.",
    "Постійні невеликі спільноти, спільні інтереси та наступна зустріч.",
  ],
  beauty: [
    "Час подбати про себе.",
    "Послуги, знайомство з майстринями та особисті заявки на запис.",
  ],
  business: [
    "Свою справу легше разом.",
    "Знайди партнерку, запропонуй послугу або поділися професійним досвідом.",
  ],
  help: [
    "Можна попросити. Можна допомогти.",
    "Рекомендації, підтримка та маленькі добрі справи у твоєму місті.",
  ],
};
const statusText: Record<string, string> = {
  pending: "Очікує підтвердження",
  waitlisted: "У листі очікування",
  joined: "Участь підтверджено",
  rejected: "Відхилено",
  accepted: "Підтверджено",
  closed: "Завершено",
};
const icons = {
  event: CalendarDays,
  circle: Users,
  beauty: Sparkles,
  business: BriefcaseBusiness,
  help: HeartHandshake,
};
function Pick({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="sv-select">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((v) => (
          <SelectItem key={v} value={v}>
            {v}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function dateLabel(v: string | null) {
  return v
    ? new Intl.DateTimeFormat("uk-UA", {
        timeZone: "Europe/Kyiv",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(v))
    : "Дату визначить організаторка";
}
function priceLabel(e: Entry) {
  return e.price > 0
    ? `${e.kind === "beauty" ? "від " : ""}${new Intl.NumberFormat("uk-UA").format(e.price)} ₴`
    : e.kind === "event"
      ? "Без оплати за участь"
      : e.kind === "beauty"
        ? "Ціна за домовленістю"
        : "";
}
function errorLabel(e: unknown) {
  const m =
    e && typeof e === "object" && "message" in e ? String(e.message) : "";
  if (m.includes("SV_PHOTOS_REQUIRED"))
    return "У профілі має бути хоча б одне фото.";
  if (m.includes("SV_PHOTO_INVALID"))
    return "Не вдалося зберегти фото. Спробуй завантажити його ще раз.";
  if (m.includes("SV_FULL")) return "Усі місця вже зайняті.";
  if (m.includes("SV_CLOSED")) return "Цю зустріч уже закрито.";
  if (m.includes("duplicate"))
    return "Така заявка вже існує. Оновіть сторінку.";
  if (m.includes("Invalid login")) return "Перевірте логін або email і пароль.";
  if (m.includes("Email not confirmed"))
    return "Спочатку підтвердьте email у листі.";
  if (m.includes("rate limit"))
    return "Забагато спроб. Спробуйте трохи пізніше.";
  return "Не вдалося виконати дію. Перевірте з’єднання та спробуйте ще раз.";
}
export default function Club() {
  const [section, setSection] = useState<Section>("feed");
  const [city, setCity] = useState("Чернігів");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Усі");
  const [contextEntries, setEntries] = useState<Entry[]>([]);
  const [revision, setRevision] = useState(0);
  const catalogue = useCatalogue(section, city, query, filter, revision);
  const entries = mergeEntries(catalogue.items, contextEntries);
  const [members, setMembers] = useState<Membership[]>([]);
  const [requests, setRequests] = useState<ClubRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState(false);
  const [reports, setReports] = useState<
    { id: string; entry_id: string; reason: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  const generation = useRef(0);
  const [detail, setDetail] = useState<Entry | null>(null);
  const [modal, setModal] = useState<
    "auth" | "create" | "rules" | "report" | null
  >(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    body: string;
    action: () => Promise<void>;
  } | null>(null);
  const [createKind, setCreateKind] = useState<Kind>("event");
  const [createFormat, setCreateFormat] = useState<
    "standard" | "coffee" | "quick"
  >("standard");
  const [needsGreeter, setNeedsGreeter] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [counts, setCounts] = useState<
    Record<string, { joined: number; waiting: number }>
  >({});
  const [viewingProfile, setViewingProfile] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [chatError, setChatError] = useState("");
  const [messageLoading, setMessageLoading] = useState(false);
  const db = clubDb();
  const load = useCallback(async () => {
    const g = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const {
        data: { session },
      } = await db.auth.getSession();
      const u = session?.user ?? null;

      const countsResult = await allPages<{ entry_id: string; joined: number; waiting: number }>((from, to) => db.rpc("svoya_entry_counts").order("entry_id").range(from, to))
        .then(data => ({ data, error: null })).catch(error => ({ data: [], error }));
      if (!countsResult.error && g === generation.current)
        setCounts(
          Object.fromEntries(
            (countsResult.data ?? []).map(
              (r: { entry_id: string; joined: number; waiting: number }) => [
                r.entry_id,
                r,
              ],
            ),
          ),
        );
      let ps: Profile | null = null,
        ms: Membership[] = [],
        rs: ClubRequest[] = [],
        isAdmin = false,
        rps: { id: string; entry_id: string; reason: string }[] = [];
      if (u) {
        const [p, m, r, a] = await Promise.all([
          db.from("svoya_profiles").select("*").eq("id", u.id).maybeSingle(),
          allPages<Membership>((from, to) => db.from("svoya_memberships").select("*").order("entry_id").order("user_id").range(from, to)).then(data => ({ data, error: null })),
          allPages<ClubRequest>((from, to) => db.from("svoya_requests").select("*").order("created_at").order("id").range(from, to)).then(data => ({ data, error: null })),
          db.from("svoya_admins").select("user_id").eq("user_id", u.id),
        ]);
        for (const q of [p, m, r, a]) if (q.error) throw q.error;
        ps = p.data;
        ms = m.data ?? [];
        rs = r.data ?? [];
        isAdmin = !!a.data?.length;
        if (isAdmin) {
          const rr = await db
            .from("svoya_reports")
            .select("id,entry_id,reason")
            .order("created_at", { ascending: false });
          if (rr.error) throw rr.error;
          rps = rr.data ?? [];
        }
      }
      const entryId = new URLSearchParams(location.search).get("entry");
      const [related, owned] = await Promise.all([
        entriesByIds(db, [...ms.map(m => m.entry_id), ...rs.map(r => r.entry_id), ...rps.map(r => r.entry_id), ...(entryId ? [entryId] : [])]),
        u ? allPages<Entry>((from, to) => db.from("svoya_entries").select("*").eq("owner_id", u.id).order("created_at").order("id").range(from, to)) : Promise.resolve([]),
      ]);
      const es = { data: mergeEntries(related, owned) };
      const ids = [
        ...new Set(
          [
            ...(es.data ?? []).map((e: Entry) => e.owner_id),
            ...ms.flatMap((m) => [m.user_id, m.greeter_id]),
            ...rs.map((r) => r.user_id),
            u?.id,
          ].filter(Boolean),
        ),
      ] as string[];
      const people: Profile[] = [];
      if (u) for (let i = 0; i < ids.length; i += 100) {
        const result = await db.from("svoya_profiles").select("*").in("id", ids.slice(i, i + 100));
        if (result.error) throw result.error;
        people.push(...(result.data ?? []));
      }
      if (!mounted.current || g !== generation.current) return;
      setUser(u);
      if (u && needsClubPasswordRecovery(u.id)) {
        setRecovery(true);
        setModal("auth");
      }
      setProfile(ps);
      setMembers(ms);
      setRequests(rs);
      setAdmin(isAdmin);
      setReports(rps);
      setProfiles(
        Object.fromEntries(people.map((p: Profile) => [p.id, p])),
      );
      setEntries(es.data ?? []);
      setRevision(value => value + 1);
      // Do not reopen a dialog that was closed while the request was running.
      if (new URLSearchParams(location.search).get("entry") === entryId)
        setDetail(entryId ? es.data.find(e => e.id === entryId) ?? null : null);
    } catch (e) {
      if (g === generation.current)
        setError("Не вдалося завантажити клуб. Спробуйте оновити.");
    } finally {
      if (mounted.current && g === generation.current) setLoading(false);
    }
  }, [db]);
  useEffect(() => {
    mounted.current = true;
    void load();
    const s = new URLSearchParams(location.search);
    const tab = s.get("section");
    if (
      [
        "feed",
        "event",
        "circle",
        "beauty",
        "business",
        "help",
        "profile",
        "discover",
        "calendar",
        "benefits",
        "stories",
        "moderation",
      ].includes(tab ?? "")
    )
      setSection(tab as Section);
    const stored = localStorage.getItem("svoya-city");
    if (stored) setCity(stored);
    let timer: ReturnType<typeof setTimeout>;
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecovery(true);
        setModal("auth");
      }
      clearTimeout(timer);
      timer = setTimeout(() => void load(), 0);
    });
    return () => {
      mounted.current = false;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [db, load]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const ids = [...new Set(catalogue.items.map(e => e.owner_id).filter(Boolean))] as string[];
      const rows: Profile[] = [];
      for (let i = 0; i < ids.length; i += 100) {
        const result = await db.from("svoya_profiles").select("*").in("id", ids.slice(i, i + 100));
        if (result.error || !active) return;
        rows.push(...(result.data ?? []));
      }
      if (active) setProfiles(old => ({ ...old, ...Object.fromEntries(rows.map(p => [p.id, p])) }));
    })().catch(() => { /* Cards retain their neutral fallback when offline. */ });
    return () => { active = false; };
  }, [db, user?.id, catalogue.items]);

  function go(s: Section) {
    setDetail(null);
    setSection(s);
    setFilter("Усі");
    setQuery("");
    history.replaceState(null, "", siteUrl(`/club?section=${s}`));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function open(e: Entry) {
    setDetail(e);
    setEntries(old => mergeEntries(old, [e]));
    setNeedsGreeter(false);
    history.replaceState(
      null,
      "",
      siteUrl(`/club?section=${section}&entry=${e.id}`),
    );
  }
  function closeDetail() {
    setDetail(null);
    setMessages([]);
    history.replaceState(null, "", siteUrl(`/club?section=${section}`));
  }
  async function run(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(
        String((e as { message?: string })?.message ?? "").includes("SV_")
          ? messageFor(e)
          : errorLabel(e),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function requireProfile() {
    if (profile?.photo_paths?.length) {
      if (profile.membership_status === "approved") return true;
      toast.info(
        profile.membership_status === "suspended"
          ? "Доступ до участі призупинено. Перевір свій профіль."
          : "Твоя анкета очікує на схвалення команди клубу.",
      );
      go("profile");
      return false;
    }
    if (profile) toast.info("Додай обов’язкове фото профілю, щоб долучитися.");

    setModal("auth");
    return false;
  }
  function startCreate(
    kind: Kind,
    format: "standard" | "coffee" | "quick" = "standard",
  ) {
    if (!requireProfile()) return;
    setCreateKind(kind);
    setCreateFormat(format);
    setModal("create");
  }
  async function saveProfile(
    values: ProfileValues,
    photos: PhotoDraft[],
    consent: boolean,
  ) {
    await run(async () => {
      if (!photos.length || photos.length > 10) {
        toast.error("Додай від 1 до 10 фото.");
        return;
      }
      if (!consent && !profile) {
        toast.error("Підтвердь правила спільноти.");
        return;
      }
      const u = user;
      if (!u || (u.is_anonymous && !profile)) {
        toast.info("Спочатку створи постійний акаунт.");
        return;
      }
      const uploaded: string[] = [];
      let saved = false;
      try {
        const paths: string[] = [];
        for (const photo of photos) {
          if (photo.path) {
            paths.push(photo.path);
            continue;
          }
          if (!photo.file) throw new Error("Missing photo");
          const path = `${u.id}/${newPhotoId()}.webp`;
          const r = await db.storage
            .from(PHOTO_BUCKET)
            .upload(path, photo.file, {
              contentType: "image/webp",
              upsert: false,
            });
          if (r.error) throw r.error;
          uploaded.push(path);
          paths.push(path);
        }
        const current = await db
          .from("svoya_profiles")
          .select("id,photo_paths")
          .eq("id", u.id)
          .maybeSingle();
        if (current.error) throw current.error;
        const value = { ...values, photo_paths: paths };
        const r = current.data
          ? await db
              .from("svoya_profiles")
              .update(value)
              .eq("id", u.id)
              .select()
              .single()
          : await db
              .from("svoya_profiles")
              .insert({ id: u.id, ...value })
              .select()
              .single();
        if (r.error) throw r.error;
        saved = true;
        const removed = (current.data?.photo_paths ?? []).filter(
          (p: string) => !paths.includes(p),
        );
        if (removed.length) {
          const cleanup = await db.storage.from(PHOTO_BUCKET).remove(removed);
          if (cleanup.error)
            toast.info(
              "Профіль збережено. Очищення старих файлів буде доступне пізніше.",
            );
        }
        setProfile(r.data);
        setCity(values.city);
        localStorage.setItem("svoya-city", values.city);
        setModal(null);
        toast.success("Профіль і фотографії збережено.");
        await load();
      } catch (e) {
        if (!saved && uploaded.length)
          await db.storage.from(PHOTO_BUCKET).remove(uploaded);
        throw e;
      }
    });
  }
  function editProfile() {
    setModal("auth");
  }
  function showMember(id: string) {
    const p = profiles[id];
    if (p) setViewingProfile(p);
  }
  async function join(e: Entry) {
    if (!requireProfile()) return;
    await run(async () => {
      const result = await action("join", {
        entry_id: e.id,
        needs_greeter: needsGreeter,
      });
      toast.success(
        result.status === "waitlisted"
          ? "Ти у листі очікування. Повідомимо, коли звільниться місце."
          : "Заявку надіслано організаторці.",
      );
      await load();
    });
  }
  async function respond(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    if (!detail || !requireProfile()) return;
    await run(async () => {
      const r = await db
        .from("svoya_requests")
        .insert({
          entry_id: detail.id,
          user_id: profile!.id,
          message: String(f.get("message")).trim(),
          contact: String(f.get("contact")).trim(),
        })
        .select()
        .single();
      if (r.error) throw r.error;
      toast.success("Заявку надіслано. Статус доступний у профілі.");
      await load();
    });
  }
  async function updateMember(m: Membership, status: string) {
    await run(async () => {
      const r = await db
        .from("svoya_memberships")
        .update({ status })
        .eq("entry_id", m.entry_id)
        .eq("user_id", m.user_id)
        .select()
        .single();
      if (r.error) throw r.error;
      await load();
      toast.success("Статус участі оновлено.");
    });
  }
  async function updateRequest(r: ClubRequest, status: string) {
    await run(async () => {
      const result = await db
        .from("svoya_requests")
        .update({ status })
        .eq("id", r.id)
        .select()
        .single();
      if (result.error) throw result.error;
      await load();
      toast.success("Статус заявки оновлено.");
    });
  }
  function leave(e: Entry) {
    setConfirm({
      title: "Скасувати участь?",
      body: "Організаторка побачить, що ви більше не берете участь. Доступ до чату буде закрито.",
      action: async () => {
        const r = await db
          .from("svoya_memberships")
          .delete()
          .eq("entry_id", e.id)
          .eq("user_id", profile!.id)
          .select();
        if (r.error) throw r.error;
        await load();
        toast.success("Участь скасовано.");
      },
    });
  }
  function archive(e: Entry) {
    setConfirm({
      title: "Приховати публікацію?",
      body: "Вона зникне зі стрічки. Нові заявки й повідомлення прийматися не будуть.",
      action: async () => {
        const r = await db
          .from("svoya_entries")
          .update({ status: "archived" })
          .eq("id", e.id)
          .select()
          .single();
        if (r.error) throw r.error;
        closeDetail();
        await load();
        toast.success("Публікацію приховано.");
      },
    });
  }
  const activeMembership = detail
    ? members.find((m) => m.entry_id === detail.id && m.user_id === user?.id)
    : undefined;
  const isOwner = !!(detail && profile && detail.owner_id === profile.id);
  const canChat =
    !!detail &&
    !detail.is_demo &&
    profile?.membership_status === "approved" &&
    ["event", "circle"].includes(detail.kind) &&
    (isOwner || activeMembership?.status === "joined");
  const detailId = detail?.id;
  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setChatError("");
    if (!detailId || !canChat) return;
    async function fetchChat() {
      if (document.visibilityState === "hidden") return;
      setMessageLoading(true);
      const r = await db
        .from("svoya_messages")
        .select("*")
        .eq("entry_id", detailId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (r.error) setChatError("Не вдалося завантажити повідомлення.");
      else {
        setMessages((r.data ?? []).reverse());
        setChatError("");
        const ids = [...new Set((r.data ?? []).map((m: Message) => m.user_id))];
        if (ids.length) {
          const p = await db.from("svoya_profiles").select("*").in("id", ids);
          if (!cancelled && p.data)
            setProfiles((old) => ({
              ...old,
              ...Object.fromEntries(p.data.map((x: Profile) => [x.id, x])),
            }));
        }
      }
      if (!cancelled) setMessageLoading(false);
    }
    void fetchChat();
    const timer = setInterval(() => void fetchChat(), 10000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [detailId, canChat, db]);
  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!detail || !profile || !message.trim()) return;
    await run(async () => {
      const r = await db
        .from("svoya_messages")
        .insert({
          entry_id: detail.id,
          user_id: profile.id,
          body: message.trim(),
        })
        .select()
        .single();
      if (r.error) throw r.error;
      setMessages((old) => [...old, r.data]);
      setMessage("");
    });
  }
  async function report(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!detail || !profile) return;
    await run(async () => {
      const r = await db
        .from("svoya_reports")
        .insert({
          entry_id: detail.id,
          user_id: profile.id,
          reason: String(f.get("reason")).trim(),
        })
        .select()
        .single();
      if (r.error) throw r.error;
      setModal(null);
      toast.success("Скаргу збережено для розгляду командою клубу.");
    });
  }
  const isCatalogue =
    section === "feed" || Object.keys(labels).includes(section);
  const currentEntries = catalogue.items.filter(
    (e) =>
      e.status === "published" &&
      (!e.expires_at || Date.parse(e.expires_at) > Date.now()) &&
      (city === "Усі міста" || e.city === city) &&
      (e.kind !== "event" ||
        e.is_demo ||
        !e.starts_at ||
        new Date(e.starts_at).getTime() > Date.now()) &&
      (section === "feed" || section === "profile" || e.kind === section) &&
      (!query ||
        `${e.title} ${e.description} ${e.category}`
          .toLocaleLowerCase("uk")
          .includes(query.toLocaleLowerCase("uk"))) &&
      (filter === "Усі" ||
        (section === "feed"
          ? labels[e.kind] === filter
          : e.category === filter)),
  );
  const real = currentEntries.filter((e) => !e.is_demo);
  const demos = currentEntries.filter((e) => e.is_demo);
  const mine = members.filter((m) => m.user_id === user?.id);
  const ownEntries = entries.filter((e) => e.owner_id === user?.id);
  const incomingRequests = requests.filter(
    (r) => entries.find((e) => e.id === r.entry_id)?.owner_id === user?.id,
  );
  const pendingCount =
    members.filter(
      (m) =>
        m.status === "pending" &&
        entries.find((e) => e.id === m.entry_id)?.owner_id === user?.id,
    ).length + incomingRequests.filter((r) => r.status === "pending").length;
  function Card({ entry: e }: { entry: Entry }) {
    const photo = e.image_paths?.[0]
      ? { src: publicPhoto(e.image_paths[0]), alt: e.title }
      : cataloguePhoto(e);
    const Icon = icons[e.kind];
    const m = members.find(
      (m) => m.entry_id === e.id && m.user_id === user?.id,
    );
    return (
      <article className={`sv-card sv-card-${e.kind}`}>
        <button
          className={`sv-card-art sv-art-${e.category === "Прогулянки" ? "walk" : e.category === "Творчість" ? "art" : e.kind}`}
          onClick={() => open(e)}
          aria-label={`Відкрити: ${e.title}`}
        >
          <img
            src={photo.src}
            alt={photo.alt}
            loading="lazy"
            decoding="async"
            width={212}
            height={224}
          />
          <span className="sv-art-tag">
            {e.is_demo
              ? "Приклад"
              : e.format === "coffee"
                ? "Кава на чотирьох"
                : e.format === "quick"
                  ? "Маю годину"
                  : labels[e.kind]}
          </span>
        </button>
        <div className="sv-card-body">
          <div className="sv-meta">
            <MapPin size={14} />
            {e.city}
            {e.is_demo ? (
              <span>Для натхнення</span>
            ) : (
              <span>{priceLabel(e)}</span>
            )}
          </div>
          <button className="sv-title-button" onClick={() => open(e)}>
            <h3>{e.title}</h3>
          </button>
          <p>{e.description}</p>
          {!e.is_demo && (
            <div className="sv-card-facts">
              {e.kind === "event" && (
                <span>
                  {counts[e.id]?.joined ?? 0} / {e.capacity} місць підтверджено
                  {e.welcome_newcomers ? " · раді новеньким" : ""}
                </span>
              )}
              {e.kind === "circle" && (
                <span>
                  {e.recurrence_note || "Постійне коло та спільний чат"}
                </span>
              )}
              {e.kind === "beauty" && (
                <span>
                  {e.category} · {e.location || e.city}
                </span>
              )}
            </div>
          )}
          <div className="sv-card-bottom">
            <span>
              {e.kind === "event" ? (
                <>
                  <CalendarDays size={15} />
                  {e.is_demo ? "Створи таку зустріч" : dateLabel(e.starts_at)}
                </>
              ) : (
                <>
                  <Icon size={15} />
                  {e.owner_id
                    ? (profiles[e.owner_id]?.name ?? "Учасниця клубу")
                    : "Твоє майбутнє коло"}
                </>
              )}
            </span>
            <button className="sv-small-button" onClick={() => open(e)}>
              {m ? statusText[m.status] : "Деталі"}
            </button>
          </div>
        </div>
      </article>
    );
  }
  function Empty({ text, kind }: { text: string; kind: Kind }) {
    const Icon = icons[kind];
    return (
      <div className="sv-empty">
        <Icon size={32} />
        <h3>{text}</h3>
        <p>Тут з’являтимуться пропозиції учасниць. Можна почати зі своєї.</p>
        <button className="sv-btn" onClick={() => startCreate(kind)}>
          <Plus size={17} />
          Створити{" "}
          {kind === "event"
            ? "зустріч"
            : kind === "circle"
              ? "коло"
              : "публікацію"}
        </button>
      </div>
    );
  }
  return (
    <SidebarProvider
      className="sv-club"
      style={{ "--sidebar-width": "216px" } as React.CSSProperties}
    >
      <Sidebar className="sv-sidebar" collapsible="none">
        <SidebarHeader>
          <Brand className="sv-sidebar-brand" inverse />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <p className="sv-nav-caption">ТВОЄ МІСЦЕ</p>
            <SidebarMenu>
              {navItems.map((n) => (
                <SidebarMenuItem key={n.id}>
                  <SidebarMenuButton
                    className="sv-nav-button"
                    isActive={section === n.id}
                    onClick={() => go(n.id)}
                  >
                    <n.icon />
                    <span>{n.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
          <div className="sv-sidebar-note">
            <Flower2 size={24} />
            <h3>Можна прийти самій.</h3>
            <p>Своє коло починається з одного знайомства.</p>
            <button onClick={() => startCreate("event")}>
              Запропонувати зустріч
            </button>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <button className="sv-rule-link" onClick={() => setModal("rules")}>
            <ShieldCheck size={17} />
            Правила спільноти
          </button>
          <button
            className={`sv-account ${section === "profile" ? "active" : ""}`}
            onClick={() => go("profile")}
          >
            <MemberAvatar profile={profile} />
            <span>
              {profile?.name ?? "Твій профіль"}
              <small>
                {profile ? "Мої зустрічі та заявки" : "Познайомимося?"}
              </small>
            </span>
            {pendingCount > 0 && <b>{pendingCount}</b>}
          </button>
        </SidebarFooter>
      </Sidebar>
      <div className="sv-main">
        <div className="sv-topbar">
          <Brand className="sv-mobile-brand" />
          <div className="sv-location">
            <MapPin size={17} />
            <Pick
              label="Місто клубу"
              value={city}
              onChange={(v) => {
                setCity(v);
                localStorage.setItem("svoya-city", v);
              }}
              options={[
                ...new Set([
                  "Чернігів",
                  "Київ",
                  "Львів",
                  "Одеса",
                  "Дніпро",
                  "Харків",
                  "Усі міста",
                  ...entries.map((e) => e.city),
                  city,
                ]),
              ]}
            />
          </div>
          <span className="sv-top-tag">ЖІНОЧИЙ КЛУБ · СВОЯ</span>
          <NotificationCenter
            userId={user?.id}
            onLogin={editProfile}
            onOpen={(id, link) => {
              if (link?.includes("section=discover")) {
                go("discover");
                setRevision(value => value + 1);
                return;
              }
              if (id) {
                history.replaceState(null, "", siteUrl(`/club?section=${section}&entry=${encodeURIComponent(id)}`));
                void load();
              } else {
                go("profile");
                void load();
              }
            }}
          />
          <button
            className="sv-top-profile"
            onClick={() => (profile ? go("profile") : setModal("auth"))}
          >
            {profile?.name ?? "Приєднатися"}
            <MemberAvatar profile={profile} />
          </button>
        </div>
        <main className="sv-content">
          <nav className="sv-feature-nav" aria-label="Можливості клубу">
            {[
              { id: "discover", label: "Подруги" },
              { id: "calendar", label: "Календар" },
              { id: "benefits", label: "Привілеї" },
              { id: "stories", label: "Люди та історії" },
              ...(admin ? [{ id: "moderation", label: "Модерація" }] : []),
            ].map((n) => (
              <button
                key={n.id}
                aria-current={section === n.id ? "page" : undefined}
                onClick={() => go(n.id as Section)}
              >
                {n.label}
              </button>
            ))}
          </nav>
          {section === "discover" && (
            <People
              refreshKey={revision}
              profile={profile}
              onLogin={editProfile}
              onChange={() => void load()}
            />
          )}
          {section === "calendar" && (
            <Calendar
              entries={mergeEntries(catalogue.items, contextEntries).filter(
                (e) => city === "Усі міста" || e.city === city,
              )}
              members={members}
              profile={profile}
              onOpen={open}
            />
          )}
          {section === "calendar" && <div className="sv-inline-actions">
            {catalogue.loading && <p role="status">Завантажуємо зустрічі…</p>}
            {catalogue.error && <button className="sv-outline" onClick={catalogue.retry}>Повторити завантаження</button>}
            {catalogue.more && <button className="sv-outline" disabled={catalogue.loading} onClick={catalogue.next}>Показати більше зустрічей</button>}
          </div>}
          {section === "benefits" && (
            <Benefits profile={profile} onLogin={editProfile} city={city} />
          )}
          {section === "stories" && (
            <Stories
              profile={profile}
              entries={entries}
              members={members}
              onLogin={editProfile}
              city={city}
            />
          )}
          {section === "moderation" &&
            (admin ? (
              <Moderation onChange={() => void load()} />
            ) : (
              <p className="sv-notice">
                Кабінет доступний команді клубу після входу.
              </p>
            ))}
          {section === "feed" ? (
            <>
              <div className="sv-page-heading">
                <div>
                  <p className="sv-overline">
                    ЖІНОЧИЙ КЛУБ · ЗНАЙОМСТВА ТА ПІДТРИМКА
                  </p>
                  <h1>
                    {profile
                      ? `${profile.name}, рада бачити.`
                      : "Тут починається твоє коло."}
                  </h1>
                  <p>
                    Знайомся з жінками у своєму місті. Домовляйся про зустрічі,
                    знаходь подруг і підтримку.
                  </p>
                </div>
                <button className="sv-btn" onClick={() => startCreate("event")}>
                  <Plus size={17} />
                  Створити
                </button>
              </div>
              <section className="sv-welcome">
                <img
                  src={siteUrl("/svoya-coffee-v2.png")}
                  alt="Жінки розмовляють у кав’ярні"
                />
                <div>
                  <span className="sv-overline">МОЖНА ПРИЙТИ САМІЙ</span>
                  <h2>
                    Почнемо з <em>«привіт»?</em>
                  </h2>
                </div>
                <button className="sv-outline" onClick={() => go("event")}>
                  Обрати зустріч
                </button>
              </section>
              <div className="sv-plan-shortcuts">
                <button onClick={() => startCreate("event", "coffee")}>
                  <span>01 / МАЛЕНЬКЕ КОЛО</span>
                  <strong>Кава на чотирьох</strong>
                  <small>4–6 жінок, одна розмова, нові знайомства ↗</small>
                </button>
                <button onClick={() => startCreate("event", "quick")}>
                  <span>02 / СПОНТАННИЙ ПЛАН</span>
                  <strong>Маю годину сьогодні</strong>
                  <small>Кава або прогулянка в найближчі 24 години ↗</small>
                </button>
              </div>
              <div className="sv-shortcuts">
                {navItems.slice(1, 6).map((n) => (
                  <button key={n.id} onClick={() => go(n.id)}>
                    <n.icon size={22} />
                    <span>{n.label}</span>
                    <small>
                      {n.id === "event"
                        ? "Плани для себе"
                        : n.id === "circle"
                          ? "Люди за інтересами"
                          : n.id === "beauty"
                            ? "Турбота про себе"
                            : n.id === "business"
                              ? "Зростаємо разом"
                              : "Підтримка поруч"}
                    </small>
                  </button>
                ))}
              </div>
            </>
          ) : section !== "profile" && isCatalogue ? (
            <div className="sv-page-heading">
              <div>
                <p className="sv-overline">{labels[section as Kind]}</p>
                <h1>{introductions[section as Kind][0]}</h1>
                <p>{introductions[section as Kind][1]}</p>
              </div>
              <button
                className="sv-btn"
                onClick={() => startCreate(section as Kind)}
              >
                <Plus size={17} />
                {section === "event"
                  ? "Створити подію"
                  : section === "circle"
                    ? "Створити коло"
                    : "Додати пропозицію"}
              </button>
            </div>
          ) : section === "profile" ? (
            <div className="sv-page-heading">
              <div>
                <p className="sv-overline">ОСОБИСТИЙ ПРОСТІР</p>
                <h1>Моя «СВОЯ».</h1>
                <p>Профіль, спільні плани та твої заявки.</p>
              </div>
              <button
                className="sv-outline"
                onClick={() => void load()}
                disabled={loading}
              >
                <RefreshCw size={17} />
                Оновити
              </button>
            </div>
          ) : null}
          {error && (
            <div className="sv-error" role="alert">
              {error}
              <button onClick={() => void load()}>Повторити</button>
            </div>
          )}
          {isCatalogue && (
            <>
              <div className="sv-section-bar">
                <h2>
                  {section === "feed"
                    ? "Життя клубу"
                    : section === "circle"
                      ? "Знайди своїх"
                      : section === "event"
                        ? "Найближчі зустрічі"
                        : "Пропозиції спільноти"}
                </h2>
                <label className="sv-search">
                  <Search size={18} />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Пошук у клубі"
                    aria-label="Пошук у клубі"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      aria-label="Очистити пошук"
                    >
                      <X size={16} />
                    </button>
                  )}
                </label>
              </div>
              <Tabs
                value={filter}
                onValueChange={setFilter}
                className="sv-filter"
              >
                <TabsList aria-label="Категорії" variant="line">
                  {[
                    "Усі",
                    ...(section === "feed"
                      ? Object.values(labels)
                      : categories[section as Kind]),
                  ].map((v) => (
                    <TabsTrigger value={v} key={v}>
                      {v}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              {(loading || catalogue.loading) && !catalogue.items.length ? (
                <div className="sv-loading" role="status">
                  Завантажуємо життя клубу…
                </div>
              ) : (
                <>
                  {catalogue.error && <div className="sv-error" role="alert">Не вдалося завантажити публікації. <button onClick={catalogue.retry}>Повторити</button></div>}
                  {real.length > 0 && (
                    <div className="sv-grid">
                      {real.map((e) => (
                        <Card key={e.id} entry={e} />
                      ))}
                    </div>
                  )}
                  {!real.length && !error && !catalogue.error && (
                    <div className="sv-launch-note">
                      <Flower2 size={22} />
                      <div>
                        <strong>
                          {query || filter !== "Усі"
                            ? "За цим запитом публікацій поки немає."
                            : "Ми збираємо перше коло."}
                        </strong>
                        <p>
                          {query
                            ? "Спробуй інший запит або категорію."
                            : "Реальні події та пропозиції з’являться тут після публікації учасницями."}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          startCreate(
                            section === "feed" ? "event" : (section as Kind),
                          )
                        }
                      >
                        Додати свою
                      </button>
                    </div>
                  )}
                  {demos.length > 0 && (
                    <>
                      <div className="sv-example-heading">
                        <h2>З чого можна почати</h2>
                        <span>Приклади форматів — запис ще не відкрито</span>
                      </div>
                      <div className="sv-grid">
                        {demos.map((e) => (
                          <Card key={e.id} entry={e} />
                        ))}
                      </div>
                    </>
                  )}
                  {catalogue.more && <button className="sv-outline" disabled={catalogue.loading} onClick={catalogue.next}>{catalogue.loading ? "Завантажуємо…" : "Показати більше"}</button>}
                  {!currentEntries.length && !error && !catalogue.error && (
                    <Empty
                      kind={section === "feed" ? "event" : (section as Kind)}
                      text={
                        section === "beauty"
                          ? "Познайомимо клуб із твоєю майстерністю?"
                          : section === "business"
                            ? "Розкажи про свою справу."
                            : section === "help"
                              ? "Підтримка починається із запиту."
                              : "Стань першою у своєму місті."
                      }
                    />
                  )}
                </>
              )}
              {section === "beauty" && (
                <div className="sv-info-box">
                  <ShieldCheck size={24} />
                  <p>
                    Кожну послугу публікує її авторка. Профілі не мають
                    автоматичної позначки перевірки. Деталі, ціну та час візиту
                    погоджуйте до підтвердження заявки.
                  </p>
                </div>
              )}
            </>
          )}
          {section === "profile" && user && (
            <div className="sv-feature-stack">
              <AuthPanel user={user} onComplete={() => void load()} />
              {profile && (
                <>
                  <p
                    className={`sv-notice sv-status-${profile.membership_status}`}
                  >
                    {profile.membership_status === "approved"
                      ? "Анкету схвалено. Рада бачити тебе у клубі."
                      : profile.membership_status === "suspended"
                        ? "Доступ до участі призупинено командою клубу. Можна переглянути профіль та свої заявки."
                        : "Дякуємо за знайомство! Анкета на перевірці. Після схвалення можна створювати події, долучатися та знайомитися."}
                  </p>
                  <Preferences
                    key={profile.id}
                    profile={profile}
                    onChange={() => void load()}
                  />
                  <BlockList me={profile.id} onChange={() => void load()} />
                </>
              )}
            </div>
          )}
          {section === "profile" &&
            (!profile ? (
              <div className="sv-profile-invite">
                <Users size={42} />
                <h2>Розкажи трохи про себе.</h2>
                <p>
                  Збережи свої зустрічі, приєднуйся до кіл і спілкуйся з
                  учасницями.
                </p>
                <button className="sv-btn" onClick={() => setModal("auth")}>
                  Створити профіль
                </button>
              </div>
            ) : (
              <>
                <div className="sv-profile-card">
                  <MemberAvatar profile={profile} large />
                  <div>
                    <h2>{profile.name}</h2>
                    <MemberTitleBadge profile={profile} />
                    <p>
                      <MapPin size={15} />
                      {profile.city}
                    </p>
                    <p>
                      {profile.bio || "Тут може бути кілька слів про тебе."}
                    </p>
                    <div className="sv-tags">
                      {profile.interests.map((x) => (
                        <span key={x}>{x}</span>
                      ))}
                    </div>
                  </div>
                  <button className="sv-outline" onClick={editProfile}>
                    Редагувати
                  </button>
                </div>
                <ProfileGallery profile={profile} onEdit={editProfile} />
                <MemberTitleGuide profile={profile} />
                {user?.is_anonymous && (
                  <div className="sv-info-box">
                    <UserRound size={22} />
                    <p>
                      Ти користуєшся швидким профілем. Дані збережені у клубі,
                      але доступ прив’язаний до цього браузера: після очищення
                      даних або виходу відновити його не вдасться.
                    </p>
                  </div>
                )}
                <Tabs defaultValue="plans" className="sv-profile-tabs">
                  <TabsList variant="line">
                    <TabsTrigger value="plans">Мої плани</TabsTrigger>
                    <TabsTrigger value="publications">Публікації</TabsTrigger>
                    <TabsTrigger value="requests">
                      Заявки {pendingCount > 0 ? `(${pendingCount})` : ""}
                    </TabsTrigger>
                    {admin && <TabsTrigger value="reports">Скарги</TabsTrigger>}
                  </TabsList>
                  <TabsContent value="plans">
                    <div className="sv-list">
                      {mine.length === 0 ? (
                        <Empty
                          kind="event"
                          text="Твої перші зустрічі ще попереду."
                        />
                      ) : (
                        mine.map((m) => {
                          const e = entries.find((e) => e.id === m.entry_id);
                          return (
                            <button
                              className="sv-list-row"
                              key={m.entry_id}
                              disabled={!e}
                              onClick={() => e && open(e)}
                            >
                              <CalendarDays />
                              <span>
                                <strong>
                                  {e?.title ?? "Публікацію приховано"}
                                </strong>
                                <small>
                                  {e?.kind === "event"
                                    ? dateLabel(e.starts_at)
                                    : "Постійне коло"}
                                </small>
                              </span>
                              <b className={`sv-status ${m.status}`}>
                                {statusText[m.status]}
                              </b>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="publications">
                    <div className="sv-list">
                      {ownEntries.length ? (
                        ownEntries.map((e) => (
                          <button
                            key={e.id}
                            className="sv-list-row"
                            onClick={() => open(e)}
                          >
                            <Plus />
                            <span>
                              <strong>{e.title}</strong>
                              <small>
                                {labels[e.kind]} ·{" "}
                                {e.status === "archived" ? "Приховано" : e.city}
                              </small>
                            </span>
                            <b>
                              {members.filter(
                                (m) =>
                                  m.entry_id === e.id && m.status === "pending",
                              ).length +
                                requests.filter(
                                  (r) =>
                                    r.entry_id === e.id &&
                                    r.status === "pending",
                                ).length}{" "}
                              нових заявок
                            </b>
                          </button>
                        ))
                      ) : (
                        <Empty kind="event" text="Запропонуй те, що любиш." />
                      )}
                    </div>
                  </TabsContent>
                  <TabsContent value="requests">
                    <h3 className="sv-subheading">Вхідні заявки на участь</h3>
                    {members.filter(
                      (m) =>
                        entries.find((e) => e.id === m.entry_id)?.owner_id ===
                        profile.id,
                    ).length === 0 && (
                      <p className="sv-muted">
                        Поки немає заявок на твої зустрічі та кола.
                      </p>
                    )}
                    {members
                      .filter(
                        (m) =>
                          entries.find((e) => e.id === m.entry_id)?.owner_id ===
                          profile.id,
                      )
                      .map((m) => (
                        <div
                          className="sv-request"
                          key={m.entry_id + m.user_id}
                        >
                          <button
                            className="sv-person-link"
                            onClick={() => showMember(m.user_id)}
                          >
                            <MemberAvatar profile={profiles[m.user_id]} />
                            <strong>
                              {profiles[m.user_id]?.name ?? "Учасниця"}
                            </strong>
                          </button>
                          <p>
                            {entries.find((e) => e.id === m.entry_id)?.title}
                          </p>
                          <p>{statusText[m.status]}</p>
                          {m.status === "pending" && (
                            <div className="sv-actions">
                              <button
                                className="sv-btn"
                                disabled={busy}
                                onClick={() => void updateMember(m, "joined")}
                              >
                                Підтвердити
                              </button>
                              <button
                                className="sv-outline"
                                disabled={busy}
                                onClick={() => void updateMember(m, "rejected")}
                              >
                                Відхилити
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    <h3 className="sv-subheading">Б’юті, бізнес і допомога</h3>
                    {requests.length === 0 && (
                      <p className="sv-muted">
                        Надіслані й отримані звернення з’являться тут.
                      </p>
                    )}
                    {requests.map((r) => (
                      <div className="sv-request" key={r.id}>
                        <strong>
                          {entries.find((e) => e.id === r.entry_id)?.title ??
                            "Публікацію приховано"}
                        </strong>
                        <p className="sv-muted">
                          {r.user_id === profile.id
                            ? "Твоя заявка"
                            : `Від: ${profiles[r.user_id]?.name ?? "Учасниця"}`}{" "}
                          · {statusText[r.status]}
                        </p>
                        <p>{r.message}</p>
                        <p>
                          <b>Контакт:</b> {r.contact}
                        </p>
                        {incomingRequests.some((x) => x.id === r.id) &&
                          r.status === "pending" && (
                            <div className="sv-actions">
                              <button
                                className="sv-btn"
                                disabled={busy}
                                onClick={() =>
                                  void updateRequest(r, "accepted")
                                }
                              >
                                Підтвердити
                              </button>
                              <button
                                className="sv-outline"
                                disabled={busy}
                                onClick={() =>
                                  void updateRequest(r, "rejected")
                                }
                              >
                                Відхилити
                              </button>
                            </div>
                          )}
                        {incomingRequests.some((x) => x.id === r.id) &&
                          r.status === "accepted" && (
                            <button
                              className="sv-outline"
                              disabled={busy}
                              onClick={() => void updateRequest(r, "closed")}
                            >
                              Позначити завершеною
                            </button>
                          )}
                      </div>
                    ))}
                  </TabsContent>
                  {admin && (
                    <TabsContent value="reports">
                      {reports.length === 0 ? (
                        <p className="sv-muted">Нових скарг немає.</p>
                      ) : (
                        reports.map((r) => (
                          <div key={r.id} className="sv-request">
                            <strong>
                              {entries.find((e) => e.id === r.entry_id)
                                ?.title ?? "Прихована публікація"}
                            </strong>
                            <p>{r.reason}</p>
                            {entries.find((e) => e.id === r.entry_id) && (
                              <button
                                className="sv-outline"
                                onClick={() =>
                                  archive(
                                    entries.find((e) => e.id === r.entry_id)!,
                                  )
                                }
                              >
                                Приховати публікацію
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </TabsContent>
                  )}
                </Tabs>

              </>
            ))}
          {section === "profile" && user && (
                <button
                  className="sv-rule-link sv-signout"
                  onClick={() =>
                    setConfirm({
                      title: "Вийти з профілю?",
                      body: user?.is_anonymous
                        ? "Це швидкий профіль. Після виходу відновити доступ до нього не вдасться."
                        : "Згодом можна буде увійти знову.",
                      action: async () => {
                        const result = await endClubSession(
                          () => user ? disableDevicePush(user.id) : Promise.resolve(),
                          () => db.auth.signOut({ scope: "local" }),
                        );
                        if (result.pushCleanupFailed) toast.info("Вихід виконано. Налаштування push не вдалося оновити.");
                        setProfile(null);
                        setUser(null);
                        closeDetail();
                        await load();
                      },
                    })
                  }
                >
                  <LogOut size={17} />
                  Вийти
                </button>
          )}
          <div className="sv-footer">
            <span>СВОЯ — жіночий клуб. Подруги та спільні плани.</span>
            <button onClick={() => setModal("rules")}>Правила спільноти</button>
            <a href={siteUrl("/")}>Про клуб</a>
          </div>
        </main>
      </div>
      <nav className="sv-mobile-nav" aria-label="Розділи клубу">
        {[
          { id: "feed", label: "Стрічка", icon: House },
          { id: "event", label: "Події", icon: CalendarDays },
          { id: "circle", label: "Спільнота", icon: Users },
          { id: "beauty", label: "Б’юті", icon: Sparkles },
          { id: "profile", label: "Профіль", icon: UserRound },
        ].map((n) => (
          <button
            key={n.id}
            className={section === n.id ? "active" : ""}
            onClick={() => go(n.id as Section)}
          >
            <n.icon size={21} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>
      <Dialog
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) closeDetail();
        }}
      >
        <DialogContent className="sv-dialog sv-detail">
          <DialogTitle>{detail?.title}</DialogTitle>
          <DialogDescription>
            {detail ? `${labels[detail.kind]} · ${detail.city}` : ""}
          </DialogDescription>
          {detail && (
            <>
              <div className="sv-detail-stock">
                <img
                  src={
                    detail.image_paths?.[0]
                      ? publicPhoto(detail.image_paths[0])
                      : cataloguePhoto(detail).src
                  }
                  alt={
                    detail.image_paths?.[0]
                      ? detail.title
                      : cataloguePhoto(detail).alt
                  }
                  style={{
                    objectPosition: cataloguePhoto(detail).detailPosition,
                  }}
                  width={600}
                  height={400}
                />
                <div>
                  <span>{detail.category}</span>
                  {detail.is_demo && <b>Приклад формату</b>}
                </div>
              </div>
              <p className="sv-stock-caption">
                {detail.image_paths?.length
                  ? "Фото від авторки публікації."
                  : "Стокове фото для ілюстрації теми."}
              </p>
              {detail.image_paths && detail.image_paths.length > 1 && (
                <div className="sv-public-gallery">
                  {detail.image_paths.slice(1).map((path) => (
                    <a
                      href={publicPhoto(path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      key={path}
                    >
                      <img
                        src={publicPhoto(path)}
                        alt={`Фото публікації «${detail.title}»`}
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              )}
              <Tabs defaultValue="about" key={detail.id}>
                <TabsList variant="line">
                  <TabsTrigger value="about">
                    Про{" "}
                    {detail.kind === "event"
                      ? "зустріч"
                      : detail.kind === "circle"
                        ? "коло"
                        : "пропозицію"}
                  </TabsTrigger>
                  {canChat && (
                    <TabsTrigger value="chat">
                      <MessageCircle size={15} />
                      Чат
                    </TabsTrigger>
                  )}
                  {isOwner && ["event", "circle"].includes(detail.kind) && (
                    <TabsTrigger value="members">Учасниці</TabsTrigger>
                  )}
                </TabsList>
                <TabsContent value="about">
                  <p className="sv-description">{detail.description}</p>
                  <div className="sv-detail-facts">
                    <p>
                      <MapPin size={18} />
                      {detail.location || detail.city}
                    </p>
                    {detail.kind === "event" && (
                      <p>
                        <CalendarDays size={18} />
                        {dateLabel(detail.starts_at)}
                        {!detail.is_demo ? " · час Києва" : ""}
                      </p>
                    )}
                    {["event", "circle"].includes(detail.kind) && (
                      <p>
                        <Users size={18} />
                        {detail.format === "coffee"
                          ? `До ${detail.capacity + 1} разом з організаторкою`
                          : `До ${detail.capacity} учасниць + організаторка`}{" "}
                        · вступ за підтвердженням
                      </p>
                    )}
                    {priceLabel(detail) && <p>{priceLabel(detail)}</p>}
                    {detail.owner_id && (
                      <button
                        className="sv-person-link"
                        disabled={!profiles[detail.owner_id]}
                        onClick={() => showMember(detail.owner_id!)}
                      >
                        <MemberAvatar profile={profiles[detail.owner_id]} />
                        <span>
                          {profiles[detail.owner_id]?.name ??
                            "Авторка пропозиції"}
                          {profiles[detail.owner_id] && (
                            <small>Переглянути профіль</small>
                          )}
                          <MemberTitleBadge profile={profiles[detail.owner_id]} />
                        </span>
                      </button>
                    )}
                  </div>
                  <EntryExtras
                    entry={detail}
                    profile={profile}
                    membership={activeMembership}
                    profiles={profiles}
                  />
                  {detail.is_demo ? (
                    <div className="sv-info-box">
                      <div>
                        <b>Ідея для майбутньої зустрічі</b>
                        <p>
                          Це приклад, а не оголошена подія. Створи власну
                          публікацію з датою та умовами.
                        </p>
                        <button
                          className="sv-btn"
                          onClick={() => {
                            const k = detail.kind;
                            closeDetail();
                            startCreate(k);
                          }}
                        >
                          Створити свою
                        </button>
                      </div>
                    </div>
                  ) : detail.status === "archived" ? (
                    <p className="sv-info-box">
                      Публікацію приховано. Нові заявки не приймаються.
                    </p>
                  ) : isOwner ? (
                    <div className="sv-info-box">
                      <Check size={20} />
                      <p>
                        Це твоя публікація. Заявки доступні у профілі
                        {["event", "circle"].includes(detail.kind)
                          ? " та у вкладці «Учасниці»"
                          : ""}
                        .
                      </p>
                    </div>
                  ) : ["event", "circle"].includes(detail.kind) ? (
                    activeMembership ? (
                      <div className="sv-membership-state">
                        <strong
                          className={`sv-status ${activeMembership.status}`}
                        >
                          {statusText[activeMembership.status]}
                        </strong>
                        <p>
                          {activeMembership.status === "joined"
                            ? "Тепер доступний чат. Узгодьте деталі перед зустріччю."
                            : activeMembership.status === "pending"
                              ? "Організаторка розгляне заявку. Перевіряй статус у профілі."
                              : activeMembership.status === "waitlisted"
                                ? "Коли звільниться місце, заявка перейде на підтвердження організаторці. Ми повідомимо тебе."
                                : "Можна обрати іншу зустріч або скасувати цю заявку."}
                        </p>
                        <button
                          className="sv-outline"
                          disabled={busy}
                          onClick={() => leave(detail)}
                        >
                          Скасувати заявку / участь
                        </button>
                      </div>
                    ) : detail.kind === "event" &&
                      detail.starts_at &&
                      new Date(detail.starts_at).getTime() <= Date.now() ? (
                      <p>Ця подія вже відбулася.</p>
                    ) : (
                      <div className="sv-first-visit">
                        {detail.welcome_newcomers && (
                          <label className="sv-check">
                            <input
                              type="checkbox"
                              checked={needsGreeter}
                              onChange={(e) =>
                                setNeedsGreeter(e.target.checked)
                              }
                            />
                            Я вперше — хочу, щоб мене зустріли
                          </label>
                        )}
                        <button
                          className="sv-btn sv-full"
                          disabled={busy}
                          onClick={() => void join(detail)}
                        >
                          {busy
                            ? "Надсилаємо…"
                            : detail.kind === "circle"
                              ? "Приєднатися до кола"
                              : (counts[detail.id]?.joined ?? 0) >=
                                  detail.capacity
                                ? "Стати у лист очікування"
                                : "Хочу на зустріч"}
                        </button>
                      </div>
                    )
                  ) : requests.find(
                      (r) => r.entry_id === detail.id && r.user_id === user?.id,
                    ) ? (
                    <div className="sv-info-box">
                      <Check size={20} />
                      <p>
                        Твоя заявка:{" "}
                        {
                          statusText[
                            requests.find(
                              (r) =>
                                r.entry_id === detail.id &&
                                r.user_id === user?.id,
                            )!.status
                          ]
                        }
                        . Деталі — у профілі.
                      </p>
                    </div>
                  ) : !profile ? (
                    <button
                      className="sv-btn sv-full"
                      onClick={() => setModal("auth")}
                    >
                      Увійти, щоб залишити заявку
                    </button>
                  ) : (
                    <form onSubmit={respond} className="sv-form">
                      <h3>
                        {detail.kind === "beauty"
                          ? "Заявка на запис"
                          : "Відгукнутися"}
                      </h3>
                      <label>
                        Повідомлення
                        <textarea
                          name="message"
                          required
                          minLength={3}
                          maxLength={2000}
                          placeholder={
                            detail.kind === "beauty"
                              ? "Послуга та бажаний день і час"
                              : "Коротко опиши свій запит або пропозицію"
                          }
                        />
                      </label>
                      <label>
                        Контакт для відповіді
                        <input
                          name="contact"
                          required
                          minLength={3}
                          maxLength={180}
                          placeholder="Телефон, Telegram або email"
                        />
                      </label>
                      <small>
                        Контакт побачить лише авторка пропозиції. Оплата та
                        остаточні умови погоджуються напряму.
                      </small>
                      <button className="sv-btn" disabled={busy}>
                        {busy ? "Надсилаємо…" : "Надіслати заявку"}
                      </button>
                    </form>
                  )}
                  <div className="sv-detail-tools">
                    <button
                      onClick={() =>
                        void navigator.clipboard
                          .writeText(
                            `${location.origin}${siteUrl(`/club?entry=${detail.id}`)}`,
                          )
                          .then(() => toast.success("Посилання скопійовано."))
                          .catch(() =>
                            toast.error(
                              "Не вдалося скопіювати. Скопіюй адресу з браузера.",
                            ),
                          )
                      }
                    >
                      <Share2 size={16} />
                      Поділитися
                    </button>
                    {!detail.is_demo && !isOwner && (
                      <button
                        onClick={() => {
                          if (requireProfile()) setModal("report");
                        }}
                      >
                        <Flag size={16} />
                        Поскаржитися
                      </button>
                    )}
                    {(isOwner || admin) && detail.status === "published" && (
                      <button onClick={() => archive(detail)}>Приховати</button>
                    )}
                  </div>
                </TabsContent>
                {canChat && (
                  <TabsContent value="chat">
                    <p className="sv-muted">
                      Чат доступний організаторці та підтвердженим учасницям.
                      Нові повідомлення оновлюються автоматично.
                    </p>
                    <div className="sv-chat" aria-live="polite">
                      {chatError && <p role="alert">{chatError}</p>}
                      {!messages.length && !chatError && (
                        <p className="sv-muted">
                          {messageLoading
                            ? "Завантажуємо розмову…"
                            : "Почни розмову з привітання."}
                        </p>
                      )}
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={`sv-bubble ${m.user_id === user?.id ? "mine" : ""}`}
                        >
                          <b>{profiles[m.user_id]?.name ?? "Учасниця"}</b>
                          <p>{m.body}</p>
                          <small>
                            {new Intl.DateTimeFormat("uk-UA", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Europe/Kyiv",
                            }).format(new Date(m.created_at))}
                          </small>
                        </div>
                      ))}
                    </div>
                    {detail.status === "published" &&
                      (!detail.expires_at ||
                        Date.parse(detail.expires_at) > Date.now()) && (
                        <form className="sv-chat-input" onSubmit={sendMessage}>
                          <input
                            aria-label="Повідомлення в чат"
                            maxLength={2000}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Напиши своїм…"
                          />
                          <button
                            className="sv-btn"
                            disabled={busy || !message.trim()}
                            aria-label="Надіслати повідомлення"
                          >
                            <Send size={18} />
                          </button>
                        </form>
                      )}
                  </TabsContent>
                )}
                {isOwner && (
                  <TabsContent value="members">
                    {members.filter((m) => m.entry_id === detail.id).length ===
                    0 ? (
                      <p className="sv-muted">
                        Поки що ніхто не подав заявку. Поділися посиланням на
                        зустріч.
                      </p>
                    ) : (
                      members
                        .filter((m) => m.entry_id === detail.id)
                        .map((m) => (
                          <div className="sv-request" key={m.user_id}>
                            <button
                              className="sv-person-link"
                              onClick={() => showMember(m.user_id)}
                            >
                              <MemberAvatar profile={profiles[m.user_id]} />
                              <strong>
                                {profiles[m.user_id]?.name ?? "Учасниця"}
                              </strong>
                            </button>
                            <p>{profiles[m.user_id]?.bio}</p>
                            <small>{statusText[m.status]}</small>
                            <GreeterSelect
                              entry={detail}
                              member={m}
                              members={members}
                              profiles={profiles}
                              onChange={() => void load()}
                            />
                            {m.status === "pending" && (
                              <div className="sv-actions">
                                <button
                                  className="sv-btn"
                                  disabled={busy}
                                  onClick={() => void updateMember(m, "joined")}
                                >
                                  Підтвердити
                                </button>
                                <button
                                  className="sv-outline"
                                  disabled={busy}
                                  onClick={() =>
                                    void updateMember(m, "rejected")
                                  }
                                >
                                  Відхилити
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                    )}
                  </TabsContent>
                )}
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!viewingProfile}
        onOpenChange={(v) => !v && setViewingProfile(null)}
      >
        <DialogContent className="sv-dialog sv-member-dialog">
          <DialogTitle>{viewingProfile?.name}</DialogTitle>
          <DialogDescription>{viewingProfile?.city}</DialogDescription>
          {viewingProfile && (
            <>
              <div className="sv-member-intro">
                <MemberAvatar profile={viewingProfile} large />
                <div>
                  <MemberTitleBadge profile={viewingProfile} />
                  <p>{viewingProfile.bio || "Рада новим знайомствам."}</p>
                  <div className="sv-tags">
                    {viewingProfile.interests.map((v) => (
                      <span key={v}>{v}</span>
                    ))}
                  </div>
                </div>
              </div>
              <ProfileGallery profile={viewingProfile} />
              {profile && (
                <SafetyControls
                  me={profile.id}
                  target={viewingProfile.id}
                  onChange={() => {
                    setViewingProfile(null);
                    void load();
                  }}
                />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={modal !== null}
        onOpenChange={(v) => {
          if (!v && !busy) {
            if (modal === "auth" && recovery) {
              finishClubPasswordRecovery();
              setRecovery(false);
            }
            setModal(null);
          }
        }}
      >
        <DialogContent className="sv-dialog">
          <DialogTitle>
            {modal === "auth"
              ? profile
                ? "Твій профіль"
                : "Знайдемо твоє коло?"
              : modal === "create"
                ? "Поділися зі своїми"
                : modal === "rules"
                  ? "Правила «СВОЯ»"
                  : "Повідомити про публікацію"}
          </DialogTitle>
          <DialogDescription>
            {modal === "auth"
              ? "Трохи про тебе — для знайомств, спільних планів і підтримки."
              : modal === "create"
                ? "Зрозумілі деталі допоможуть учасницям долучитися."
                : modal === "report"
                  ? "Опиши проблему. Звернення побачить команда клубу."
                  : "Повага, добровільність і турбота про особисті межі."}
          </DialogDescription>
          {modal === "auth" && (
            <>
              {(!user || user.is_anonymous || recovery) && (
                <AuthPanel
                  key={recovery ? "recovery" : (user?.id ?? "guest")}
                  user={user}
                  recovery={recovery}
                  onComplete={() => {
                    if (recovery) finishClubPasswordRecovery();
                    setRecovery(false);
                    void load();
                  }}
                />
              )}
              {user && !recovery && (!user.is_anonymous || profile) && (
                <ProfileEditor
                  key={profile?.id ?? "new"}
                  profile={profile}
                  city={city === "Усі міста" ? "Чернігів" : city}
                  busy={busy}
                  onSave={saveProfile}
                />
              )}
            </>
          )}
          {modal === "create" && profile && (
            <PublicationForm
              profile={profile}
              initialKind={createKind}
              initialFormat={createFormat}
              onPublished={(e) => {
                setModal(null);
                setCity(e.city);
                go(e.kind);
                void load().then(() => open(e));
              }}
            />
          )}
          {modal === "rules" && (
            <div className="sv-rules">
              <p>«СВОЯ» — жіноча спільнота для повнолітніх учасниць.</p>
              <h3>Повага до меж</h3>
              <p>
                Без образ, тиску, переслідування та небажаних особистих
                повідомлень. Участь у зустрічах і допомога — добровільні.
              </p>
              <h3>Зрозумілі умови</h3>
              <p>
                Указуй реальні ціну, формат та умови скасування. Не публікуй
                чужі контакти або фотографії без згоди. Рекламні пропозиції
                розміщуй у відповідних розділах.
              </p>
              <h3>Зустрічі та послуги</h3>
              <p>
                Обирай громадські місця та враховуй повітряні тривоги й
                доступність укриття. Заявка означає запит; остаточні умови
                підтверджує організаторка або майстриня. Клуб не приймає оплату
                за послуги у цій версії.
              </p>
              <h3>Дані та звернення</h3>
              <p>
                Фото, ім’я й опис профілю бачать схвалені учасниці з урахуванням
                блокувань. Нові анкети перевіряє команда клубу. Контакти в
                заявках доступні лише двом сторонам, а чат — підтвердженим
                учасницям. Особистий чат відкривається після прийняття
                запрошення. Фото історій та публікацій доступні всім за згодою
                авторки. На порушення можна поскаржитися у картці публікації або
                профілю.
              </p>
            </div>
          )}
          {modal === "report" && (
            <form className="sv-form" onSubmit={report}>
              <label>
                Що трапилося?
                <textarea
                  name="reason"
                  required
                  minLength={5}
                  maxLength={2000}
                />
              </label>
              <button className="sv-btn" disabled={busy}>
                Надіслати звернення
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!confirm}
        onOpenChange={(v) => {
          if (!v && !busy) setConfirm(null);
        }}
      >
        <AlertDialogContent className="sv-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Залишити</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void run(async () => {
                  await confirm?.action();
                  setConfirm(null);
                });
              }}
            >
              Підтвердити
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Toaster theme="light" richColors position="top-center" />
    </SidebarProvider>
  );
}
