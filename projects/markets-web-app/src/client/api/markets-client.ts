export interface ProblemDetailsContract {
  code: string;
  status: number;
  title: string;
  type: string;
  errors?: readonly unknown[];
}

export class MarketsApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: ProblemDetailsContract,
  ) {
    super(problem.code);
  }
}

export type PublicAuctionStatus = "SCHEDULED" | "OPEN" | "CLOSED" | "SETTLING" | "SETTLED";

export interface PublicAuctionCard {
  auctionId: string;
  auctionVersion: number;
  buyNowPriceTickCount: number | null;
  descriptionSummary: string;
  endsAt: string;
  packageTick: number;
  pointPackage: { name: string };
  provisionalAllocatedQuantity: number;
  publicPriceTickCount: number;
  quantity: number;
  startsAt: string;
  status: PublicAuctionStatus;
  title: string;
}

export interface PublicAuctionSnapshot extends PublicAuctionCard {
  availableQuantity: number;
  bidSeq: number;
  description: string;
  externalUrl: string;
}

export interface PrivateAuctionSnapshot {
  auction: PublicAuctionSnapshot;
  viewer: {
    autoBidMaxTickCount: number | null;
    manualBid: { priceTickCount: number; quantity: number } | null;
    pointsConnectionStatus: "ACTIVE" | "NOT_LINKED" | "REAUTH_REQUIRED";
    watching: boolean;
  };
}

export interface CursorMeta {
  cursor: string | null;
  hasMore: boolean;
}

export interface CursorPage<T> {
  items: readonly T[];
  meta: CursorMeta;
}

export interface AuctionListFilters {
  cursor: string | null;
  query: string | null;
  status: PublicAuctionStatus | null;
}

export interface PointsConnectionPageState {
  pendingAction: {
    expiresAt: string;
    kind: "LINK_CONFIRM" | "UNLINK_CONFIRM";
    pendingId: string;
  } | null;
  pointsConnectionId: string | null;
  status: "PENDING_CONFIRMATION" | "ACTIVE" | "REAUTH_REQUIRED" | "UNLINKED";
}

export interface AuctionImportPreview {
  auctionCommandId: string;
  fileHash: string;
  rows: readonly Record<string, unknown>[];
}

export interface MyAuctionHistoryItem {
  allocation?: { clearingPriceTickCount: number; proofId: string; quantity: number };
  auction: PublicAuctionCard;
  kind: "CREATED" | "BID" | "WON";
  myBid?: { autoBidMaxTickCount: number | null; priceTickCount: number; quantity: number };
}

export interface PublicAuctionProof {
  allocation: { clearingPriceTickCount: number; quantity: number };
  auctionId: string;
  buyer: Record<string, unknown>;
  completionStatus: "SETTLED";
  contentHash: string;
  proofId: string;
  seller: Record<string, unknown>;
  settledAt: string;
}

export interface PublicProofReview {
  comment: string;
  completionProofUrl: string | null;
  direction: "SELLER_TO_BUYER" | "BUYER_TO_SELLER";
  rating: 1 | 2 | 3 | 4 | 5;
  revisionId: string;
}

export interface SafeSettlementStatus {
  kind: "END_OF_AUCTION" | "BUY_NOW";
  manualActionAllowed: boolean;
  pendingRetryAuthorization?: { expiresAt: string; pendingId: string } | null;
  progress: string;
  settlementId: string;
  state:
    | "PENDING"
    | "PROCESSING"
    | "FINALIZING"
    | "ACTION_REQUIRED"
    | "SETTLED"
    | "FAILED_RESTORED";
  updatedAt: string;
}

export interface MutationRequest {
  idempotencyKey: string;
  turnstileToken?: string;
}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface Envelope<T> {
  data: T;
  meta?: Partial<CursorMeta>;
}

function isEnvelope<T>(value: unknown): value is Envelope<T> {
  return typeof value === "object" && value !== null && "data" in value;
}

function idempotencyHeaders(request: MutationRequest): HeadersInit {
  return {
    "Idempotency-Key": request.idempotencyKey,
    ...(request.turnstileToken ? { "X-Turnstile-Token": request.turnstileToken } : {}),
  };
}

function jsonInit(method: string, body: unknown, request?: MutationRequest): RequestInit {
  return {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...(request ? idempotencyHeaders(request) : {}),
    },
    method,
  };
}

export interface MarketsClient {
  auction(id: string): Promise<PublicAuctionSnapshot>;
  auctions(filters: AuctionListFilters): Promise<CursorPage<PublicAuctionCard>>;
  bid(
    id: string,
    body: {
      autoBidMaxTickCount?: number;
      expectedAuctionVersion: number;
      priceTickCount: number;
      quantity: number;
    },
    request: MutationRequest,
  ): Promise<unknown>;
  buyNow(
    id: string,
    body: { expectedAuctionVersion: number; quantity: number },
    request: MutationRequest,
  ): Promise<unknown>;
  cancelAutoBid(
    id: string,
    expectedAuctionVersion: number,
    request: MutationRequest,
  ): Promise<unknown>;
  commitAuctionImport(preview: AuctionImportPreview, request: MutationRequest): Promise<unknown>;
  confirmPointsConnection(pendingId: string, request: MutationRequest): Promise<unknown>;
  confirmPointsUnlink(pendingId: string, request: MutationRequest): Promise<unknown>;
  confirmSettlementRetry(id: string, pendingId: string, request: MutationRequest): Promise<unknown>;
  history(
    kind: "created" | "bids" | "won",
    cursor?: string | null,
  ): Promise<CursorPage<MyAuctionHistoryItem>>;
  pointsConnection(): Promise<PointsConnectionPageState>;
  privateAuction(id: string): Promise<PrivateAuctionSnapshot>;
  proof(id: string): Promise<PublicAuctionProof>;
  proofReviews(id: string): Promise<readonly PublicProofReview[]>;
  settlement(id: string): Promise<SafeSettlementStatus>;
  startGoogleLogin(): Promise<{ url: string }>;
  startPointsConnection(request: MutationRequest): Promise<{ authorizationUrl: string }>;
  startPointsUnlink(
    reason: string,
    request: MutationRequest,
  ): Promise<{ authorizationUrl: string }>;
  startSettlementRetry(
    id: string,
    reason: string,
    request: MutationRequest,
  ): Promise<{ authorizationUrl: string }>;
  validateAuctionImport(file: File, request: MutationRequest): Promise<AuctionImportPreview>;
  watch(id: string, watching: boolean): Promise<{ auctionId: string; watching: boolean }>;
}

export function createMarketsClient(fetcher: FetchLike = fetch): MarketsClient {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!path.startsWith("/api/")) throw new Error("SAME_ORIGIN_API_PATH_REQUIRED");
    const response = await fetcher(path, { credentials: "same-origin", ...init });
    const contentType = response.headers.get("Content-Type") ?? "";
    const payload = contentType.includes("json") ? ((await response.json()) as unknown) : null;
    if (!response.ok) {
      const candidate = (payload ?? {}) as Partial<ProblemDetailsContract>;
      throw new MarketsApiError(response.status, {
        code: candidate.code ?? "REQUEST_FAILED",
        status: candidate.status ?? response.status,
        title: candidate.title ?? "Request failed",
        type: candidate.type ?? "about:blank",
        ...(candidate.errors ? { errors: candidate.errors } : {}),
      });
    }
    return (isEnvelope<T>(payload) ? payload.data : payload) as T;
  }

  async function cursorRequest<T>(path: string): Promise<CursorPage<T>> {
    const response = await fetcher(path, { credentials: "same-origin" });
    const payload = (await response.json()) as Envelope<readonly T[]> & {
      meta?: Partial<CursorMeta>;
    };
    if (!response.ok) {
      const problem = payload as unknown as Partial<ProblemDetailsContract>;
      throw new MarketsApiError(response.status, {
        code: problem.code ?? "REQUEST_FAILED",
        status: problem.status ?? response.status,
        title: problem.title ?? "Request failed",
        type: problem.type ?? "about:blank",
      });
    }
    return {
      items: payload.data,
      meta: { cursor: payload.meta?.cursor ?? null, hasMore: payload.meta?.hasMore ?? false },
    };
  }

  return {
    auction: (id) => request(`/api/v1/auctions/${encodeURIComponent(id)}`),
    auctions: (filters) => {
      const query = new URLSearchParams({ limit: "20" });
      if (filters.cursor) query.set("cursor", filters.cursor);
      if (filters.query) query.set("query", filters.query);
      if (filters.status) query.set("status", filters.status);
      return cursorRequest(`/api/v1/auctions?${query.toString()}`);
    },
    bid: (id, body, operation) =>
      request(
        `/api/auctions/${encodeURIComponent(id)}/bids`,
        jsonInit("POST", { ...body, commandId: operation.idempotencyKey }, operation),
      ),
    buyNow: (id, body, operation) =>
      request(
        `/api/auctions/${encodeURIComponent(id)}/buy-now`,
        jsonInit("POST", { ...body, commandId: operation.idempotencyKey }, operation),
      ),
    cancelAutoBid: (id, expectedAuctionVersion, operation) =>
      request(
        `/api/auctions/${encodeURIComponent(id)}/auto-bid`,
        jsonInit(
          "DELETE",
          { commandId: operation.idempotencyKey, expectedAuctionVersion },
          operation,
        ),
      ),
    commitAuctionImport: (preview, operation) =>
      request("/api/auctions/import/commit", jsonInit("POST", { preview }, operation)),
    confirmPointsConnection: (pendingId, operation) =>
      request("/api/points-connection/confirm", jsonInit("POST", { pendingId }, operation)),
    confirmPointsUnlink: (pendingId, operation) =>
      request("/api/points-connection/unlink/confirm", jsonInit("POST", { pendingId }, operation)),
    confirmSettlementRetry: (id, pendingId, operation) =>
      request(
        `/api/settlements/${encodeURIComponent(id)}/retry`,
        jsonInit("POST", { pendingId }, operation),
      ),
    history: (kind, cursor) => {
      const query = new URLSearchParams({ limit: "20" });
      if (cursor) query.set("cursor", cursor);
      return cursorRequest(`/api/me/auctions/${kind}?${query.toString()}`);
    },
    pointsConnection: () => request("/api/points-connection"),
    privateAuction: (id) => request(`/api/auctions/${encodeURIComponent(id)}`),
    proof: (id) => request(`/api/v1/proofs/${encodeURIComponent(id)}`),
    proofReviews: (id) => request(`/api/v1/proofs/${encodeURIComponent(id)}/reviews`),
    settlement: (id) => request(`/api/settlements/${encodeURIComponent(id)}`),
    startGoogleLogin: () =>
      request("/api/auth/sign-in/social", {
        ...jsonInit("POST", {
          callbackURL: "/auctions",
          disableRedirect: true,
          provider: "google",
        }),
      }),
    startPointsConnection: (operation) =>
      request("/api/points-connection/start", jsonInit("POST", {}, operation)),
    startPointsUnlink: (reason, operation) =>
      request("/api/points-connection/unlink/start", jsonInit("POST", { reason }, operation)),
    startSettlementRetry: (id, reason, operation) =>
      request(
        `/api/settlements/${encodeURIComponent(id)}/retry-authorizations`,
        jsonInit("POST", { reason }, operation),
      ),
    validateAuctionImport: (file, operation) =>
      request("/api/auctions/import/validate", {
        body: file,
        headers: { "Content-Type": "text/csv", ...idempotencyHeaders(operation) },
        method: "POST",
      }),
    watch: (id, watching) =>
      request(`/api/me/watchlist/${encodeURIComponent(id)}`, {
        method: watching ? "PUT" : "DELETE",
      }),
  };
}

export const marketsClient = createMarketsClient();

export function createIdempotencyKey(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}
