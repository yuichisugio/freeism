export interface WebSocketAttachment {
  auctionId: string;
  connectionId: string;
  lastBidSeq: number;
  marketsUserId: string;
}

export function readWebSocketAttachment(socket: WebSocket): WebSocketAttachment | null {
  const value = socket.deserializeAttachment();
  if (!value || typeof value !== "object") return null;
  const attachment = value as Partial<WebSocketAttachment>;
  if (
    typeof attachment.auctionId !== "string" ||
    typeof attachment.connectionId !== "string" ||
    !Number.isSafeInteger(attachment.lastBidSeq) ||
    typeof attachment.marketsUserId !== "string"
  ) {
    return null;
  }
  return attachment as WebSocketAttachment;
}
