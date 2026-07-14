import {
  applyExtensionRule,
  type ApplyExtensionInput,
  type ExtensionDecision,
} from "./apply-extension-rule";
import { evaluateBuyNow, type BuyNowDecision, type EvaluateBuyNowInput } from "./evaluate-buy-now";
import {
  resolveAutoBids,
  type AutoBidCommand,
  type AutoBidPosition,
  type PublicBidPositionEvent,
} from "./resolve-auto-bids";

export interface BuyNowCommand {
  buyerMarketsUserId: string;
  commandSequence: number;
  kind: "BUY_NOW";
  requestedQuantity: number;
}

type ExtensionContext = Omit<ApplyExtensionInput, "acceptedPublicPriceUpdate">;
type BuyNowContext = Omit<
  EvaluateBuyNowInput,
  "buyerMarketsUserId" | "commandSequence" | "requestedQuantity"
>;

export interface ReduceAuctionCommandInput {
  buyNow?: BuyNowContext;
  command: AutoBidCommand | BuyNowCommand;
  extension: ExtensionContext;
  positions: readonly AutoBidPosition[];
}

export interface AuctionCommandDecision {
  buyNow: BuyNowDecision | null;
  extension: ExtensionDecision;
  positions: readonly AutoBidPosition[];
  publicEvents: readonly PublicBidPositionEvent[];
}

export function reduceAuctionCommand(input: ReduceAuctionCommandInput): AuctionCommandDecision {
  if (input.command.kind === "BUY_NOW") {
    if (!input.buyNow) throw new Error("BUY_NOW_CONTEXT_REQUIRED");
    return {
      buyNow: evaluateBuyNow({
        ...input.buyNow,
        buyerMarketsUserId: input.command.buyerMarketsUserId,
        commandSequence: input.command.commandSequence,
        requestedQuantity: input.command.requestedQuantity,
      }),
      extension: applyExtensionRule({
        ...input.extension,
        acceptedPublicPriceUpdate: false,
      }),
      positions: input.positions,
      publicEvents: [],
    };
  }

  const autoBid = resolveAutoBids({ commands: [input.command], positions: input.positions });
  return {
    buyNow: null,
    extension: applyExtensionRule({
      ...input.extension,
      acceptedPublicPriceUpdate: autoBid.publicEvents.some((event) => event.priceChanged),
    }),
    positions: autoBid.positions,
    publicEvents: autoBid.publicEvents,
  };
}
