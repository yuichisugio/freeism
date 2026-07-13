import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vite-plus/test";

import {
  createAuctionEventController,
  type AuctionConnectionState,
  type PublicAuctionEvent,
  type PublicAuctionSnapshot,
  useAuctionEvents,
} from "./use-auction-events";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const initial: PublicAuctionSnapshot = {
  auctionId: "auction_1",
  auctionVersion: 4,
  bidSeq: 10,
  status: "OPEN",
};

function snapshotEvent(overrides: Partial<PublicAuctionEvent> = {}): PublicAuctionEvent {
  return {
    auctionId: "auction_1",
    auctionVersion: 4,
    bidSeq: 10,
    data: {},
    occurredAt: "2026-07-14T00:00:00.000Z",
    type: "auction.snapshot",
    ...overrides,
  };
}

describe("createAuctionEventController", () => {
  it("accepts a matching snapshot and a known next event", async () => {
    const states: AuctionConnectionState[] = [];
    const applyPublicEvent = vi.fn();
    const controller = createAuctionEventController({
      applyPublicEvent,
      initial,
      onState: (state) => states.push(state),
      resync: vi.fn(),
    });

    await controller.accept(snapshotEvent());
    await controller.accept(
      snapshotEvent({
        auctionVersion: 5,
        bidSeq: 11,
        type: "auction.bid.updated",
      }),
    );

    expect(states.at(-1)).toMatchObject({
      auctionVersion: 5,
      bidSeq: 11,
      canBid: true,
      state: "LIVE",
    });
    expect(applyPublicEvent).toHaveBeenCalledTimes(1);
  });

  it("disables bidding when a status event closes the auction", async () => {
    const states: AuctionConnectionState[] = [];
    const controller = createAuctionEventController({
      applyPublicEvent: vi.fn(),
      initial,
      onState: (state) => states.push(state),
      resync: vi.fn(),
    });

    await controller.accept(snapshotEvent());
    await controller.accept(
      snapshotEvent({
        auctionVersion: 5,
        bidSeq: 10,
        data: { status: "CLOSED" },
        type: "auction.status.changed",
      }),
    );

    expect(states.at(-1)).toMatchObject({ canBid: false, state: "LIVE" });
  });

  it.each([
    ["version gap", { auctionVersion: 6, bidSeq: 11, type: "auction.bid.updated" }],
    ["sequence gap", { auctionVersion: 5, bidSeq: 12, type: "auction.bid.updated" }],
    ["reverse", { auctionVersion: 3, bidSeq: 9, type: "auction.status.changed" }],
    ["unknown event", { auctionVersion: 5, bidSeq: 11, type: "auction.secret.changed" }],
  ])("blocks bids and resyncs after %s", async (_label, event) => {
    let releaseSnapshot!: (snapshot: PublicAuctionSnapshot) => void;
    const resync = vi.fn(
      () =>
        new Promise<PublicAuctionSnapshot>((resolve) => {
          releaseSnapshot = resolve;
        }),
    );
    const states: AuctionConnectionState[] = [];
    const controller = createAuctionEventController({
      applyPublicEvent: vi.fn(),
      initial,
      onState: (state) => states.push(state),
      resync,
    });
    await controller.accept(snapshotEvent());

    const pending = controller.accept(snapshotEvent(event as Partial<PublicAuctionEvent>));
    expect(states.at(-1)).toMatchObject({ canBid: false, state: "RESYNCING" });
    expect(resync).toHaveBeenCalledTimes(1);

    releaseSnapshot({ ...initial, auctionVersion: 6, bidSeq: 12 });
    await pending;

    expect(states.at(-1)).toMatchObject({
      auctionVersion: 6,
      bidSeq: 12,
      canBid: true,
      state: "LIVE",
    });
  });
});

describe("useAuctionEvents", () => {
  it("ignores a delayed close from the replaced socket after resync", async () => {
    class TestSocket {
      readonly listeners = new Map<string, Array<(event: { data?: unknown }) => void>>();

      addEventListener(type: string, listener: (event: { data?: unknown }) => void) {
        const listeners = this.listeners.get(type) ?? [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
      }

      close() {}

      emit(type: string, event: { data?: unknown } = {}) {
        for (const listener of this.listeners.get(type) ?? []) listener(event);
      }
    }

    const sockets: TestSocket[] = [];
    const container = document.createElement("div");
    const root = createRoot(container);
    function Harness() {
      const connection = useAuctionEvents({
        applyPublicEvent: vi.fn(),
        auctionId: initial.auctionId,
        enabled: true,
        initial,
        resync: async () => ({ ...initial, auctionVersion: 6, bidSeq: 12 }),
        socketFactory: () => {
          const socket = new TestSocket();
          sockets.push(socket);
          return socket as unknown as WebSocket;
        },
      });
      return <output>{`${connection.state}:${connection.canBid}`}</output>;
    }

    await act(async () => root.render(<Harness />));
    const first = sockets[0]!;
    await act(async () => {
      first.emit("message", { data: JSON.stringify(snapshotEvent()) });
    });
    await act(async () => {
      first.emit("message", {
        data: JSON.stringify(
          snapshotEvent({ auctionVersion: 6, bidSeq: 12, type: "auction.bid.updated" }),
        ),
      });
      await Promise.resolve();
    });

    expect(sockets).toHaveLength(2);
    expect(container.textContent).toBe("LIVE:true");
    await act(async () => first.emit("close"));
    expect(container.textContent).toBe("LIVE:true");
    await act(async () => root.unmount());
  });
});
