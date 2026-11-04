import type { WorkStateStore } from "../state/workStateStore";
import { formatClock, formatDateLabel, formatMoney, formatShortDuration } from "./format";

export interface SettingsInput {
  ratePerSecondText: string;
  workStartMinutes: number;
  workEndMinutes: number;
  paysAfterWork: boolean;
}

export interface DashboardState {
  isWorking: boolean;
  dateLabel: string;
  earnedText: string;
  countdownLabel: string;
  countdownText: string;
  rateText: string;
  workedText: string;
  unpaidText: string;
  unpaidHighlighted: boolean;
  persistenceWarning: string | null;
  lastError: string | null;
  settings: SettingsInput;
}

export function toDashboardState(store: WorkStateStore): DashboardState {
  const summary = store.summary;
  const countdownDone = summary.countdownDuration <= 0;
  return {
    isWorking: store.isWorking,
    dateLabel: formatDateLabel(store.now, store.timeZone),
    earnedText: formatMoney(summary.earned),
    countdownLabel: countdownDone ? "今日下班时间已到" : "距离下班",
    countdownText: formatClock(summary.countdownDuration),
    rateText: store.settings.ratePerSecondText,
    workedText: formatShortDuration(summary.workedDuration),
    unpaidText: formatShortDuration(summary.unpaidDuration),
    unpaidHighlighted: summary.unpaidDuration > 0,
    persistenceWarning: store.persistenceWarning,
    lastError: store.lastError,
    settings: {
      ratePerSecondText: store.settings.ratePerSecondText,
      workStartMinutes: store.settings.workStartMinutes,
      workEndMinutes: store.settings.workEndMinutes,
      paysAfterWork: store.settings.paysAfterWork,
    },
  };
}
