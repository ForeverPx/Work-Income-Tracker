import fs from "fs";
import path from "path";
import type { AppSettings, WorkSession } from "../domain/types";
import { defaultSettings } from "../domain/types";

export interface PersistedState {
  version: 1;
  settings: AppSettings;
  sessions: WorkSession[];
}

export interface Persistence {
  load(): PersistedState | null;
  save(state: PersistedState): void;
}

interface SessionJson {
  id: string;
  startedAt: string;
  endedAt: string | null;
  ratePerSecondText: string;
  shiftEndsAt: string;
  paidStartsAt: string | null;
  accountingStartsAt: string;
  accountingEndsAt: string;
  paysAfterWork: boolean;
}

interface SettingsJson {
  id?: string;
  ratePerSecondText: string;
  workStartMinutes: number;
  workEndMinutes: number;
  paysAfterWork: boolean;
}

interface FileJson {
  version: number;
  settings: SettingsJson;
  sessions: SessionJson[];
}

export class MemoryPersistence implements Persistence {
  private state: PersistedState | null = null;

  load(): PersistedState | null {
    return this.state ? cloneState(this.state) : null;
  }

  save(state: PersistedState): void {
    this.state = cloneState(state);
  }
}

export class FilePersistence implements Persistence {
  constructor(private readonly filePath: string) {}

  load(): PersistedState | null {
    if (!fs.existsSync(this.filePath)) {
      return null;
    }
    const raw = fs.readFileSync(this.filePath, "utf8");
    return parsePersisted(raw);
  }

  save(state: PersistedState): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });
    const payload = `${JSON.stringify(serialize(state), null, 2)}\n`;
    const temporary = `${this.filePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, payload, "utf8");
    try {
      fs.renameSync(temporary, this.filePath);
    } catch (error) {
      try {
        fs.rmSync(this.filePath, { force: true });
        fs.renameSync(temporary, this.filePath);
      } catch (renameError) {
        fs.rmSync(temporary, { force: true });
        throw renameError instanceof Error ? renameError : error;
      }
    }
  }
}

export function parsePersisted(raw: string): PersistedState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`数据文件不是有效的 JSON（${message}）`);
  }
  if (!isRecord(parsed)) {
    throw new Error("数据文件格式不正确");
  }
  if (parsed.version !== 1) {
    throw new Error(`不支持的数据版本：${String(parsed.version)}`);
  }
  if (!isRecord(parsed.settings) || !Array.isArray(parsed.sessions)) {
    throw new Error("数据文件缺少设置或工作记录");
  }
  return {
    version: 1,
    settings: parseSettings(parsed.settings),
    sessions: parsed.sessions.map((session, index) => parseSession(session, index)),
  };
}

function parseSettings(value: Record<string, unknown>): AppSettings {
  const fallback = defaultSettings();
  const rate = value.ratePerSecondText;
  const start = value.workStartMinutes;
  const end = value.workEndMinutes;
  const pays = value.paysAfterWork;
  if (typeof rate !== "string" || typeof start !== "number" || typeof end !== "number" || typeof pays !== "boolean") {
    throw new Error("设置字段不完整");
  }
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    throw new Error("上下班时间必须是整数分钟");
  }
  return {
    id: typeof value.id === "string" && value.id.length > 0 ? value.id : fallback.id,
    ratePerSecondText: rate,
    workStartMinutes: start,
    workEndMinutes: end,
    paysAfterWork: pays,
  };
}

function parseSession(value: unknown, index: number): WorkSession {
  if (!isRecord(value)) {
    throw new Error(`第 ${index + 1} 条工作记录格式不正确`);
  }
  const id = value.id;
  const rate = value.ratePerSecondText;
  const pays = value.paysAfterWork;
  if (typeof id !== "string" || typeof rate !== "string" || typeof pays !== "boolean") {
    throw new Error(`第 ${index + 1} 条工作记录字段不完整`);
  }
  return {
    id,
    startedAt: parseInstant(value.startedAt, `第 ${index + 1} 条工作记录的开始时间`),
    endedAt: value.endedAt == null ? null : parseInstant(value.endedAt, `第 ${index + 1} 条工作记录的结束时间`),
    ratePerSecondText: rate,
    shiftEndsAt: parseInstant(value.shiftEndsAt, `第 ${index + 1} 条工作记录的下班时间`),
    paidStartsAt:
      value.paidStartsAt == null
        ? null
        : parseInstant(value.paidStartsAt, `第 ${index + 1} 条工作记录的计薪开始时间`),
    accountingStartsAt: parseInstant(value.accountingStartsAt, `第 ${index + 1} 条工作记录的账期开始`),
    accountingEndsAt: parseInstant(value.accountingEndsAt, `第 ${index + 1} 条工作记录的账期结束`),
    paysAfterWork: pays,
  };
}

function parseInstant(value: unknown, label: string): Date {
  if (typeof value !== "string") {
    throw new Error(`${label}无效`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label}无效`);
  }
  return date;
}

function serialize(state: PersistedState): FileJson {
  return {
    version: 1,
    settings: { ...state.settings },
    sessions: state.sessions.map((session) => ({
      id: session.id,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt ? session.endedAt.toISOString() : null,
      ratePerSecondText: session.ratePerSecondText,
      shiftEndsAt: session.shiftEndsAt.toISOString(),
      paidStartsAt: session.paidStartsAt ? session.paidStartsAt.toISOString() : null,
      accountingStartsAt: session.accountingStartsAt.toISOString(),
      accountingEndsAt: session.accountingEndsAt.toISOString(),
      paysAfterWork: session.paysAfterWork,
    })),
  };
}

function cloneState(state: PersistedState): PersistedState {
  return parsePersisted(JSON.stringify(serialize(state)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
