export interface PublicAuctionProof {
  allocation: {
    componentVector: readonly PublicComponentAmount[];
    quantity: number;
    uniformPriceTickCount: number;
  };
  auctionId: string;
  auctionRevisionId: string;
  buyer: PublicIdentitySnapshot;
  canonicalUrl: string;
  completionStatus: "SETTLED";
  contentHash: string;
  item: PublicAuctionItemSnapshot;
  planHash: string;
  pointPackageRevisionId: string;
  proofId: string;
  seller: PublicIdentitySnapshot;
  settledAt: string;
}

export interface PublicAuctionItemSnapshot {
  description: string;
  externalUrl: string;
  title: string;
}

export interface PublicComponentAmount {
  amountScaled: string;
  evaluationCriterionId: string;
  evaluationCriterionRevisionId: string;
}

export interface PublicIdentitySnapshot {
  displayName?: string;
  marketsUserId: string;
}

interface ProofRow {
  allocationQuantity: number;
  auctionId: string;
  auctionRevisionId: string;
  buyerIdentitySnapshotJson: string;
  completionStatus: "SETTLED";
  componentVectorJson: string;
  contentHash: string;
  itemSnapshotJson: string;
  planHash: string;
  pointPackageRevisionId: string;
  proofId: string;
  sellerIdentitySnapshotJson: string;
  settledAt: string;
  uniformPriceTickCount: number;
}

function parseObject(value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("PROOF_SNAPSHOT_INVALID");
  }
  return parsed as Record<string, unknown>;
}

function publicIdentity(value: string): PublicIdentitySnapshot {
  const parsed = parseObject(value);
  if (typeof parsed.marketsUserId !== "string") throw new Error("PROOF_SNAPSHOT_INVALID");
  return {
    ...(typeof parsed.displayName === "string" ? { displayName: parsed.displayName } : {}),
    marketsUserId: parsed.marketsUserId,
  };
}

function publicItem(value: string): PublicAuctionItemSnapshot {
  const parsed = parseObject(value);
  if (
    typeof parsed.description !== "string" ||
    typeof parsed.externalUrl !== "string" ||
    typeof parsed.title !== "string"
  ) {
    throw new Error("PROOF_SNAPSHOT_INVALID");
  }
  return {
    description: parsed.description,
    externalUrl: parsed.externalUrl,
    title: parsed.title,
  };
}

function publicComponentVector(value: string): PublicComponentAmount[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) throw new Error("PROOF_SNAPSHOT_INVALID");
  return parsed.map((item) => {
    if (!item || typeof item !== "object") throw new Error("PROOF_SNAPSHOT_INVALID");
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.amountScaled !== "string" ||
      typeof candidate.evaluationCriterionId !== "string" ||
      typeof candidate.evaluationCriterionRevisionId !== "string"
    ) {
      throw new Error("PROOF_SNAPSHOT_INVALID");
    }
    return {
      amountScaled: candidate.amountScaled,
      evaluationCriterionId: candidate.evaluationCriterionId,
      evaluationCriterionRevisionId: candidate.evaluationCriterionRevisionId,
    };
  });
}

export async function readPublicProof(
  db: D1Database,
  appOrigin: string,
  proofId: string,
): Promise<PublicAuctionProof> {
  const row = await db
    .prepare(
      `SELECT id AS proofId, auction_id AS auctionId,
              auction_revision_id AS auctionRevisionId,
              point_package_revision_id AS pointPackageRevisionId,
              item_snapshot_json AS itemSnapshotJson,
              seller_identity_snapshot_json AS sellerIdentitySnapshotJson,
              buyer_identity_snapshot_json AS buyerIdentitySnapshotJson,
              allocation_quantity AS allocationQuantity,
              uniform_price_tick_count AS uniformPriceTickCount,
              component_vector_json AS componentVectorJson,
              completion_status AS completionStatus, settled_at AS settledAt,
              plan_hash AS planHash, content_hash AS contentHash
       FROM proofs WHERE id = ? LIMIT 1`,
    )
    .bind(proofId)
    .first<ProofRow>();
  if (!row) throw new Error("PROOF_NOT_FOUND");
  return {
    allocation: {
      componentVector: publicComponentVector(row.componentVectorJson),
      quantity: row.allocationQuantity,
      uniformPriceTickCount: row.uniformPriceTickCount,
    },
    auctionId: row.auctionId,
    auctionRevisionId: row.auctionRevisionId,
    buyer: publicIdentity(row.buyerIdentitySnapshotJson),
    canonicalUrl: `${appOrigin}/proofs/${encodeURIComponent(row.proofId)}`,
    completionStatus: row.completionStatus,
    contentHash: row.contentHash,
    item: publicItem(row.itemSnapshotJson),
    planHash: row.planHash,
    pointPackageRevisionId: row.pointPackageRevisionId,
    proofId: row.proofId,
    seller: publicIdentity(row.sellerIdentitySnapshotJson),
    settledAt: row.settledAt,
  };
}
