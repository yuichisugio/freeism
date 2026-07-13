import type { AuctionTransitionSnapshot } from "../db/d1-auction-transition-repository";

export function nextAuctionAlarmAt(snapshot: AuctionTransitionSnapshot): number | null {
  if (snapshot.status === "SCHEDULED") return Date.parse(snapshot.startsAt);
  if (snapshot.status === "OPEN") return Date.parse(snapshot.endsAt);
  return null;
}
