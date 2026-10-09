import { membershipStatusText } from "./membership-status";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Entry, Membership, Profile } from "@/lib/club-types";
import { clubDb } from "@/lib/club-db";
import { siteUrl } from "@/lib/site-path";
import { dateTime, FeatureHeader, EmptyState, useTask } from "./shared";
import { eventICS } from "./calendar-utils";
export function CalendarDownload({ entry }: { entry: Entry }) {
  if (!entry.starts_at) return null;
  return (
    <button
      className="sv-outline"
      onClick={() => {
        const url = URL.createObjectURL(
          new Blob(
            [
              eventICS(
                entry,
                `${location.origin}${siteUrl(`/club?entry=${entry.id}`)}`,
              ),
            ],
            { type: "text/calendar;charset=utf-8" },
          ),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = `svoya-${entry.id}.ics`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.info(
          "Відкрий файл у своєму календарі. Нагадування — за 30 хвилин.",
        );
      }}
    >
      Додати у календар .ics
    </button>
  );
}
export function Reminder({ entry, me }: { entry: Entry; me: string }) {
  const [value, setValue] = useState("off");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const { busy, run } = useTask();
  useEffect(() => {
    let active = true;
    clubDb()
      .from("svoya_reminders")
      .select("minutes_before")
      .eq("user_id", me)
      .eq("entry_id", entry.id)
      .maybeSingle()
      .then((r) => {
        if (active) {
          setValue(r.data ? String(r.data.minutes_before) : "off");
          setError(!!r.error);
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, [entry.id, me]);
  if (!entry.starts_at || Date.parse(entry.starts_at) <= Date.now())
    return null;
  return (
    <label className="sv-reminder">
      Нагадування в клубі
      <select
        aria-label="Нагадування в клубі"
        value={value}
        disabled={busy || !loaded || error}
        onChange={(e) => {
          const v = e.target.value;
          void run(async () => {
            const db = clubDb();
            if (v === "off") {
              const r = await db
                .from("svoya_reminders")
                .delete()
                .eq("entry_id", entry.id)
                .eq("user_id", me);
              if (r.error) throw r.error;
            } else {
              const r =
                value === "off"
                  ? await db
                      .from("svoya_reminders")
                      .insert({
                        user_id: me,
                        entry_id: entry.id,
                        minutes_before: Number(v),
                      })
                  : await db
                      .from("svoya_reminders")
                      .update({ minutes_before: Number(v) })
                      .eq("user_id", me)
                      .eq("entry_id", entry.id);
              if (r.error) throw r.error;
            }
            setValue(v);
            toast.success(
              v === "off" ? "Нагадування вимкнено." : "Нагадування збережено.",
            );
          });
        }}
      >
        <option value="off">Без нагадування</option>
        <option value="1440">За день</option>
        <option value="60">За годину</option>
        <option value="30">За 30 хвилин</option>
      </select>
      <small>
        {error
          ? "Не вдалося завантажити налаштування. Відкрий зустріч ще раз."
          : "Нагадування з’явиться у дзвіночку. Для сповіщення на пристрої увімкни push у меню дзвіночка."}
      </small>
    </label>
  );
}
export default function Calendar({
  entries,
  members,
  profile,
  onOpen,
}: {
  entries: Entry[];
  members: Membership[];
  profile: Profile | null;
  onOpen: (e: Entry) => void;
}) {
  const [scope, setScope] = useState("all"),
    [day, setDay] = useState("");
  const visible = entries
    .filter(
      (e) =>
        !e.is_demo &&
        e.kind === "event" &&
        e.starts_at &&
        e.status === "published" &&
        Date.parse(e.starts_at) > Date.now() &&
        (!day ||
          new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(
            new Date(e.starts_at),
          ) === day) &&
        (scope === "all" ||
          e.owner_id === profile?.id ||
          members.some(
            (m) =>
              m.entry_id === e.id &&
              m.user_id === profile?.id &&
              m.status !== "rejected",
          )),
    )
    .sort((a, b) => Date.parse(a.starts_at!) - Date.parse(b.starts_at!));
  return (
    <>
      <FeatureHeader
        eyebrow="ЧАС ДЛЯ СЕБЕ"
        title="Плани, які хочеться зберегти."
      >
        Усі дати показані за Києвом. Зустріч можна додати до Apple, Google або
        іншого календаря через файл .ics.
      </FeatureHeader>
      <div className="sv-calendar-tools">
        <div className="sv-segmented">
          <button
            aria-pressed={scope === "all"}
            onClick={() => setScope("all")}
          >
            Усі зустрічі
          </button>
          <button
            aria-pressed={scope === "mine"}
            onClick={() => setScope("mine")}
          >
            Мої плани
          </button>
        </div>
        <label>
          Дата
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
        {day && (
          <button className="sv-text-button" onClick={() => setDay("")}>
            Усі дати
          </button>
        )}
      </div>
      {!visible.length ? (
        <EmptyState title="Є місце для нового плану">
          <p>
            {scope === "mine"
              ? "Твої заявки та організовані зустрічі з’являться тут."
              : "На цю дату ще немає опублікованих зустрічей."}
          </p>
        </EmptyState>
      ) : (
        <div className="sv-calendar-list">
          {visible.map((e) => {
            const m = members.find(
              (m) => m.entry_id === e.id && m.user_id === profile?.id,
            );
            return (
              <article key={e.id}>
                <time dateTime={e.starts_at!}>
                  <b>
                    {new Intl.DateTimeFormat("uk-UA", {
                      timeZone: "Europe/Kyiv",
                      day: "2-digit",
                    }).format(new Date(e.starts_at!))}
                  </b>
                  {new Intl.DateTimeFormat("uk-UA", {
                    timeZone: "Europe/Kyiv",
                    month: "short",
                  }).format(new Date(e.starts_at!))}
                </time>
                <div>
                  <span className="sv-overline">
                    {e.format === "coffee"
                      ? "КАВА НА ЧОТИРЬОХ"
                      : e.format === "quick"
                        ? "МАЮ ГОДИНУ"
                        : "ЗУСТРІЧ"}
                  </span>
                  <h3>{e.title}</h3>
                  <p>
                    {dateTime(e.starts_at!)} · {e.city} · {e.location}
                  </p>
                  {m && (
                    <small>
                      {membershipStatusText[m.status]}
                    </small>
                  )}
                  <div className="sv-inline-actions">
                    <button className="sv-btn" onClick={() => onOpen(e)}>
                      Деталі зустрічі
                    </button>
                    <CalendarDownload entry={e} />
                  </div>
                  {profile &&
                    (m?.status === "joined" || e.owner_id === profile.id) && (
                      <Reminder entry={e} me={profile.id} />
                    )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
