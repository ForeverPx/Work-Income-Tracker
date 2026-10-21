import type { WorkPriceBridge } from "../shared/bridge";

declare global {
  interface Window {
    workprice: WorkPriceBridge;
  }
}

export {};
