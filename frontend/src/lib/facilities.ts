export const OSU_FACILITY_SLUG = "osu-structure-1";
export const BRIGHTON_FACILITY_SLUG = "brighton-ski-resort";

export type FacilityType = "garage" | "surface_lot";
export type FacilitySource = "demo" | "yolo_plus_mock";
export type FacilitySectionLabel = "Level" | "Zone";

export interface FacilityDefinition {
  slug: string;
  name: string;
  type: FacilityType;
  sectionLabel: FacilitySectionLabel;
  source: FacilitySource;
}

export const FACILITIES = {
  [OSU_FACILITY_SLUG]: {
    slug: OSU_FACILITY_SLUG,
    name: "OSU Parking Structure 1",
    type: "garage",
    sectionLabel: "Level",
    source: "demo",
  },
  [BRIGHTON_FACILITY_SLUG]: {
    slug: BRIGHTON_FACILITY_SLUG,
    name: "Brighton Ski Resort",
    type: "surface_lot",
    sectionLabel: "Zone",
    source: "yolo_plus_mock",
  },
} as const satisfies Record<string, FacilityDefinition>;

export type FacilitySlug = keyof typeof FACILITIES;

export function getFacility(slug: FacilitySlug): FacilityDefinition {
  return FACILITIES[slug];
}
