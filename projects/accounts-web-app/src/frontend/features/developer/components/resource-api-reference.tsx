import { useId } from "react";

import { useMessages } from "../../../lib/i18n/i18n-provider";
import { ErrorText, LoadingState } from "../../app-shell/components/status-messages";
import type { ResourceApiReferenceState } from "../hooks/use-resource-api-reference";
import type { ResourceApiOperation } from "../resource-api-document";
import { resourceApiReferenceMessages } from "../resource-api-reference-messages";

/**
 * Accounts API（資源API）のOpenAPI文書の簡易表示。
 * QUERY操作ごとに見出し・経路・要求と応答のschemaを示し、schemaの本文は折りたたむ。
 * @see ./resource-api-reference.test.tsx
 */
export function ResourceApiReferenceView({ state }: { state: ResourceApiReferenceState }) {
  const messages = useMessages(resourceApiReferenceMessages);
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <header className="space-y-2">
        <h2 id={headingId} className="text-lg font-semibold">
          {messages.title}
        </h2>
        <p className="text-sm text-muted">{messages.description}</p>
      </header>
      {state.status === "loading" ? <LoadingState /> : null}
      {state.status === "failed" ? <ErrorText>{messages.loadFailed}</ErrorText> : null}
      {state.status === "loaded" ? (
        <>
          <p className="text-sm">
            {state.reference.title} {state.reference.version} · OpenAPI {state.reference.openapi}
          </p>
          {state.reference.operations.map((operation) => (
            <OperationItem key={`${operation.method} ${operation.path}`} operation={operation} />
          ))}
          <div className="space-y-2">
            <h3 className="font-semibold">{messages.schemas}</h3>
            <ul className="space-y-1">
              {state.reference.schemas.map((schema) => (
                <li key={schema.name}>
                  <SchemaDetails summary={schema.name} json={schema.json} />
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </section>
  );
}

/**
 * 1操作の見出し・経路・要求と応答。
 * 表示言語の文言が`operationId`にあればそれを、無ければOpenAPI文書の文言を表示する。
 */
function OperationItem({ operation }: { operation: ResourceApiOperation }) {
  const messages = useMessages(resourceApiReferenceMessages);
  const text = messages.operations[operation.operationId];
  const description = text?.description ?? operation.description;

  return (
    <article className="space-y-2 border-t border-default pt-4">
      <h3 className="font-semibold">{text?.summary ?? operation.summary}</h3>
      <p>
        <code className="text-sm">
          {operation.method} {operation.path}
        </code>
      </p>
      {description === null ? null : <p className="text-sm text-muted">{description}</p>}
      <h4 className="text-sm font-semibold">{messages.request}</h4>
      {operation.requestSchema === null ? (
        <p className="text-sm">{messages.noBody}</p>
      ) : (
        <SchemaDetails summary="application/json" json={operation.requestSchema} />
      )}
      <h4 className="text-sm font-semibold">{messages.responses}</h4>
      <dl className="space-y-2 text-sm">
        {operation.responses.map((response) => (
          <div key={response.status}>
            <dt className="font-semibold">{response.status}</dt>
            <dd className="space-y-1">
              <p>{text?.responses[response.status] ?? response.description}</p>
              {response.schema === null ? null : (
                <SchemaDetails summary="application/json" json={response.schema} />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

/**
 * 折りたたんだschemaのJSON。
 */
function SchemaDetails({ summary, json }: { summary: string; json: string }) {
  return (
    <details>
      <summary className="cursor-pointer text-sm underline">{summary}</summary>
      <pre className="mt-2 overflow-x-auto text-xs">{json}</pre>
    </details>
  );
}
