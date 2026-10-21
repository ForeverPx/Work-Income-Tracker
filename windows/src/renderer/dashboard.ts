import "./globals";
import type { DashboardState } from "../shared/snapshot";

const statusDot = document.querySelector<HTMLElement>("#status-dot");
const statusLabel = document.querySelector<HTMLElement>("#status-label");
const dateLabel = document.querySelector<HTMLElement>("#date-label");
const warningButton = document.querySelector<HTMLButtonElement>("#warning");
const earned = document.querySelector<HTMLElement>("#earned");
const countdownLabel = document.querySelector<HTMLElement>("#countdown-label");
const countdown = document.querySelector<HTMLElement>("#countdown");
const rate = document.querySelector<HTMLElement>("#rate");
const worked = document.querySelector<HTMLElement>("#worked");
const unpaid = document.querySelector<HTMLElement>("#unpaid");
const workButton = document.querySelector<HTMLButtonElement>("#work-button");
const workLabel = document.querySelector<HTMLElement>("#work-label");

function render(state: DashboardState): void {
  const working = state.isWorking;
  statusDot?.classList.toggle("is-working", working);
  if (statusLabel) {
    statusLabel.textContent = working ? "工作中" : "休息中";
  }
  if (dateLabel) {
    dateLabel.textContent = state.dateLabel;
  }
  if (warningButton) {
    const warning = state.persistenceWarning;
    warningButton.hidden = !warning;
    warningButton.title = warning ?? "";
    warningButton.setAttribute("aria-label", warning ?? "数据警告");
  }
  if (earned) {
    earned.textContent = state.earnedText;
    fitEarnings(earned);
  }
  if (countdownLabel) {
    countdownLabel.textContent = state.countdownLabel;
  }
  if (countdown) {
    countdown.textContent = state.countdownText;
  }
  if (rate) {
    rate.textContent = `¥${state.rateText}`;
  }
  if (worked) {
    worked.textContent = state.workedText;
  }
  if (unpaid) {
    unpaid.textContent = state.unpaidText;
    unpaid.classList.toggle("is-highlight", state.unpaidHighlighted);
  }
  if (workButton && workLabel) {
    workButton.classList.toggle("is-working", working);
    workLabel.textContent = working ? "暂停休息" : "开始工作";
    workButton.setAttribute("aria-label", working ? "暂停休息" : "开始工作");
    workButton.setAttribute("aria-description", working ? "停止计时和计薪" : "开始计时和计薪");
  }
}

function fitEarnings(element: HTMLElement): void {
  const parent = element.parentElement;
  if (!parent) {
    return;
  }
  let size = 56;
  element.style.fontSize = `${size}px`;
  while (element.scrollWidth > parent.clientWidth && size > 28) {
    size -= 2;
    element.style.fontSize = `${size}px`;
  }
}

workButton?.addEventListener("click", () => {
  void window.workprice.toggle().then(render);
});

document.querySelector("#open-settings")?.addEventListener("click", () => {
  void window.workprice.openSettings();
});

document.querySelector("#hide-window")?.addEventListener("click", () => {
  void window.workprice.hideWindow();
});

window.workprice.onState(render);
void window.workprice.getState().then(render);
