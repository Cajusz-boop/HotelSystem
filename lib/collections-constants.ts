export const COLLECTION_STATUSES = [
  "IN_COLLECTION",
  "HANDED_TO_AGENCY",
  "PAID",
  "WRITTEN_OFF",
] as const;

export type CollectionStatus = (typeof COLLECTION_STATUSES)[number];
