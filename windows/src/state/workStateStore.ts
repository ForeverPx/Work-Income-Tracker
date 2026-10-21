import type { AppSettings, WorkSession, WorkSummary, ScheduleWindow } from "../domain/types";
import { defaultSettings } from "../domain/types";
import { PayCalculator, sessionInterval } from "../domain/payCalculator";
import { ScheduleResolver, systemTimeZone } from "../domain/scheduleResolver";
import { normalizeRateText, parseRate } from "../shared/money";
import { MemoryPersistence, type Persistence, type PersistedState } from "./persistence";

export interface WorkStateStoreOptions {
  persistence: Persistence;
  now?: Date;
  timeZone?: string;
  initialError?: string | null;
  persistenceWarning?: string | null;
}

/**
 * Port of WorkPrice/State/WorkStateStore.swift.
 * One store owns settings, sessions, and the clock. UI sends commands; it does not
 * accumulate pay itself. Each session snapshots the rate and overtime rule in effect
 * when it starts, so later edits do not rewrite history.
 */
export class WorkStateStore {
  private settingsState: AppSettings;
  private sessionState: WorkSession[];
  private nowState: Date;
  private errorState: string | null;
  private warningState: string | null;
  private persistence: Persistence;
  private readonly schedule: ScheduleResolver;
  private readonly payCalculator = new PayCalculator();

  constructor(options: WorkStateStoreOptions) {
    this.persistence = options.persistence;
    this.nowState = options.now ?? new Date();
    this.schedule = new ScheduleResolver(options.timeZone ?? systemTimeZone());
    this.warningState = options.persistenceWarning ?? null;
    this.errorState = options.initialError ?? null;
    this.settingsState = defaultSettings();
    this.sessionState = [];
    this.loadFromPersistence();
    this.rollOverActiveSessionIfNeeded(this.nowState);
    this.save();
  }

  get settings(): AppSettings {
    return this.settingsState;
  }

  get sessions(): WorkSession[] {
    return this.sessionState;
  }

  get now(): Date {
    return this.nowState;
  }

  get lastError(): string | null {
    return this.errorState;
  }

  get persistenceWarning(): string | null {
    return this.warningState;
  }

  get timeZone(): string {
    return this.schedule.timeZone;
  }

  get isWorking(): boolean {
    return this.activeSession !== null;
  }

  get currentWindow(): ScheduleWindow {
    return this.schedule.window(
      this.nowState,
      this.settingsState.workStartMinutes,
      this.settingsState.workEndMinutes,
    );
  }

  get summary(): WorkSummary {
    const window = this.currentWindow;
    const intervals = this.sessionState.flatMap((session) => {
      const end = session.endedAt ?? this.nowState;
      if (end.getTime() <= window.accountingStartsAt.getTime()) {
        return [];
      }
      if (session.startedAt.getTime() >= window.accountingEndsAt.getTime()) {
        return [];
      }
      return [sessionInterval(session)];
    });
    return this.payCalculator.summary(intervals, this.nowState, window, this.isWorking);
  }

  toggleWorking(at: Date = new Date()): void {
    this.tick(at);
    const snapshot = this.capture();
    const active = this.activeSession;
    if (active) {
      active.endedAt = new Date(at);
    } else {
      this.beginSession(at, null);
    }
    this.nowState = new Date(at);
    if (!this.save()) {
      this.restore(snapshot);
    }
  }

  applySettings(
    ratePerSecondText: string,
    workStartMinutes: number,
    workEndMinutes: number,
    paysAfterWork: boolean,
  ): boolean {
    const normalizedRate = normalizeRateText(ratePerSecondText);
    const rate = parseRate(normalizedRate);
    if (!rate) {
      this.errorState = "秒薪必须是大于 0 的数字。";
      return false;
    }
    const minuteRange = 24 * 60;
    if (
      !Number.isInteger(workStartMinutes) ||
      !Number.isInteger(workEndMinutes) ||
      workStartMinutes < 0 ||
      workEndMinutes < 0 ||
      workStartMinutes >= minuteRange ||
      workEndMinutes >= minuteRange ||
      workStartMinutes === workEndMinutes
    ) {
      this.errorState = "上班时间和下班时间必须不同。";
      return false;
    }

    const snapshot = this.capture();
    const previousActive = this.activeSession;
    const shouldResume = previousActive !== null;
    const wasWaitingForNextShift = previousActive?.paidStartsAt
      ? previousActive.paidStartsAt.getTime() > this.nowState.getTime()
      : false;
    if (previousActive) {
      previousActive.endedAt = new Date(this.nowState);
    }

    this.settingsState = {
      ...this.settingsState,
      id: this.settingsState.id || "singleton",
      ratePerSecondText: normalizedRate,
      workStartMinutes,
      workEndMinutes,
      paysAfterWork,
    };

    if (shouldResume) {
      const newWindow = this.schedule.window(
        this.nowState,
        this.settingsState.workStartMinutes,
        this.settingsState.workEndMinutes,
      );
      const paidStartsAt =
        wasWaitingForNextShift && !paysAfterWork && newWindow.shiftStartsAt.getTime() > this.nowState.getTime()
          ? newWindow.shiftStartsAt
          : null;
      this.beginSession(this.nowState, paidStartsAt);
    }

    this.errorState = null;
    const didSave = this.save();
    if (!didSave) {
      this.restore(snapshot);
    }
    return didSave;
  }

  clearError(): void {
    this.errorState = null;
  }

  tick(at: Date = new Date()): void {
    this.nowState = new Date(at);
    this.rollOverActiveSessionIfNeeded(this.nowState);
  }

  private get activeSession(): WorkSession | null {
    for (let index = this.sessionState.length - 1; index >= 0; index -= 1) {
      if (this.sessionState[index].endedAt === null) {
        return this.sessionState[index];
      }
    }
    return null;
  }

  private beginSession(at: Date, paidStartsAt: Date | null): WorkSession {
    const window = this.schedule.window(
      at,
      this.settingsState.workStartMinutes,
      this.settingsState.workEndMinutes,
    );
    const session: WorkSession = {
      id: crypto.randomUUID(),
      startedAt: new Date(at),
      endedAt: null,
      ratePerSecondText: this.settingsState.ratePerSecondText,
      shiftEndsAt: new Date(window.shiftEndsAt),
      paidStartsAt: paidStartsAt ? new Date(paidStartsAt) : null,
      accountingStartsAt: new Date(window.accountingStartsAt),
      accountingEndsAt: new Date(window.accountingEndsAt),
      paysAfterWork: this.settingsState.paysAfterWork,
    };
    this.sessionState.push(session);
    return session;
  }

  private rollOverActiveSessionIfNeeded(date: Date): void {
    let safetyCounter = 0;
    while (this.activeSession && date.getTime() >= this.activeSession.accountingEndsAt.getTime() && safetyCounter < 10_000) {
      const active = this.activeSession;
      const boundary = new Date(active.accountingEndsAt);
      const nextWindow = this.schedule.window(
        boundary,
        this.settingsState.workStartMinutes,
        this.settingsState.workEndMinutes,
      );
      if (nextWindow.accountingEndsAt.getTime() <= boundary.getTime()) {
        break;
      }
      active.endedAt = boundary;
      const carriesUnpaidOvertime = !active.paysAfterWork && boundary.getTime() >= active.shiftEndsAt.getTime();
      const paidStartsAt =
        carriesUnpaidOvertime && nextWindow.shiftStartsAt.getTime() > boundary.getTime()
          ? nextWindow.shiftStartsAt
          : null;
      this.beginSession(boundary, paidStartsAt);
      safetyCounter += 1;
    }
    if (safetyCounter > 0) {
      this.save();
    }
  }

  private loadFromPersistence(): void {
    try {
      const loaded = this.persistence.load();
      if (!loaded) {
        this.settingsState = defaultSettings();
        this.sessionState = [];
        return;
      }
      this.settingsState = { ...loaded.settings, id: loaded.settings.id || "singleton" };
      this.sessionState = loaded.sessions
        .slice()
        .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
    } catch (error) {
      this.settingsState = defaultSettings();
      this.sessionState = [];
      this.persistence = new MemoryPersistence();
      const message = error instanceof Error ? error.message : String(error);
      this.warningState = `本地数据无法打开，本次运行的数据不会持久保存：${message}`;
    }
  }

  private save(): boolean {
    try {
      this.persistence.save(this.toPersisted());
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.errorState = `保存本地数据失败：${message}`;
      return false;
    }
  }

  private toPersisted(): PersistedState {
    return {
      version: 1,
      settings: { ...this.settingsState },
      sessions: this.sessionState.map((session) => ({
        ...session,
        startedAt: new Date(session.startedAt),
        endedAt: session.endedAt ? new Date(session.endedAt) : null,
        shiftEndsAt: new Date(session.shiftEndsAt),
        paidStartsAt: session.paidStartsAt ? new Date(session.paidStartsAt) : null,
        accountingStartsAt: new Date(session.accountingStartsAt),
        accountingEndsAt: new Date(session.accountingEndsAt),
      })),
    };
  }

  private capture(): PersistedState {
    return this.toPersisted();
  }

  private restore(snapshot: PersistedState): void {
    this.settingsState = { ...snapshot.settings };
    this.sessionState = snapshot.sessions.map((session) => ({
      ...session,
      startedAt: new Date(session.startedAt),
      endedAt: session.endedAt ? new Date(session.endedAt) : null,
      shiftEndsAt: new Date(session.shiftEndsAt),
      paidStartsAt: session.paidStartsAt ? new Date(session.paidStartsAt) : null,
      accountingStartsAt: new Date(session.accountingStartsAt),
      accountingEndsAt: new Date(session.accountingEndsAt),
    }));
  }
}
