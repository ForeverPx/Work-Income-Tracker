import { contextBridge, ipcRenderer } from "electron";
import type { DashboardState } from "../shared/snapshot";
import type { WorkPriceBridge } from "../shared/bridge";

const api: WorkPriceBridge = {
  getState: () => ipcRenderer.invoke("state:get"),
  toggle: () => ipcRenderer.invoke("work:toggle"),
  applySettings: (input) => ipcRenderer.invoke("settings:apply", input),
  clearError: () => ipcRenderer.invoke("settings:clear-error"),
  hideWindow: () => ipcRenderer.invoke("window:hide-dashboard"),
  openSettings: () => ipcRenderer.invoke("window:open-settings"),
  closeSettings: () => ipcRenderer.invoke("window:close-settings"),
  onState: (listener) => {
    const channel = "state:updated";
    const wrapped = (_event: unknown, state: DashboardState) => listener(state);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
};

contextBridge.exposeInMainWorld("workprice", api);
