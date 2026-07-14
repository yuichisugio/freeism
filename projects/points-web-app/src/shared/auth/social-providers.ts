export const pointsSocialProviderIds = ["google", "github"] as const;

export type PointsSocialProviderId = (typeof pointsSocialProviderIds)[number];
