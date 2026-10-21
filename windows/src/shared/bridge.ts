import type { DashboardState, SettingsInput } from "./snapshot";

export interface WorkPriceBridge {
  getState(): Promise<DashboardState>;
  toggle(): Promise<DashboardState>;
  applySettings(input: SettingsInput): Promise<{ ok: boolean; state: DashboardState }>;
  clearError(): Promise<DashboardState>;
  hideWindow(): Promise<void>;
  openSettings(): Promise<void>;
  closeSettings(): Promise<void>;
  onState(listener: (state: DashboardState) => void): () => void;
}
