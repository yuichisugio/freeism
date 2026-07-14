import type { AuctionRoom } from "./auction-room";

export async function dispatchAuctionSchedule(
  namespace: DurableObjectNamespace<AuctionRoom>,
  auctionId: string,
  revisionId: string,
  dueAt: string,
) {
  await namespace.getByName(auctionId).ensureRevisionSchedule(auctionId, revisionId, dueAt);
}
