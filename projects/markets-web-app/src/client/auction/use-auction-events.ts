import { useEffect, useRef, useState } from "react";

import type { PublicAuctionStatus } from "../api/markets-client";

export type AuctionConnectionPhase = "CONNECTING" | "LIVE" | "RESYNCING" | "DISCONNECTED";

export interface AuctionConnectionState {
  auctionVersion: number;
  bidSeq: number;
  canBid: boolean;
  state: AuctionConnectionPhase;
}

export interface PublicAuctionSnapshot {
  auctionId: string;
  auctionVersion: number;
  bidSeq: number;
  status: PublicAuctionStatus;
}

export type KnownAuctionEventType =
  | "auction.snapshot"
  | "auction.status.changed"
  | "auction.bid.updated"
  | "auction.auto-bid.cancelled"
  | "auction.buy-now.pending";

export interface PublicAuctionEvent {
  auctionId: string;
  auctionVersion: number;
  bidSeq: number;
  data: Record<string, unknown>;
  occurredAt: string;
  type: KnownAuctionEventType;
}

export interface AuctionEventControllerInput {
  applyPublicEvent: (event: PublicAuctionEvent) => void;
  initial: PublicAuctionSnapshot;
  onSnapshot?: (snapshot: PublicAuctionSnapshot) => void;
  onState: (state: AuctionConnectionState) => void;
  resync: () => Promise<PublicAuctionSnapshot>;
}

export interface AuctionEventController {
  accept(value: unknown): Promise<void>;
  disconnect(): void;
  getState(): AuctionConnectionState;
}

const KNOWN_TYPES = new Set<KnownAuctionEventType>([
  "auction.snapshot",
  "auction.status.changed",
  "auction.bid.updated",
  "auction.auto-bid.cancelled",
  "auction.buy-now.pending",
]);

const PUBLIC_DATA_KEYS: Record<KnownAuctionEventType, ReadonlySet<string>> = {
  "auction.snapshot": new Set(),
  "auction.status.changed": new Set(["status", "endsAt"]),
  "auction.bid.updated": new Set([
    "availableQuantity",
    "provisionalAllocatedQuantity",
    "publicPriceTickCount",
  ]),
  "auction.auto-bid.cancelled": new Set(["publicPriceTickCount"]),
  "auction.buy-now.pending": new Set(["availableQuantity", "status"]),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeEvent(value: unknown): PublicAuctionEvent | null {
  if (
    !isRecord(value) ||
    typeof value.type !== "string" ||
    !KNOWN_TYPES.has(value.type as KnownAuctionEventType)
  ) {
    return null;
  }
  if (
    typeof value.auctionId !== "string" ||
    !Number.isSafeInteger(value.auctionVersion) ||
    Number(value.auctionVersion) < 0 ||
    !Number.isSafeInteger(value.bidSeq) ||
    Number(value.bidSeq) < 0 ||
    typeof value.occurredAt !== "string" ||
    !Number.isFinite(Date.parse(value.occurredAt)) ||
    !isRecord(value.data)
  ) {
    return null;
  }
  const type = value.type as KnownAuctionEventType;
  const allowed = PUBLIC_DATA_KEYS[type];
  const data = Object.fromEntries(Object.entries(value.data).filter(([key]) => allowed.has(key)));
  return {
    auctionId: value.auctionId,
    auctionVersion: Number(value.auctionVersion),
    bidSeq: Number(value.bidSeq),
    data,
    occurredAt: value.occurredAt,
    type,
  };
}

function validSnapshot(value: PublicAuctionSnapshot, auctionId: string) {
  return (
    value.auctionId === auctionId &&
    Number.isSafeInteger(value.auctionVersion) &&
    value.auctionVersion >= 0 &&
    Number.isSafeInteger(value.bidSeq) &&
    value.bidSeq >= 0
  );
}

export function createAuctionEventController(
  input: AuctionEventControllerInput,
): AuctionEventController {
  let state: AuctionConnectionState = {
    auctionVersion: input.initial.auctionVersion,
    bidSeq: input.initial.bidSeq,
    canBid: false,
    state: "CONNECTING",
  };
  let resyncing: Promise<void> | null = null;

  function publish(next: AuctionConnectionState) {
    state = next;
    input.onState({ ...state });
  }

  async function resync() {
    if (resyncing) return resyncing;
    publish({ ...state, canBid: false, state: "RESYNCING" });
    resyncing = input
      .resync()
      .then((snapshot) => {
        if (!validSnapshot(snapshot, input.initial.auctionId)) {
          throw new Error("INVALID_AUCTION_SNAPSHOT");
        }
        input.onSnapshot?.(snapshot);
        publish({
          auctionVersion: snapshot.auctionVersion,
          bidSeq: snapshot.bidSeq,
          canBid: snapshot.status === "OPEN",
          state: "LIVE",
        });
      })
      .catch(() => {
        publish({ ...state, canBid: false, state: "DISCONNECTED" });
      })
      .finally(() => {
        resyncing = null;
      });
    return resyncing;
  }

  input.onState({ ...state });

  return {
    async accept(value) {
      const event = normalizeEvent(value);
      if (!event || event.auctionId !== input.initial.auctionId) {
        await resync();
        return;
      }
      if (state.state === "CONNECTING") {
        if (
          event.type === "auction.snapshot" &&
          event.auctionVersion === state.auctionVersion &&
          event.bidSeq === state.bidSeq
        ) {
          publish({ ...state, canBid: input.initial.status === "OPEN", state: "LIVE" });
          return;
        }
        await resync();
        return;
      }
      if (state.state !== "LIVE") return;
      if (
        event.type === "auction.snapshot" &&
        event.auctionVersion === state.auctionVersion &&
        event.bidSeq === state.bidSeq
      ) {
        return;
      }
      const versionDelta = event.auctionVersion - state.auctionVersion;
      const sequenceDelta = event.bidSeq - state.bidSeq;
      if (
        versionDelta < 0 ||
        versionDelta > 1 ||
        sequenceDelta < 0 ||
        sequenceDelta > 1 ||
        (versionDelta === 0 && sequenceDelta === 0)
      ) {
        await resync();
        return;
      }
      input.applyPublicEvent(event);
      publish({
        auctionVersion: event.auctionVersion,
        bidSeq: event.bidSeq,
        canBid: state.canBid,
        state: "LIVE",
      });
    },
    disconnect() {
      publish({ ...state, canBid: false, state: "DISCONNECTED" });
    },
    getState() {
      return { ...state };
    },
  };
}

type SocketFactory = (url: string) => WebSocket;

export interface UseAuctionEventsInput {
  applyPublicEvent: (event: PublicAuctionEvent) => void;
  auctionId: string;
  enabled: boolean;
  initial: PublicAuctionSnapshot;
  resync: () => Promise<PublicAuctionSnapshot>;
  socketFactory?: SocketFactory;
}

function websocketUrl(auctionId: string, state: AuctionConnectionState) {
  const url = new URL(
    `/api/auctions/${encodeURIComponent(auctionId)}/events`,
    window.location.href,
  );
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("lastAuctionVersion", String(state.auctionVersion));
  url.searchParams.set("lastBidSeq", String(state.bidSeq));
  return url.toString();
}

export function useAuctionEvents(input: UseAuctionEventsInput): AuctionConnectionState {
  const [state, setState] = useState<AuctionConnectionState>({
    auctionVersion: input.initial.auctionVersion,
    bidSeq: input.initial.bidSeq,
    canBid: false,
    state: input.enabled ? "CONNECTING" : "DISCONNECTED",
  });
  const callbacks = useRef(input);
  callbacks.current = input;

  useEffect(() => {
    if (!input.enabled) {
      setState((current) => ({ ...current, canBid: false, state: "DISCONNECTED" }));
      return;
    }
    let active = true;
    let socket: WebSocket | null = null;
    let previousPhase: AuctionConnectionPhase = "CONNECTING";
    const controller = createAuctionEventController({
      applyPublicEvent: (event) => callbacks.current.applyPublicEvent(event),
      initial: input.initial,
      onSnapshot: () => undefined,
      onState: (next) => {
        if (!active) return;
        const wasResyncing = previousPhase === "RESYNCING";
        previousPhase = next.state;
        setState(next);
        if (next.state === "RESYNCING") {
          const replacedSocket = socket;
          socket = null;
          replacedSocket?.close();
        }
        if (wasResyncing && next.state === "LIVE") openSocket();
      },
      resync: () => callbacks.current.resync(),
    });

    function openSocket() {
      if (!active) return;
      const replacedSocket = socket;
      socket = null;
      replacedSocket?.close();
      const factory = input.socketFactory ?? ((url: string) => new WebSocket(url));
      const openedSocket = factory(websocketUrl(input.auctionId, controller.getState()));
      socket = openedSocket;
      openedSocket.addEventListener("message", (event) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(String(event.data));
        } catch {
          parsed = null;
        }
        void controller.accept(parsed);
      });
      openedSocket.addEventListener("close", () => {
        if (active && socket === openedSocket && controller.getState().state !== "RESYNCING") {
          controller.disconnect();
        }
      });
      openedSocket.addEventListener("error", () => {
        if (active && socket === openedSocket && controller.getState().state !== "RESYNCING") {
          controller.disconnect();
        }
      });
    }

    openSocket();
    return () => {
      active = false;
      const closingSocket = socket;
      socket = null;
      closingSocket?.close();
    };
  }, [input.auctionId, input.enabled, input.initial.auctionVersion, input.initial.bidSeq]);

  return state;
}
