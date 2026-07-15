export const marketsSocialProviderIds = ["google"] as const;

export type MarketsSocialProviderId = (typeof marketsSocialProviderIds)[number];
