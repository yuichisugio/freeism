export type MarketsLogEvent = {
  eventCode: string;
  requestId: string;
  auctionId?: string;
  settlementId?: string;
  workflowId?: string;
  outboxId?: string;
};

export function logMarketsEvent(event: MarketsLogEvent) {
  console.log(JSON.stringify(event));
}
