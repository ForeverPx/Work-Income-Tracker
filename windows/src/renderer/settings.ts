import "./globals";
import type { DashboardState } from "../shared/snapshot";
import { formatHourlyRate, minutesToTimeValue, scheduleHint, timeValueToMinutes } from "../shared/format";

const rateInput = document.querySelector<HTMLInputElement>("#rate");
const hourly = document.querySelector<HTMLElement>("#hourly");
const hourlyValue = document.querySelector<HTMLElement>("#hourly-value");
const startInput = document.querySelector<HTMLInputElement>("#start");
const endInput = document.querySelector<HTMLInputElement>("#end");
const paysInput = document.querySelector<HTMLInputElement>("#pays");
const hint = document.querySelector<HTMLElement>("#hint");
const warning = document.querySelector<HTMLElement>("#warning");
const error = document.querySelector<HTMLElement>("#error");

let loaded = false;

function readMinutes(input: HTMLInputElement | null, fallback: number): number {
  const parsed = timeValueToMinutes(input?.value ?? "");
  return parsed ?? fallback;
}

function renderDerived(): void {
  const rateText = rateInput?.value ?? "";
  const hourlyText = formatHourlyRate(rateText);
  if (hourly && hourlyValue) {
    hourly.hidden = hourlyText === null;
    if (hourlyText) {
      hourlyValue.textContent = `¥${hourlyText} / 小时`;
    }
  }
  const start = readMinutes(startInput, -1);
  const end = readMinutes(endInput, -1);
  if (hint && start >= 0 && end >= 0) {
    hint.textContent = scheduleHint(start, end, Boolean(paysInput?.checked));
  }
}

function renderMessages(state: DashboardState): void {
  if (warning) {
    warning.hidden = !state.persistenceWarning;
    warning.textContent = state.persistenceWarning ?? "";
  }
  if (error) {
    error.hidden = !state.lastError;
    error.textContent = state.lastError ?? "";
  }
}

function fill(state: DashboardState): void {
  if (rateInput) {
    rateInput.value = state.settings.ratePerSecondText;
  }
  if (startInput) {
    startInput.value = minutesToTimeValue(state.settings.workStartMinutes);
  }
  if (endInput) {
    endInput.value = minutesToTimeValue(state.settings.workEndMinutes);
  }
  if (paysInput) {
    paysInput.checked = state.settings.paysAfterWork;
  }
  renderDerived();
  renderMessages(state);
}

function render(state: DashboardState): void {
  if (!loaded) {
    fill(state);
    loaded = true;
    return;
  }
  renderMessages(state);
}

rateInput?.addEventListener("input", renderDerived);
startInput?.addEventListener("input", renderDerived);
endInput?.addEventListener("input", renderDerived);
paysInput?.addEventListener("change", renderDerived);

document.querySelector("#cancel")?.addEventListener("click", () => {
  void window.workprice.clearError().then(() => window.workprice.closeSettings());
});

document.querySelector("#save")?.addEventListener("click", () => {
  const start = readMinutes(startInput, -1);
  const end = readMinutes(endInput, -1);
  void window.workprice
    .applySettings({
      ratePerSecondText: rateInput?.value ?? "",
      workStartMinutes: start,
      workEndMinutes: end,
      paysAfterWork: Boolean(paysInput?.checked),
    })
    .then((result) => {
      renderMessages(result.state);
      if (result.ok) {
        void window.workprice.closeSettings();
      }
    });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    void window.workprice.clearError().then(() => window.workprice.closeSettings());
  }
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey || event.target === document.body)) {
    document.querySelector<HTMLButtonElement>("#save")?.click();
  }
});

window.workprice.onState(render);
void window.workprice.getState().then(render);
