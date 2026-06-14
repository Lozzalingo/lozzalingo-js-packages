import type { TaskSectionTypeConfig, TaskSection, BookingConfig } from "./types";

export function formatPence(pence: number): string {
  return `\u00A3${(pence / 100).toFixed(2)}`;
}

export function getTaskSectionPricePence(
  typeId: string,
  sectionTypes: TaskSectionTypeConfig[],
  fallbackBespokePrice: number = 3000
): number {
  const cfg = sectionTypes.find((t) => t.id === typeId);
  if (cfg) return Math.round(parseFloat(cfg.pricePounds || "0") * 100);
  if (typeId === "bespoke") return fallbackBespokePrice;
  return 0;
}

export function calculateTotal(
  groupSize: number,
  taskSections: TaskSection[],
  wantsMedals: boolean,
  wantsPhotoPrints: boolean,
  travelChargePence: number,
  config: BookingConfig,
  sectionTypes: TaskSectionTypeConfig[]
): number {
  const base = Math.max(groupSize * config.pricePerPerson, config.minReserve);
  let addOns = travelChargePence;
  for (const s of taskSections) {
    if (s.type === "miscellaneous" && s.miscTheme === "bespoke") addOns += config.miscBespokePrice;
    addOns += getTaskSectionPricePence(s.type, sectionTypes, config.bespokeSectonPrice);
  }
  if (wantsMedals) addOns += groupSize * config.medalsPricePP;
  if (wantsPhotoPrints) addOns += groupSize * config.photoPrintsPricePP;
  return base + addOns;
}
