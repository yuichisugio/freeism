import type { MarketsActor } from "../http/context";
import {
  D1AuctionCommandRepository,
  type AuctionCommandCommit,
} from "../db/d1-auction-command-repository";
import { reduceAuctionCommand } from "./domain/auction-command";
import type { AutoBidCommand } from "./domain/resolve-auto-bids";
import type { AuctionRoomEvent } from "./auction-room";

export type HttpAuctionCommand =
  | { kind: "PLACE_BID"; quantity: number; priceTickCount: number; autoBidMaxTickCount?: number }
  | { kind: "CANCEL_AUTO_BID" }
  | { kind: "BUY_NOW"; quantity: number };

export interface ExecuteAuctionCommandInput {
  actor: MarketsActor;
  auctionId: string;
  command: HttpAuctionCommand;
  commandId: string;
  expectedAuctionVersion: number;
  idempotencyKey: string;
  payloadHash: string;
  serverNow: string;
}

export type AuctionCommandResult =
  | {
      acceptedPriceTickCount: number;
      auctionVersion: number;
      bidSeq: number;
      commandId: string;
      kind: "BID_ACCEPTED";
      quantity: number;
    }
  | {
      auctionVersion: number;
      bidSeq: number;
      commandId: string;
      kind: "AUTO_BID_CANCELLED";
    }
  | {
      auctionVersion: number;
      commandId: string;
      holdId: string;
      kind: "BUY_NOW_PENDING";
      settlementId: string;
      state: "PENDING";
    };

export interface ExecutedAuctionCommand {
  publicEvents: readonly AuctionRoomEvent[];
  replayed: boolean;
  result: AuctionCommandResult;
  settlementOutboxId: string | null;
}

export class AuctionCommandError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function positiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function nonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function operation(command: HttpAuctionCommand) {
  return command.kind;
}

function normalizeRepositoryError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  const codes = [
    "AUCTION_VERSION_CONFLICT",
    "AUCTION_NOT_OPEN",
    "SELLER_CANNOT_BID",
    "POINTS_LINK_REQUIRED",
    "BUY_NOW_QUANTITY_UNAVAILABLE",
    "IDEMPOTENCY_KEY_REUSED",
  ];
  const code = codes.find((candidate) => message.includes(candidate));
  if (code) throw new AuctionCommandError(code);
  throw error;
}

export async function executeAuctionCommand(
  database: D1Database,
  input: ExecuteAuctionCommandInput,
): Promise<ExecutedAuctionCommand> {
  const repository = new D1AuctionCommandRepository(database);
  const replay = await repository.findReplay(
    input.actor.marketsUserId,
    operation(input.command),
    input.idempotencyKey,
    input.payloadHash,
    input.auctionId,
    input.commandId,
  );
  if (replay.kind === "CONFLICT") throw new AuctionCommandError("IDEMPOTENCY_KEY_REUSED");
  if (replay.kind === "REPLAY") {
    return { publicEvents: [], replayed: true, result: replay.result, settlementOutboxId: null };
  }

  if (!positiveSafeInteger(input.expectedAuctionVersion)) {
    throw new AuctionCommandError("AUCTION_VERSION_CONFLICT");
  }
  if (input.command.kind !== "CANCEL_AUTO_BID") {
    if (!positiveSafeInteger(input.command.quantity) || input.command.quantity > 1_000) {
      throw new AuctionCommandError("INVALID_QUANTITY");
    }
  }
  if (input.command.kind === "PLACE_BID") {
    if (
      !nonNegativeSafeInteger(input.command.priceTickCount) ||
      (input.command.autoBidMaxTickCount !== undefined &&
        !nonNegativeSafeInteger(input.command.autoBidMaxTickCount))
    ) {
      throw new AuctionCommandError("INVALID_PRICE_TICK");
    }
  }

  const aggregate = await repository.loadForCommand(input.auctionId);
  if (!aggregate) throw new AuctionCommandError("AUCTION_NOT_FOUND");
  if (aggregate.status !== "OPEN" || Date.parse(input.serverNow) >= Date.parse(aggregate.endsAt)) {
    throw new AuctionCommandError("AUCTION_NOT_OPEN");
  }
  if (aggregate.version !== input.expectedAuctionVersion) {
    throw new AuctionCommandError("AUCTION_VERSION_CONFLICT");
  }
  if (aggregate.sellerMarketsUserId === input.actor.marketsUserId) {
    throw new AuctionCommandError("SELLER_CANNOT_BID");
  }
  if (!(await repository.hasActivePointsConnection(input.actor.marketsUserId))) {
    throw new AuctionCommandError("POINTS_LINK_REQUIRED");
  }
  if (input.command.kind === "PLACE_BID" && input.command.quantity > aggregate.availableQuantity) {
    throw new AuctionCommandError("INVALID_QUANTITY");
  }

  const commandSequence = aggregate.lastBidSeq + 1;
  const domainCommand = (() => {
    if (input.command.kind === "BUY_NOW") {
      return {
        buyerMarketsUserId: input.actor.marketsUserId,
        commandSequence,
        kind: "BUY_NOW" as const,
        requestedQuantity: input.command.quantity,
      };
    }
    if (input.command.kind === "CANCEL_AUTO_BID") {
      return {
        commandSequence,
        kind: "CANCEL_AUTO_BID" as const,
        marketsUserId: input.actor.marketsUserId,
      } satisfies AutoBidCommand;
    }
    return {
      autoBidMaxTickCount: input.command.autoBidMaxTickCount ?? input.command.priceTickCount,
      commandSequence,
      kind: "SET_AUTO_BID" as const,
      marketsUserId: input.actor.marketsUserId,
      quantity: input.command.quantity,
      reachedSequence: commandSequence,
      requiredPriceTickCount: input.command.priceTickCount,
    } satisfies AutoBidCommand;
  })();

  let decision;
  try {
    decision = reduceAuctionCommand({
      buyNow:
        input.command.kind === "BUY_NOW"
          ? {
              allComponentsBuyNowEnabled: true,
              availableQuantity: aggregate.availableQuantity,
              buyNowPriceTickCount: aggregate.buyNowPriceTickCount,
              endAtMs: Date.parse(aggregate.endsAt),
              nowMs: Date.parse(input.serverNow),
              sellerMarketsUserId: aggregate.sellerMarketsUserId,
              status: aggregate.status,
            }
          : undefined,
      command: domainCommand,
      extension: {
        commandAuctionRevision: aggregate.revisionNumber,
        currentAuctionRevision: aggregate.revisionNumber,
        currentExtensionCount: 0,
        endAtMs: Date.parse(aggregate.endsAt),
        nowMs: Date.parse(input.serverNow),
        rule: null,
      },
      positions: aggregate.positions,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : String(error);
    if (
      code === "AUTO_BID_MAX_DECREASED" ||
      code === "AUTO_BID_MAX_EXCEEDED" ||
      code === "AUTO_BID_PRICE_DECREASED"
    ) {
      throw new AuctionCommandError(code);
    }
    if (code.startsWith("INVALID_")) throw new AuctionCommandError("INVALID_PRICE_TICK");
    throw error;
  }

  if (decision.buyNow && !decision.buyNow.accepted) {
    throw new AuctionCommandError(decision.buyNow.code);
  }

  const nextVersion = aggregate.version + 1;
  const holdId = input.command.kind === "BUY_NOW" ? `hold_${crypto.randomUUID()}` : null;
  const settlementId = input.command.kind === "BUY_NOW" ? `stl_${crypto.randomUUID()}` : null;
  const publicBidEvent = decision.publicEvents[0];
  const result: AuctionCommandResult =
    input.command.kind === "BUY_NOW"
      ? {
          auctionVersion: nextVersion,
          commandId: input.commandId,
          holdId: holdId!,
          kind: "BUY_NOW_PENDING",
          settlementId: settlementId!,
          state: "PENDING",
        }
      : input.command.kind === "CANCEL_AUTO_BID"
        ? {
            auctionVersion: nextVersion,
            bidSeq: aggregate.lastBidSeq,
            commandId: input.commandId,
            kind: "AUTO_BID_CANCELLED",
          }
        : {
            acceptedPriceTickCount: publicBidEvent?.priceTickCount ?? input.command.priceTickCount,
            auctionVersion: nextVersion,
            bidSeq: publicBidEvent ? commandSequence : aggregate.lastBidSeq,
            commandId: input.commandId,
            kind: "BID_ACCEPTED",
            quantity: input.command.quantity,
          };

  const commit: AuctionCommandCommit = {
    aggregate,
    decision,
    holdId,
    input,
    result,
    settlementId,
  };
  try {
    return await repository.commit(commit);
  } catch (error) {
    const racedReplay = await repository.findReplay(
      input.actor.marketsUserId,
      operation(input.command),
      input.idempotencyKey,
      input.payloadHash,
      input.auctionId,
      input.commandId,
    );
    if (racedReplay.kind === "REPLAY") {
      return {
        publicEvents: [],
        replayed: true,
        result: racedReplay.result,
        settlementOutboxId: null,
      };
    }
    if (racedReplay.kind === "CONFLICT") throw new AuctionCommandError("IDEMPOTENCY_KEY_REUSED");
    normalizeRepositoryError(error);
  }
}
