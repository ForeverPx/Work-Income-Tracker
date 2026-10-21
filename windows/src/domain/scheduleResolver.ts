import { DateTime } from "luxon";
import type { ScheduleWindow } from "./types";

export function systemTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/**
 * Port of WorkPrice/Domain/ScheduleResolver.swift.
 *
 * Same-day shifts (start < end) account from local midnight to the next midnight.
 * Overnight shifts (start > end) account from one shift start to the next, and the
 * daytime gap after shift end still belongs to the shift that started the evening before.
 */
export class ScheduleResolver {
  readonly timeZone: string;

  constructor(timeZone: string = systemTimeZone()) {
    this.timeZone = timeZone;
  }

  window(date: Date, startMinutes: number, endMinutes: number): ScheduleWindow {
    const dayStart = this.startOfDay(date);

    if (startMinutes < endMinutes) {
      const nextDay = dayStart.plus({ days: 1 });
      return {
        shiftStartsAt: this.makeDate(dayStart, startMinutes),
        shiftEndsAt: this.makeDate(dayStart, endMinutes),
        accountingStartsAt: dayStart.toJSDate(),
        accountingEndsAt: nextDay.toJSDate(),
      };
    }

    const local = this.zoned(date);
    const minuteOfDay = local.hour * 60 + local.minute;
    const shiftStartDay = minuteOfDay >= startMinutes ? dayStart : dayStart.minus({ days: 1 });
    const shiftEndDay = shiftStartDay.plus({ days: 1 });
    return {
      shiftStartsAt: this.makeDate(shiftStartDay, startMinutes),
      shiftEndsAt: this.makeDate(shiftEndDay, endMinutes),
      accountingStartsAt: this.makeDate(shiftStartDay, startMinutes),
      accountingEndsAt: this.makeDate(shiftEndDay, startMinutes),
    };
  }

  private zoned(date: Date): DateTime {
    return DateTime.fromJSDate(date, { zone: this.timeZone });
  }

  private startOfDay(date: Date): DateTime {
    return this.zoned(date).startOf("day");
  }

  /**
   * Mirrors Calendar.date(bySettingHour:minute:second:of:matchingPolicy:.nextTime,
   * repeatedTimePolicy:.first, direction:.forward).
   * Missing spring-forward times move forward to the next valid local minute.
   * Repeated fall-back times use the earlier occurrence.
   */
  private makeDate(dayStart: DateTime, minutes: number): Date {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const exact = DateTime.fromObject(
      {
        year: dayStart.year,
        month: dayStart.month,
        day: dayStart.day,
        hour,
        minute,
        second: 0,
        millisecond: 0,
      },
      { zone: this.timeZone },
    );
    if (exact.isValid) {
      return earlierAmbiguous(exact, this.timeZone, dayStart, hour, minute).toJSDate();
    }

    let cursor = dayStart.startOf("day");
    const target = hour * 60 + minute;
    for (let step = 0; step < 24 * 60 + 180; step += 1) {
      if (cursor.isValid && cursor.hour * 60 + cursor.minute >= target) {
        return cursor.set({ second: 0, millisecond: 0 }).toJSDate();
      }
      const next = cursor.plus({ minutes: 1 });
      if (!next.isValid || next.day !== dayStart.day) {
        break;
      }
      cursor = next;
    }
    throw new Error(
      `无法在 ${this.timeZone} 解析当地时间 ${hour}:${String(minute).padStart(2, "0")}`,
    );
  }
}

/**
 * Luxon may resolve a repeated local time to the later offset.
 * Calendar.repeatedTimePolicy = .first keeps the earlier instant.
 */
function earlierAmbiguous(
  resolved: DateTime,
  timeZone: string,
  dayStart: DateTime,
  hour: number,
  minute: number,
): DateTime {
  const earlier = resolved.minus({ hours: 1 });
  if (!earlier.isValid) {
    return resolved;
  }
  const sameLocal =
    earlier.zoneName === timeZone &&
    earlier.year === dayStart.year &&
    earlier.month === dayStart.month &&
    earlier.day === dayStart.day &&
    earlier.hour === hour &&
    earlier.minute === minute;
  if (sameLocal && earlier.toMillis() < resolved.toMillis()) {
    return earlier.set({ second: 0, millisecond: 0 });
  }
  return resolved;
}
