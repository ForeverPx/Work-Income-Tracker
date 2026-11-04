import {
  app,
  BrowserWindow,
  Menu,
  Tray,
  screen,
  type Rectangle,
  type WebPreferences,
} from "electron";
import fs from "fs";
import path from "path";
import type { WorkStateStore } from "../state/workStateStore";

const DASHBOARD_WIDTH = 340;
const DASHBOARD_HEIGHT = 430;
const SCREEN_MARGIN = 18;

interface SavedBounds {
  x: number;
  y: number;
}

export interface WindowController {
  showDashboard(): void;
  showDashboardInactive(): void;
  hideDashboard(): void;
  toggleDashboard(): void;
  openSettings(): void;
  closeSettings(): void;
  prepareToQuit(): void;
  updateTray(isWorking: boolean): void;
  broadcast(channel: string, payload: unknown): void;
}

export function createWindowController(
  store: WorkStateStore,
  onToggle: () => void,
  onOpenSettings: () => void,
): WindowController {
  let quitting = false;
  let dashboard: BrowserWindow | null = null;
  let settingsWindow: BrowserWindow | null = null;
  let tray: Tray | null = null;
  let trayWorking: boolean | null = null;

  const boundsPath = path.join(app.getPath("userData"), "window-bounds.json");

  function loadBounds(): SavedBounds | null {
    try {
      const parsed = JSON.parse(fs.readFileSync(boundsPath, "utf8")) as Partial<SavedBounds>;
      if (typeof parsed.x !== "number" || typeof parsed.y !== "number") {
        return null;
      }
      if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) {
        return null;
      }
      return { x: parsed.x, y: parsed.y };
    } catch {
      return null;
    }
  }

  function saveBounds(bounds: SavedBounds): void {
    try {
      fs.mkdirSync(path.dirname(boundsPath), { recursive: true });
      fs.writeFileSync(boundsPath, `${JSON.stringify(bounds)}\n`, "utf8");
    } catch (error) {
      console.error("无法保存浮窗位置", error);
    }
  }

  function defaultOrigin(): SavedBounds {
    const area = screen.getPrimaryDisplay().workArea;
    return {
      x: Math.round(area.x + area.width - DASHBOARD_WIDTH - SCREEN_MARGIN),
      y: Math.round(area.y + area.height - DASHBOARD_HEIGHT - SCREEN_MARGIN),
    };
  }

  function clampOrigin(origin: SavedBounds, area: Rectangle): SavedBounds {
    const minX = area.x + SCREEN_MARGIN;
    const minY = area.y + SCREEN_MARGIN;
    const maxX = area.x + area.width - DASHBOARD_WIDTH - SCREEN_MARGIN;
    const maxY = area.y + area.height - DASHBOARD_HEIGHT - SCREEN_MARGIN;
    return {
      x: Math.round(clamp(origin.x, minX, maxX)),
      y: Math.round(clamp(origin.y, minY, maxY)),
    };
  }

  function placeDashboard(win: BrowserWindow): void {
    const current = win.getBounds();
    const display = screen.getDisplayMatching(current);
    const saved = loadBounds() ?? { x: current.x, y: current.y };
    const next = clampOrigin(saved, display.workArea);
    win.setBounds({
      x: next.x,
      y: next.y,
      width: DASHBOARD_WIDTH,
      height: DASHBOARD_HEIGHT,
    });
  }

  function harden(win: BrowserWindow): void {
    win.setMenu(null);
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (event) => event.preventDefault());
  }

  function ensureDashboard(): BrowserWindow {
    if (dashboard && !dashboard.isDestroyed()) {
      return dashboard;
    }
    const origin = clampOrigin(
      loadBounds() ?? defaultOrigin(),
      screen.getPrimaryDisplay().workArea,
    );
    const win = new BrowserWindow({
      width: DASHBOARD_WIDTH,
      height: DASHBOARD_HEIGHT,
      x: origin.x,
      y: origin.y,
      show: false,
      frame: false,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: true,
      title: "秒薪浮窗",
      backgroundColor: "#00000000",
      webPreferences: webPreferences(),
    });
    harden(win);
    win.setAlwaysOnTop(true, "floating");
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.on("moved", () => {
      if (win.isDestroyed()) {
        return;
      }
      const [x, y] = win.getPosition();
      saveBounds({ x, y });
    });
    win.on("close", (event) => {
      if (!quitting) {
        event.preventDefault();
        win.hide();
      }
    });
    win.on("maximize", () => {
      if (!win.isDestroyed()) {
        win.unmaximize();
      }
    });
    void win.loadFile(rendererFile("dashboard.html"));
    dashboard = win;
    return win;
  }

  function showDashboard(): void {
    const win = ensureDashboard();
    placeDashboard(win);
    win.show();
  }

  function showDashboardInactive(): void {
    const win = ensureDashboard();
    placeDashboard(win);
    win.showInactive();
  }

  function hideDashboard(): void {
    if (dashboard && !dashboard.isDestroyed()) {
      dashboard.hide();
    }
  }

  function openSettings(): void {
    onOpenSettings();
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.show();
      settingsWindow.focus();
      return;
    }
    const win = new BrowserWindow({
      width: 480,
      height: 560,
      show: false,
      resizable: false,
      minimizable: true,
      maximizable: false,
      fullscreenable: false,
      autoHideMenuBar: true,
      title: "秒薪设置",
      backgroundColor: "#2b2b2e",
      webPreferences: webPreferences(),
    });
    harden(win);
    win.setAlwaysOnTop(true, "floating");
    win.once("ready-to-show", () => {
      if (!win.isDestroyed()) {
        win.show();
      }
    });
    win.on("closed", () => {
      settingsWindow = null;
      store.clearError();
    });
    void win.loadFile(rendererFile("settings.html"));
    settingsWindow = win;
  }

  function closeSettings(): void {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
    }
  }

  function updateTray(isWorking: boolean): void {
    if (!tray) {
      tray = new Tray(trayIconPath());
      tray.setToolTip("秒薪浮窗");
      tray.on("double-click", () => showDashboard());
    }
    if (trayWorking === isWorking) {
      return;
    }
    trayWorking = isWorking;
    const menu = Menu.buildFromTemplate([
      {
        label: isWorking ? "暂停休息" : "开始工作",
        click: () => onToggle(),
      },
      { type: "separator" },
      { label: "显示浮窗", click: () => showDashboard() },
      { label: "隐藏浮窗", click: () => hideDashboard() },
      { label: "设置…", click: () => openSettings() },
      { type: "separator" },
      {
        label: "退出秒薪",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]);
    tray.setContextMenu(menu);
  }

  screen.on("display-metrics-changed", () => {
    if (dashboard && !dashboard.isDestroyed() && dashboard.isVisible()) {
      placeDashboard(dashboard);
    }
  });
  screen.on("display-removed", () => {
    if (dashboard && !dashboard.isDestroyed()) {
      placeDashboard(dashboard);
    }
  });

  return {
    showDashboard,
    showDashboardInactive,
    hideDashboard,
    toggleDashboard() {
      const win = ensureDashboard();
      if (win.isVisible()) {
        hideDashboard();
      } else {
        showDashboard();
      }
    },
    openSettings,
    closeSettings,
    prepareToQuit() {
      quitting = true;
    },
    updateTray,
    broadcast(channel, payload) {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send(channel, payload);
        }
      }
    },
  };
}

function webPreferences(): WebPreferences {
  return {
    preload: path.join(__dirname, "preload.js"),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  };
}

function rendererFile(name: string): string {
  return path.join(__dirname, "renderer", name);
}

function trayIconPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "tray.png");
  }
  return path.join(__dirname, "..", "build", "tray.png");
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}
