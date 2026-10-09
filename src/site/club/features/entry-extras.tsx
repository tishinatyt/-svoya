import { toast } from "sonner";
import type { Entry, Membership, Profile } from "@/lib/club-types";
import { action, useTask } from "./shared";
import { CalendarDownload, Reminder } from "./calendar";
export function EntryExtras({
  entry,
  profile,
  membership,
  profiles,
}: {
  entry: Entry;
  profile: Profile | null;
  membership?: Membership;
  profiles: Record<string, Profile>;
}) {
  if (entry.is_demo) return null;
  return (
    <div className="sv-entry-extras">
      {entry.format === "coffee" && (
        <p className="sv-notice">
          Кава на чотирьох · до {entry.capacity + 1} жінок разом з
          організаторкою. Кожна сплачує своє замовлення, якщо в описі не
          зазначено інше.
        </p>
      )}
      {entry.format === "quick" && (
        <p className="sv-notice">
          Швидкий план. Після завершення він зникне з публічної стрічки.
        </p>
      )}
      {entry.recurrence_note && (
        <p>
          <b>Ритм кола:</b> {entry.recurrence_note}
        </p>
      )}
      {entry.welcome_newcomers && ["event", "circle"].includes(entry.kind) && (
        <p>♡ Тут раді новеньким. Можна прийти самій.</p>
      )}
      {entry.children_welcome && <p>Можна з дітьми.</p>}
      {entry.shelter_info && (
        <p>
          <b>Під час тривоги:</b> {entry.shelter_info}
        </p>
      )}
      {entry.accessibility_info && (
        <p>
          <b>Доступність:</b> {entry.accessibility_info}
        </p>
      )}
      {membership?.needs_greeter && membership.status !== "rejected" && (
        <p className="sv-notice">
          {membership.greeter_id && profiles[membership.greeter_id]?.membership_status === "approved"
            ? `Тебе зустріне ${profiles[membership.greeter_id].name}.`
            : "Уточни в організаторки, хто тебе зустріне."}
          {" "}Після підтвердження участі узгодьте деталі в чаті.
        </p>
      )}
      {entry.starts_at && (
        <div className="sv-inline-actions">
          <CalendarDownload entry={entry} />
        </div>
      )}
      {profile &&
        (membership?.status === "joined" || entry.owner_id === profile.id) && (
          <Reminder entry={entry} me={profile.id} />
        )}
    </div>
  );
}
export function GreeterSelect({
  entry,
  member,
  members,
  profiles,
  onChange,
}: {
  entry: Entry;
  member: Membership;
  members: Membership[];
  profiles: Record<string, Profile>;
  onChange: () => void;
}) {
  const { busy, run } = useTask();
  if (!member.needs_greeter) return null;
  const people = [
    ...new Set([
      entry.owner_id!,
      ...members
        .filter(
          (m) =>
            m.entry_id === entry.id &&
            m.status === "joined" &&
            profiles[m.user_id]?.welcomes_newcomers,
        )
        .map((m) => m.user_id),
    ]),
  ];
  return (
    <label className="sv-reminder">
      Я вперше · хто зустріне
      <select
        value={member.greeter_id ?? entry.owner_id!}
        disabled={busy}
        onChange={(e) =>
          void run(async () => {
            await action("assign_greeter", {
              entry_id: entry.id,
              user_id: member.user_id,
              greeter_id: e.target.value,
            });
            toast.success("Учасницю, яка зустріне новеньку, призначено.");
            onChange();
          })
        }
      >
        {people.map((id) => (
          <option key={id} value={id}>
            {profiles[id]?.name ?? "Організаторка"}
            {id === entry.owner_id ? " (організаторка)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
