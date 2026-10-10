/** Email preferences for one identity: the per-context master plus every category. */
export type NotificationPrefs = { master: boolean; categories: Record<string, boolean> };

/** A partial update: any of the master switch and a subset of categories. */
export type NotificationPrefsPatch = { master?: boolean; categories?: Record<string, boolean> };
