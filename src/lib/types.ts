import type { CategoryId } from "../data/categories";
import type { Lang } from "../i18n/strings";

export interface LifeEvent {
  id: string;
  districtId: string;
  category: CategoryId;
  year?: number;
  note?: string;
  /** Manual ordering for the timeline. Lower comes first. */
  order: number;
}

export interface PlaceNote {
  districtId: string;
  /** "This city changed my life." */
  text: string;
}

export interface LifeMap {
  schema: 1;
  id: string;
  /** Optional first name, used for "Kamrul's Bangladesh". */
  name: string;
  /** Custom title. Empty string means "derive from name". */
  title: string;
  language: Lang;
  events: LifeEvent[];
  places: PlaceNote[];
  /** One line about the whole journey, shown on the share image. */
  quote?: string;
  createdAt: string;
  updatedAt: string;
}
