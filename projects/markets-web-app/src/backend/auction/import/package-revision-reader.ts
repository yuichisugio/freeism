import type { components } from "../../../generated/points-markets-api";
import type { PointsApiClient } from "../../points/points-api-client";

type PublicPointPackageRevisionResponse =
  components["schemas"]["PublicPointPackageRevisionResponse"];

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
      try {
        return {
          body: await response.json<PublicPointPackageRevisionResponse>(),
          cacheControl: response.headers.get("Cache-Control"),
          etag: response.headers.get("ETag"),
        };
      } catch {
        throw new PackageRevisionReaderError("POINTS_DEPENDENCY_UNAVAILABLE");
      }
    },
  };
}
