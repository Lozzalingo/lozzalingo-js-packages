import type { TaskSectionTypeConfig, TaskSection, BookingConfig, ProductPricing } from "./types";

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

/** Calculate the price for a single add-on */
export function getAddOnPricePence(
  addonId: string,
  groupSize: number,
  config: BookingConfig
): number {
  const addon = config.addOns?.find((a) => a.id === addonId && a.enabled);
  if (!addon) return 0;
  if (addon.pricingType === "flat") return addon.priceFlat ?? 0;
  return groupSize * addon.pricePP;
}

export function calculateTotal(
  groupSize: number,
  taskSections: TaskSection[],
  wantsMedals: boolean,
  wantsPhotoPrints: boolean,
  travelChargePence: number,
  config: BookingConfig,
  sectionTypes: TaskSectionTypeConfig[],
  pricingOverride?: ProductPricing
): number {
  const pricePerPerson = pricingOverride?.pricePerPerson ?? config.pricePerPerson;
  const minReserve = pricingOverride?.minReserve ?? config.minReserve;

  const base = Math.max(groupSize * pricePerPerson, minReserve);
  let extras = travelChargePence;
  for (const s of taskSections) {
    if (s.type === "miscellaneous" && s.miscTheme === "bespoke") extras += config.miscBespokePrice;
    extras += getTaskSectionPricePence(s.type, sectionTypes, config.bespokeSectonPrice);
  }
  if (wantsMedals) extras += getAddOnPricePence("medals", groupSize, config);
  if (wantsPhotoPrints) extras += getAddOnPricePence("photo-prints", groupSize, config);
  return base + extras;
}
