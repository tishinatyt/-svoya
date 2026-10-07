import type { Profile } from "@/lib/club-types";
export const availabilityLabels: Record<string, string> = {
  weekday_day: "Будні вдень",
  weekday_evening: "Будні ввечері",
  weekend: "Вихідні",
};
export function weeklyMatches(
  me: Profile,
  people: Profile[],
  now = new Date(),
) {
  const week = Math.floor(
    (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      Date.UTC(1970, 0, 5)) /
      604800000,
  );
  const hash = (s: string) =>
    Array.from(s).reduce(
      (n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0,
      week >>> 0,
    );
  return people
    .filter(
      (p) =>
        p.id !== me.id &&
        p.discoverable &&
        p.membership_status === "approved" &&
        p.city.toLocaleLowerCase("uk") === me.city.toLocaleLowerCase("uk"),
    )
    .map((p) => {
      const interests = p.interests.filter((i) => me.interests.includes(i));
      const times = (p.availability ?? []).filter((i) =>
        me.availability?.includes(i),
      );
      const district =
        !!me.district &&
        p.district?.toLocaleLowerCase("uk") ===
          me.district.toLocaleLowerCase("uk");
      return {
        profile: p,
        score: interests.length * 3 + times.length * 2 + (district ? 2 : 0),
        reasons: [
          ...interests.map((i) => `Спільний інтерес: ${i}`),
          ...times.map((i) => availabilityLabels[i]),
          ...(district ? [`Один район: ${p.district}`] : []),
          ...(!interests.length && !times.length && !district
            ? [`Ваше місто: ${p.city}`]
            : []),
        ],
        tie: hash(p.id + me.id),
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.tie - b.tie ||
        a.profile.id.localeCompare(b.profile.id),
    )
    .slice(0, 3);
}
