import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { clubDb } from "@/lib/club-db";
import type { Profile } from "@/lib/club-types";
import { MemberAvatar } from "../profile-photos";
import { MemberTitleBadge } from './member-titles';
import {
  action,
  EmptyState,
  ErrorState,
  FeatureHeader,
  SignInPrompt,
  useTask,
} from "./shared";
import { availabilityLabels, weeklyMatches } from "./matching";
type Friendship = {
  id: string;
  from_id: string;
  to_id: string;
  status: string;
  note: string;
};
type ChatMessage = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
};
export function Preferences({
  profile,
  onChange,
}: {
  profile: Profile;
  onChange: () => void;
}) {
  const { busy, run } = useTask();
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await run(async () => {
      const r = await clubDb()
        .from("svoya_profiles")
        .update({
          discoverable: f.has("discoverable"),
          district: String(f.get("district") ?? "").trim(),
          availability: f.getAll("availability"),
          welcomes_newcomers: f.has("welcomes_newcomers"),
        })
        .eq("id", profile.id);
      if (r.error) throw r.error;
      toast.success("Побажання збережено.");
      onChange();
    });
  }
  return (
    <details className="sv-feature-box sv-preferences">
      <summary>Мої знайомства та вільний час</summary>
      <form className="sv-form" onSubmit={save}>
        <label className="sv-check">
          <input
            type="checkbox"
            name="discoverable"
            defaultChecked={profile.discoverable}
          />
          Показувати мій профіль у добірці «Подруги»
        </label>
        <small>
          Тільки схваленим учасницям клубу. Особистий чат відкриється після
          прийнятого запрошення.
        </small>
        <label>
          Район (необов’язково)
          <input
            name="district"
            defaultValue={profile.district}
            maxLength={80}
            placeholder="Без домашньої адреси"
          />
        </label>
        <fieldset>
          <legend>Коли мені зручно</legend>
          {Object.entries(availabilityLabels).map(([v, l]) => (
            <label className="sv-check" key={v}>
              <input
                type="checkbox"
                name="availability"
                value={v}
                defaultChecked={profile.availability?.includes(v)}
              />
              {l}
            </label>
          ))}
        </fieldset>
        <label className="sv-check">
          <input
            type="checkbox"
            name="welcomes_newcomers"
            defaultChecked={profile.welcomes_newcomers}
          />
          Готова зустрічати новеньких на подіях, у яких беру участь
        </label>
        <button className="sv-btn" disabled={busy}>
          Зберегти побажання
        </button>
      </form>
    </details>
  );
}
export function SafetyControls({
  me,
  target,
  onChange,
}: {
  me: string;
  target: string;
  onChange: () => void;
}) {
  const [mode, setMode] = useState<"none" | "block" | "report">("none");
  const { busy, run } = useTask();
  if (me === target) return null;
  return (
    <div className="sv-safety-controls">
      <div className="sv-inline-actions">
        <button
          className="sv-text-button"
          onClick={() => setMode(mode === "block" ? "none" : "block")}
        >
          Заблокувати контакт
        </button>
        <button
          className="sv-text-button"
          onClick={() => setMode(mode === "report" ? "none" : "report")}
        >
          Поскаржитися
        </button>
      </div>
      {mode === "block" && (
        <div className="sv-notice">
          <p>
            Профілі та особисте листування стануть недоступними одне для одного.
            У спільному чаті її повідомлення будуть приховані для тебе.
          </p>
          <button
            className="sv-outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const r = await clubDb()
                  .from("svoya_blocks")
                  .insert({ blocker_id: me, blocked_id: target });
                if (r.error) throw r.error;
                toast.success(
                  "Контакт заблоковано. Скасувати можна у профілі.",
                );
                setMode("none");
                onChange();
              })
            }
          >
            Підтвердити блокування
          </button>
        </div>
      )}
      {mode === "report" && (
        <form
          className="sv-form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              const r = await clubDb()
                .from("svoya_reports")
                .insert({
                  user_id: me,
                  target_user_id: target,
                  reason: String(f.get("reason")),
                });
              if (r.error) throw r.error;
              toast.success("Звернення надіслано команді клубу.");
              setMode("none");
            });
          }}
        >
          <label>
            Що сталося?
            <textarea name="reason" required minLength={5} maxLength={2000} />
          </label>
          <button className="sv-btn" disabled={busy}>
            Надіслати команді
          </button>
        </form>
      )}
    </div>
  );
}
export function BlockList({
  me,
  onChange,
}: {
  me: string;
  onChange: () => void;
}) {
  const [ids, setIds] = useState<string[]>([]);
  const { busy, run } = useTask();
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    clubDb()
      .from("svoya_blocks")
      .select("blocked_id")
      .eq("blocker_id", me)
      .then((r) => {
        if (active) {
          setError(!!r.error);
          setIds((r.data ?? []).map((v) => v.blocked_id));
        }
      });
    return () => {
      active = false;
    };
  }, [me, revision]);
  return (
    <details className="sv-feature-box">
      <summary>Заблоковані контакти · {ids.length}</summary>
      {error ? (
        <ErrorState retry={() => setRevision((x) => x + 1)} />
      ) : ids.length ? (
        ids.map((id) => (
          <div className="sv-list-row" key={id}>
            <span>Прихована учасниця · {id.slice(-6)}</span>
            <button
              className="sv-outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const r = await clubDb()
                    .from("svoya_blocks")
                    .delete()
                    .eq("blocker_id", me)
                    .eq("blocked_id", id);
                  if (r.error) throw r.error;
                  setRevision((x) => x + 1);
                  onChange();
                })
              }
            >
              Розблокувати
            </button>
          </div>
        ))
      ) : (
        <p>Тут поки порожньо.</p>
      )}
    </details>
  );
}
function FriendChat({
  friend,
  me,
  other,
}: {
  friend: Friendship;
  me: string;
  other: Profile | undefined;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const { busy, run } = useTask();
  useEffect(() => {
    let active = true;
    async function read() {
      if (document.hidden) return;
      const r = await clubDb()
        .from("svoya_friend_messages")
        .select("*")
        .eq("friendship_id", friend.id)
        .order("created_at", { ascending: false })
        .limit(80);
      if (active) {
        setError(!!r.error);
        setMessages((r.data ?? []).reverse());
      }
    }
    void read();
    const timer = setInterval(() => void read(), 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [friend.id, revision]);
  return (
    <div className="sv-friend-chat">
      <h3>Розмова з {other?.name ?? "учасницею"}</h3>
      {error ? (
        <ErrorState retry={() => setRevision((x) => x + 1)} />
      ) : (
        <div className="sv-friend-messages" aria-live="polite">
          {messages.length ? (
            messages.map((m) => (
              <div key={m.id} className={m.user_id === me ? "mine" : ""}>
                <b>{m.user_id === me ? "Ти" : (other?.name ?? "Учасниця")}</b>
                <p>{m.body}</p>
                <time>
                  {new Date(m.created_at).toLocaleTimeString("uk-UA", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
            ))
          ) : (
            <p>Почни з простого «привіт». Домовтеся про каву або прогулянку.</p>
          )}
        </div>
      )}
      <form
        className="sv-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const body = String(new FormData(form).get("body") ?? "").trim();
          if (!body) return;
          void run(async () => {
            const r = await clubDb()
              .from("svoya_friend_messages")
              .insert({ friendship_id: friend.id, user_id: me, body });
            if (r.error) throw r.error;
            form.reset();
            setRevision((x) => x + 1);
          });
        }}
      >
        <label>
          Повідомлення
          <textarea name="body" required maxLength={2000} rows={2} />
        </label>
        <button className="sv-btn" disabled={busy}>
          Надіслати
        </button>
      </form>
    </div>
  );
}
export default function People({
  profile,
  refreshKey = 0,
  onLogin,
  onChange,
}: {
  refreshKey?: number;
  profile: Profile | null;
  onLogin: () => void;
  onChange: () => void;
}) {
  const [people, setPeople] = useState<Profile[]>([]);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [known, setKnown] = useState<Record<string, Profile>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const { busy, run } = useTask();
  const reload = () => {
    setRevision((x) => x + 1);
    onChange();
  };
  useEffect(() => {
    let active = true;
    if (!profile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let inFlight = false;
    const read = async () => {
      if (inFlight || !active) return;
      inFlight = true;
      try {
      const [p, f] = await Promise.all([
        clubDb()
          .from("svoya_profiles")
          .select("*")
          .eq("discoverable", true)
          .eq("city", profile.city)
          .limit(200),
        clubDb()
          .from("svoya_friendships")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      if (p.error || f.error) {
        setError(true);
        setLoading(false);
        return;
      }
      const ids = [
        ...new Set((f.data ?? []).flatMap((x) => [x.from_id, x.to_id])),
      ];
      const all = ids.length
        ? await clubDb().from("svoya_profiles").select("*").in("id", ids)
        : { data: [], error: null };
      if (!active) return;
      setError(!!all.error);
      setPeople(p.data ?? []);
      setFriends(f.data ?? []);
      setKnown(Object.fromEntries((all.data ?? []).map((p) => [p.id, p])));
      setLoading(false);
      } catch { if (active) { setError(true); setLoading(false); } }
      finally { inFlight = false; }
    };
    void read();
    const timer = setInterval(() => { if (document.visibilityState !== "hidden") void read(); }, 15000);
    const onFocus = () => void read();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [profile?.id, profile?.city, profile?.membership_status, revision, refreshKey]);
  return (
    <>
      <FeatureHeader
        eyebrow="ЗНАЙОМСТВА БЕЗ ПОСПІХУ"
        title="Три приводи сказати «привіт»."
      >
        Невелика щотижнева добірка за містом, інтересами та вільним часом. Ти
        сама вирішуєш, з ким спілкуватися.
      </FeatureHeader>
      {!profile ? (
        <SignInPrompt onLogin={onLogin} />
      ) : (
        <>
          <Preferences
            key={profile.id + String(profile.discoverable)}
            profile={profile}
            onChange={reload}
          />
          {profile.membership_status !== "approved" ? (
            <EmptyState title="Спочатку познайомимося з тобою">
              <p>
                Після схвалення анкети тут з’являться учасниці, відкриті до
                знайомств.
              </p>
            </EmptyState>
          ) : (
            <>
              {error ? (
                <ErrorState retry={() => setRevision((x) => x + 1)} />
              ) : loading ? (
                <p role="status">Шукаємо спільне…</p>
              ) : (
                <>
                  {!profile.discoverable ? (
                    <EmptyState title="Знайомства — за твоїм бажанням">
                      <p>
                        Увімкни показ профілю в побажаннях вище. Твої контакти
                        не публікуються.
                      </p>
                    </EmptyState>
                  ) : (
                    <div className="sv-people-grid">
                      {weeklyMatches(
                        profile,
                        people.filter(
                          (p) =>
                            !friends.some(
                              (f) => f.from_id === p.id || f.to_id === p.id,
                            ),
                        ),
                      ).map(({ profile: p, reasons }) => (
                        <article className="sv-person-card" key={p.id}>
                          <MemberAvatar profile={p} large />
                          <h3>{p.name}</h3>
                          <MemberTitleBadge profile={p} />
                          <span>
                            {p.city}
                            {p.district ? ` · ${p.district}` : ""}
                          </span>
                          <p>
                            {p.bio || "Буде рада знайомству у своєму темпі."}
                          </p>
                          <div className="sv-reasons">
                            {reasons.slice(0, 3).map((r) => (
                              <span key={r}>{r}</span>
                            ))}
                          </div>
                          <button
                            className="sv-btn"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await action("friend_invite", {
                                  user_id: p.id,
                                });
                                toast.success(
                                  "Запрошення надіслано. Чат відкриється після згоди.",
                                );
                                setRevision((x) => x + 1);
                              })
                            }
                          >
                            Запросити познайомитися
                          </button>
                          <SafetyControls
                            me={profile.id}
                            target={p.id}
                            onChange={reload}
                          />
                        </article>
                      ))}
                    </div>
                  )}
                  {profile.discoverable &&
                    !weeklyMatches(
                      profile,
                      people.filter(
                        (p) =>
                          !friends.some(
                            (f) => f.from_id === p.id || f.to_id === p.id,
                          ),
                      ),
                    ).length && (
                      <EmptyState title="Свої люди ще приєднуються">
                        <p>
                          Поки немає нових відкритих анкет у твоєму місті.
                          Заходь згодом або знайомся на зустрічах клубу.
                        </p>
                      </EmptyState>
                    )}
                  <h2 className="sv-subheading">Мої знайомства</h2>
                  {!friends.length && (
                    <p className="sv-muted">
                      Запрошення та прийняті знайомства з’являться тут.
                    </p>
                  )}
                  <div className="sv-feature-stack">
                    {friends
                      .filter((f) => f.status !== "declined")
                      .map((f) => {
                        const otherId =
                          f.from_id === profile.id ? f.to_id : f.from_id;
                        const p = known[otherId];
                        return (
                          <article className="sv-feature-box" key={f.id}>
                            <div className="sv-list-row">
                              <MemberAvatar profile={p} />
                              <div>
                                <h3>{p?.name ?? "Учасниця клубу"}</h3>
                                <MemberTitleBadge profile={p} />
                                <p>
                                  {f.status === "accepted"
                                    ? "Запрошення прийнято"
                                    : f.to_id === profile.id
                                      ? f.note
                                      : "Очікуємо відповіді"}
                                </p>
                              </div>
                              <div className="sv-inline-actions">
                                {f.status === "pending" &&
                                f.to_id === profile.id ? (
                                  <>
                                    <button
                                      className="sv-btn"
                                      disabled={busy}
                                      onClick={() =>
                                        void run(async () => {
                                          await action("friend_respond", {
                                            id: f.id,
                                            status: "accepted",
                                          });
                                          setRevision((x) => x + 1);
                                        })
                                      }
                                    >
                                      Познайомитися
                                    </button>
                                    <button
                                      className="sv-outline"
                                      disabled={busy}
                                      onClick={() =>
                                        void run(async () => {
                                          await action("friend_respond", {
                                            id: f.id,
                                            status: "declined",
                                          });
                                          setRevision((x) => x + 1);
                                        })
                                      }
                                    >
                                      Відмовитися
                                    </button>
                                  </>
                                ) : (
                                  f.status === "accepted" && (
                                    <button
                                      className="sv-outline"
                                      onClick={() =>
                                        setSelected(
                                          selected === f.id ? null : f.id,
                                        )
                                      }
                                    >
                                      {selected === f.id
                                        ? "Згорнути"
                                        : "Відкрити чат"}
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                            {selected === f.id && (
                              <FriendChat
                                key={f.id}
                                friend={f}
                                me={profile.id}
                                other={p}
                              />
                            )}
                            <SafetyControls
                              me={profile.id}
                              target={otherId}
                              onChange={reload}
                            />
                          </article>
                        );
                      })}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
