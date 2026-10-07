/** Guard lite settings live in user_settings.guard_mode as "off" or "checkins_<minutes>". */
export const CHECKIN_INTERVALS = [10, 15, 25] as const;

export function parseGuard(mode: string | null | undefined): { on: boolean; interval: number } {
  if (mode === "off") return { on: false, interval: 15 };
  const m = /^checkins_(\d+)$/.exec(mode ?? "");
  const n = m ? Number(m[1]) : 15;
  return { on: true, interval: (CHECKIN_INTERVALS as readonly number[]).includes(n) ? n : 15 };
}

export function guardMode(on: boolean, interval: number) {
  return on ? `checkins_${interval}` : "off";
}

export type Focus = { minutes_on_task: number; checkins: number; switches: number; detours: number; away_minutes: number };

export function focusFromEvents(
  events: { type: string | null; text: string | null }[],
  workedMinutes: number,
): Focus {
  let checkins = 0, switches = 0, away = 0, switchedAway = 0;
  for (const e of events) {
    const mins = Number(e.text?.match(/^(\d+) min/)?.[1] ?? 0);
    if (e.type === "checkin") checkins++;
    if (e.type === "switch") { switches++; if (mins) { away += mins; switchedAway += mins; } }
    if (e.type === "away_ok") away += mins;
    if (e.type === "back_on_track") away += mins;
  }
  return {
    minutes_on_task: Math.max(0, Math.round(workedMinutes - switchedAway)),
    checkins,
    switches,
    detours: switches,
    away_minutes: away,
  };
}
