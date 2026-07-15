import type { BidPosition } from "./auction-types";

export interface AutoBidPosition extends BidPosition {
  autoBidMaxTickCount: number | null;
}

export type AutoBidCommand =
  | {
      autoBidMaxTickCount: number;
      commandSequence: number;
      kind: "SET_AUTO_BID";
      marketsUserId: string;
      quantity: number;
      reachedSequence: number;
      requiredPriceTickCount: number;
    }
  | {
      commandSequence: number;
      kind: "CANCEL_AUTO_BID";
      marketsUserId: string;
    };

export interface PublicBidPositionEvent {
  commandSequence: number;
  marketsUserId: string;
  priceChanged: boolean;
  priceTickCount: number;
  quantity: number;
  reachedSequence: number;
  type: "BID_POSITION_UPDATED";
}

export interface AutoBidResolution {
  positions: readonly AutoBidPosition[];
  publicEvents: readonly PublicBidPositionEvent[];
}

function positiveSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function nonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function validatePositions(positions: readonly AutoBidPosition[]): void {
  const users = new Set<string>();
  const reachedSequences = new Set<number>();
  for (const position of positions) {
    if (
      position.marketsUserId.length === 0 ||
      users.has(position.marketsUserId) ||
      !positiveSafeInteger(position.quantity) ||
      position.quantity > 1_000 ||
      !nonNegativeSafeInteger(position.priceTickCount) ||
      !positiveSafeInteger(position.reachedSequence) ||
      reachedSequences.has(position.reachedSequence) ||
      (position.autoBidMaxTickCount !== null &&
        (!nonNegativeSafeInteger(position.autoBidMaxTickCount) ||
          position.autoBidMaxTickCount < position.priceTickCount))
    ) {
      throw new Error("INVALID_AUTO_BID_INPUT");
    }
    users.add(position.marketsUserId);
    reachedSequences.add(position.reachedSequence);
  }
}

function validateCommands(commands: readonly AutoBidCommand[]): AutoBidCommand[] {
  const sorted = [...commands].sort((left, right) => {
    if (left.commandSequence < right.commandSequence) return -1;
    if (left.commandSequence > right.commandSequence) return 1;
    return 0;
  });
  const sequences = new Set<number>();
  for (const command of sorted) {
    if (
      command.marketsUserId.length === 0 ||
      !positiveSafeInteger(command.commandSequence) ||
      sequences.has(command.commandSequence)
    ) {
      throw new Error("INVALID_AUTO_BID_INPUT");
    }
    sequences.add(command.commandSequence);
    if (
      command.kind === "SET_AUTO_BID" &&
      (!positiveSafeInteger(command.quantity) ||
        command.quantity > 1_000 ||
        !positiveSafeInteger(command.reachedSequence) ||
        !nonNegativeSafeInteger(command.requiredPriceTickCount) ||
        !nonNegativeSafeInteger(command.autoBidMaxTickCount))
    ) {
      throw new Error("INVALID_AUTO_BID_INPUT");
    }
  }
  return sorted;
}

export function resolveAutoBids(input: {
  commands: readonly AutoBidCommand[];
  positions: readonly AutoBidPosition[];
}): AutoBidResolution {
  validatePositions(input.positions);
  const positions = input.positions.map((position) => ({ ...position }));
  const publicEvents: PublicBidPositionEvent[] = [];

  for (const command of validateCommands(input.commands)) {
    const index = positions.findIndex(
      (position) => position.marketsUserId === command.marketsUserId,
    );
    const current = positions[index];
    if (command.kind === "CANCEL_AUTO_BID") {
      if (current) positions[index] = { ...current, autoBidMaxTickCount: null };
      continue;
    }

    if (current && command.requiredPriceTickCount < current.priceTickCount) {
      throw new Error("AUTO_BID_PRICE_DECREASED");
    }
    if (
      command.requiredPriceTickCount > command.autoBidMaxTickCount ||
      (current && current.priceTickCount > command.autoBidMaxTickCount)
    ) {
      throw new Error("AUTO_BID_MAX_EXCEEDED");
    }
    if (
      current?.autoBidMaxTickCount !== null &&
      current?.autoBidMaxTickCount !== undefined &&
      command.autoBidMaxTickCount < current.autoBidMaxTickCount
    ) {
      throw new Error("AUTO_BID_MAX_DECREASED");
    }

    const priceChanged =
      current === undefined || command.requiredPriceTickCount > current.priceTickCount;
    const quantityChanged = current === undefined || command.quantity !== current.quantity;
    const reachedSequence = priceChanged
      ? command.reachedSequence
      : (current?.reachedSequence ?? command.reachedSequence);
    if (
      priceChanged &&
      positions.some(
        (position) =>
          position.marketsUserId !== command.marketsUserId &&
          position.reachedSequence === reachedSequence,
      )
    ) {
      throw new Error("DUPLICATE_REACHED_SEQUENCE");
    }
    const next: AutoBidPosition = {
      autoBidMaxTickCount: command.autoBidMaxTickCount,
      marketsUserId: command.marketsUserId,
      priceTickCount: command.requiredPriceTickCount,
      quantity: command.quantity,
      reachedSequence,
    };
    if (index === -1) positions.push(next);
    else positions[index] = next;

    if (priceChanged || quantityChanged) {
      publicEvents.push({
        commandSequence: command.commandSequence,
        marketsUserId: command.marketsUserId,
        priceChanged,
        priceTickCount: next.priceTickCount,
        quantity: next.quantity,
        reachedSequence: next.reachedSequence,
        type: "BID_POSITION_UPDATED",
      });
    }
  }

  return { positions, publicEvents };
}
