import { DurableObject } from "cloudflare:workers";

import { D1AuctionTransitionRepository } from "../db/d1-auction-transition-repository";
import { D1WebSocketLeaseRepository } from "../db/d1-websocket-lease-repository";
import { nextAuctionAlarmAt } from "./auction-lifecycle-scheduler";
import {
  executeAuctionCommand,
  type AuctionCommandResult,
  type ExecuteAuctionCommandInput,
} from "./execute-auction-command";
import { readWebSocketAttachment, type WebSocketAttachment } from "./websocket-attachment";

export interface AuctionRoomEvent {
  auctionId: string;
  auctionVersion: number;
  bidSeq: number;
  data: Record<string, unknown>;
  occurredAt: string;
  type: string;
}

function messageByteLength(message: string | ArrayBuffer) {
  return typeof message === "string"
    ? new TextEncoder().encode(message).byteLength
    : message.byteLength;
}

function publicEventValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicEventValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !/(?:token|autoBidMax)/i.test(key))
      .map(([key, nested]) => [key, publicEventValue(nested)]),
  );
}

export class AuctionRoom extends DurableObject<Env> {
  private readonly transitions = new D1AuctionTransitionRepository(this.env.DB);
  private readonly leases = new D1WebSocketLeaseRepository(this.env.DB);

  async executeCommand(input: ExecuteAuctionCommandInput): Promise<AuctionCommandResult> {
    await this.advanceDueTransitions(input.serverNow);
    const committed = await executeAuctionCommand(this.env.DB, input);
    if (!committed.replayed) {
      for (const event of committed.publicEvents) await this.broadcastCommitted(event);
    }
    return committed.result;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (
      url.pathname !== "/connect" ||
      request.headers.get("Upgrade")?.toLowerCase() !== "websocket"
    ) {
      return new Response("Not found", { status: 404 });
    }

    const attachment: WebSocketAttachment = {
      auctionId: request.headers.get("X-Auction-Id") ?? "",
      connectionId: request.headers.get("X-Connection-Id") ?? "",
      lastBidSeq: Number(request.headers.get("X-Last-Bid-Seq") ?? "0"),
      marketsUserId: request.headers.get("X-Markets-User-Id") ?? "",
    };
    if (
      !attachment.auctionId ||
      !attachment.connectionId ||
      !Number.isSafeInteger(attachment.lastBidSeq) ||
      attachment.lastBidSeq < 0 ||
      !attachment.marketsUserId
    ) {
      return new Response("Invalid connection metadata", { status: 400 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    try {
      server.serializeAttachment(attachment);
      this.ctx.acceptWebSocket(server, [attachment.connectionId]);
      await this.advanceDueTransitions(new Date().toISOString());
      const snapshot = await this.transitions.findCurrent(attachment.auctionId);
      if (snapshot) {
        server.send(
          JSON.stringify({
            auctionId: snapshot.auctionId,
            auctionVersion: snapshot.version,
            bidSeq: snapshot.lastBidSeq,
            data: { status: snapshot.status },
            occurredAt: new Date().toISOString(),
            type: "auction.snapshot",
          } satisfies AuctionRoomEvent),
        );
      }
      return new Response(null, { status: 101, webSocket: client });
    } catch (error) {
      await this.leases.release(attachment.connectionId, attachment.marketsUserId);
      throw error;
    }
  }

  async ensureRevisionSchedule(
    auctionId: string,
    revisionId: string,
    dueAt: string,
  ): Promise<void> {
    const snapshot = await this.transitions.findCurrent(auctionId);
    if (!snapshot || snapshot.currentRevisionId !== revisionId) return;
    await this.ctx.storage.put({ auctionId, dueAt, revisionId });
    await this.advanceDueTransitions(new Date().toISOString());
  }

  async advanceDueTransitions(serverNow: string): Promise<void> {
    const auctionId = this.ctx.id.name;
    if (!auctionId) return;
    const now = Date.parse(serverNow);
    for (let index = 0; index < 2; index += 1) {
      const snapshot = await this.transitions.findCurrent(auctionId);
      if (!snapshot) {
        await this.ctx.storage.deleteAlarm();
        return;
      }
      if (snapshot.status === "CANCELLED") {
        await this.ctx.storage.deleteAlarm();
        return;
      }

      const dueAt = nextAuctionAlarmAt(snapshot);
      if (dueAt === null) {
        await this.ctx.storage.deleteAlarm();
        return;
      }
      if (now < dueAt) {
        await this.ctx.storage.setAlarm(dueAt);
        return;
      }

      const nextStatus = snapshot.status === "SCHEDULED" ? "OPEN" : "CLOSING";
      const changed = await this.transitions.compareAndSetStatus(snapshot, nextStatus, serverNow);
      if (changed) {
        await this.broadcastCommitted({
          auctionId,
          auctionVersion: snapshot.version + 1,
          bidSeq: snapshot.lastBidSeq,
          data: { status: nextStatus },
          occurredAt: serverNow,
          type: "auction.status.changed",
        });
      }
    }

    const latest = await this.transitions.findCurrent(auctionId);
    const nextAlarm = latest ? nextAuctionAlarmAt(latest) : null;
    if (nextAlarm === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(nextAlarm);
  }

  async alarm(): Promise<void> {
    await this.advanceDueTransitions(new Date().toISOString());
  }

  async broadcastCommitted(event: AuctionRoomEvent): Promise<void> {
    const message = JSON.stringify(publicEventValue(event));
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(message);
      } catch {
        // Closing sockets may still be returned by getWebSockets().
      }
    }
  }

  async hasConnection(connectionId: string): Promise<boolean> {
    return this.ctx
      .getWebSockets(connectionId)
      .some((socket) => readWebSocketAttachment(socket)?.connectionId === connectionId);
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (messageByteLength(message) > 4096) {
      socket.close(1009, "FRAME_TOO_LARGE");
      return;
    }
    socket.close(1008, "READ_ONLY_SUBSCRIPTION");
  }

  async webSocketClose(socket: WebSocket): Promise<void> {
    const attachment = readWebSocketAttachment(socket);
    if (attachment) await this.leases.release(attachment.connectionId, attachment.marketsUserId);
  }

  async webSocketError(socket: WebSocket): Promise<void> {
    const attachment = readWebSocketAttachment(socket);
    if (attachment) await this.leases.release(attachment.connectionId, attachment.marketsUserId);
  }
}
