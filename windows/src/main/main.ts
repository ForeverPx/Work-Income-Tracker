import { app, ipcMain, session } from "electron";
import fs from "fs";
import path from "path";
import { DateTime } from "luxon";
import { WorkStateStore } from "../state/workStateStore";
import { FilePersistence, MemoryPersistence } from "../state/persistence";
import { toDashboardState, type SettingsInput } from "../shared/snapshot";
import { createWindowController, type WindowController } from "./windowManager";

app.setName("WorkPrice");
app.setAppUserModelId("com.foreverpx.workprice");

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(() => {
    start();
  });
}

function start(): void {
  blockRemoteRequests();
  const store = openStore();

  if (process.env.WORKPRICE_SMOKE === "1") {
    app.exit(runSmoke(store));
    return;
  }

  let windows: WindowController;
  const publish = () => {
    windows.broadcast("state:updated", toDashboardState(store));
    windows.updateTray(store.isWorking);
  };

  windows = createWindowController(
    store,
    () => {
      store.toggleWorking(new Date());
      publish();
    },
    () => {
      publish();
    },
  );

  ipcMain.handle("state:get", () => toDashboardState(store));
  ipcMain.handle("work:toggle", () => {
    store.toggleWorking(new Date());
    publish();
    return toDashboardState(store);
  });
  ipcMain.handle("settings:apply", (_event, input: SettingsInput) => {
    const ok = store.applySettings(
      String(input?.ratePerSecondText ?? ""),
      Number(input?.workStartMinutes),
      Number(input?.workEndMinutes),
      Boolean(input?.paysAfterWork),
    );
    publish();
    return { ok, state: toDashboardState(store) };
  });
  ipcMain.handle("settings:clear-error", () => {
    store.clearError();
    publish();
    return toDashboardState(store);
  });
  ipcMain.handle("window:hide-dashboard", () => {
    windows.hideDashboard();
  });
  ipcMain.handle("window:open-settings", () => {
    windows.openSettings();
  });
  ipcMain.handle("window:close-settings", () => {
    windows.closeSettings();
  });

  const timer = setInterval(() => {
    store.tick(new Date());
    publish();
  }, 1000);

  app.on("second-instance", () => {
    windows.showDashboard();
  });
  app.on("before-quit", () => {
    windows.prepareToQuit();
    clearInterval(timer);
  });

  windows.updateTray(store.isWorking);
  windows.showDashboardInactive();
  publish();
}

function openStore(): WorkStateStore {
  const directory = app.getPath("userData");
  const filePath = path.join(directory, "workprice-data.json");
  try {
    fs.mkdirSync(directory, { recursive: true });
    return new WorkStateStore({ persistence: new FilePersistence(filePath) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new WorkStateStore({
      persistence: new MemoryPersistence(),
      persistenceWarning: `本地数据无法打开，本次运行的数据不会持久保存：${message}`,
    });
  }
}

function blockRemoteRequests(): void {
  const allowed = ["file:", "devtools:", "chrome-extension:"];
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const ok = allowed.some((prefix) => details.url.startsWith(prefix));
    callback({ cancel: !ok });
  });
}

function runSmoke(store: WorkStateStore): number {
  const noon = DateTime.fromObject(
    { year: 2026, month: 8, day: 11, hour: 12, minute: 0, second: 0, millisecond: 0 },
    { zone: store.timeZone },
  ).toJSDate();
  store.toggleWorking(noon);
  store.tick(new Date(noon.getTime() + 60_000));
  const summary = store.summary;
  const output = {
    isWorking: store.isWorking,
    sessions: store.sessions.length,
    workedSeconds: summary.workedDuration,
    earned: summary.earned.toFixed(),
    warning: store.persistenceWarning,
  };
  const destination = process.env.WORKPRICE_SMOKE_OUT;
  if (destination) {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, `${JSON.stringify(output)}\n`, "utf8");
  } else {
    console.log(JSON.stringify(output));
  }
  if (!output.isWorking || output.sessions !== 1 || output.workedSeconds !== 60) {
    return 1;
  }
  return 0;
}
