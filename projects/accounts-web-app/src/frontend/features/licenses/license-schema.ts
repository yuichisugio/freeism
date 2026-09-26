import * as v from "valibot";

/**
 * Viteの`build.license`がJSONで出力する依存パッケージのライセンス一覧。
 * 識別子はpackage.jsonの`license`、全文はパッケージ内のライセンスファイルから取られ、無い場合は省略される。
 * @see https://vite.dev/config/build-options#build-license
 */
export const dependencyLicensesSchema = v.array(
  v.object({
    name: v.string(),
    version: v.string(),
    identifier: v.optional(v.string()),
    text: v.optional(v.string()),
  }),
);

export type DependencyLicense = v.InferOutput<typeof dependencyLicensesSchema>[number];
