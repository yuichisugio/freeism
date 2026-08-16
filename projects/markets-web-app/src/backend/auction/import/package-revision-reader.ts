import type { PointsApiClient } from "../../points/points-api-client";
import {
  publicPointPackageRevisionResponseSchema,
  type PublicPointPackageRevisionResponse,
} from "../../points/points-api-schemas";

export interface PointPackageRevisionHttpResult {
  body: PublicPointPackageRevisionResponse;
  cacheControl: string | null;
  etag: string | null;
}

export interface PackageRevisionReader {
  get(pointPackageRevisionId: string): Promise<PointPackageRevisionHttpResult>;
}

export class PackageRevisionReaderError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

type PublicRevisionClient = Pick<PointsApiClient, "getPublicPointPackageRevision">;

export function createPackageRevisionReader(client: PublicRevisionClient): PackageRevisionReader {
  return {
    async get(pointPackageRevisionId) {
      let response: Response;
      try {
        response = await client.getPublicPointPackageRevision(pointPackageRevisionId);
      } catch {
        throw new PackageRevisionReaderError("POINTS_DEPENDENCY_UNAVAILABLE");
      }
      if (response.status === 404) {
        throw new PackageRevisionReaderError("POINT_PACKAGE_REVISION_NOT_FOUND");
      }
      if (response.status !== 200) {
        throw new PackageRevisionReaderError("POINTS_DEPENDENCY_UNAVAILABLE");
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new PackageRevisionReaderError("POINTS_DEPENDENCY_UNAVAILABLE");
      }
      const parsed = publicPointPackageRevisionResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new PackageRevisionReaderError("POINTS_DEPENDENCY_UNAVAILABLE");
      }
      return {
        body: parsed.data,
        cacheControl: response.headers.get("Cache-Control"),
        etag: response.headers.get("ETag"),
      };
    },
  };
}
