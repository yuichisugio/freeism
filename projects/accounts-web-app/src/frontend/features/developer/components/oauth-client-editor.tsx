import { Button, Description, FieldError, Input, Label, TextArea, TextField } from "@heroui/react";
import { useId } from "react";

import { BffError } from "../../../lib/api-client";
import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { CopyButton } from "../../app-shell/components/copy-button";
import type { OAuthClientFeedback, OAuthClientsState } from "../hooks/use-oauth-clients";
import { developerMessages } from "../messages";
import type { DeveloperMessages } from "../messages";

/**
 * 選択したOAuthクライアントの編集、または新規登録の入力。
 * アプリ名・紹介URL・説明文をアプリ情報、リダイレクトURL・Client ID・公開鍵を接続情報として分ける。
 * @see ./developer-page.test.tsx
 */

// --------------------------------------------------
// 入力不備の文言
// --------------------------------------------------

type FieldErrorKind = "required" | "invalidUrl" | "invalidRedirectUri" | "invalidJson" | "invalidKeys";

type RequestField = "name" | "uri" | "description" | "redirectUris" | "jwks";

/**
 * 保存の失敗応答のうち、指定した項目の入力不備の内容を返す。
 */
function serverIssueText(feedback: OAuthClientFeedback | null, field: RequestField): string | undefined {
  if (feedback?.kind !== "saveFailed" || !(feedback.error instanceof BffError)) return undefined;
  const issueMessages =
    feedback.error.problem?.errors?.filter((issue) => issue.path?.[0] === field).map((issue) => issue.message) ?? [];
  return issueMessages.length === 0 ? undefined : issueMessages.join(" ");
}

/**
 * 画面での入力不備、無ければ保存の失敗応答の入力不備を、項目に表示する文言にする。
 */
function fieldErrorText(
  messages: DeveloperMessages,
  kind: FieldErrorKind | undefined,
  serverText: string | undefined,
): string | undefined {
  return kind === undefined ? serverText : messages[kind];
}

// --------------------------------------------------
// ビュー
// --------------------------------------------------

/**
 * OAuthクライアントの入力欄と「保存」「削除」。
 */
export function OAuthClientEditor({ state }: { state: OAuthClientsState }) {
  const messages = useMessages(developerMessages);
  const common = useMessages(commonMessages);
  const appInfoHeadingId = useId();
  const connectionHeadingId = useId();
  const redirectUrisLabelId = useId();
  const { editTarget, form, fieldErrors, feedback } = state;
  if (editTarget === null) return null;

  const nameError = fieldErrorText(messages, fieldErrors.name, serverIssueText(feedback, "name"));
  const uriError = fieldErrorText(messages, fieldErrors.uri, serverIssueText(feedback, "uri"));
  const descriptionError = serverIssueText(feedback, "description");
  const redirectUrisServerError = serverIssueText(feedback, "redirectUris");
  const jwksError = fieldErrorText(messages, fieldErrors.jwks, serverIssueText(feedback, "jwks"));
  const clientId = editTarget.kind === "existing" ? editTarget.client.clientId : null;

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (state.canSave) void state.save();
      }}
    >
      <h2 className="text-lg font-semibold">
        {editTarget.kind === "new" ? messages.newClientTitle : editTarget.client.name}
      </h2>

      <section aria-labelledby={appInfoHeadingId} className="space-y-4">
        <h3 id={appInfoHeadingId} className="font-semibold">
          {messages.appInfoTitle}
        </h3>
        <TextField
          value={form.name}
          onChange={(value) => state.changeField("name", value)}
          isInvalid={nameError !== undefined}
          isRequired
          validationBehavior="aria"
        >
          <Label>{messages.nameLabel}</Label>
          <Input />
          <Description>{messages.nameHint}</Description>
          <FieldError>{nameError}</FieldError>
        </TextField>
        <TextField
          type="text"
          inputMode="url"
          value={form.uri}
          onChange={(value) => state.changeField("uri", value)}
          isInvalid={uriError !== undefined}
          validationBehavior="aria"
        >
          <Label>{messages.uriLabel}</Label>
          <Input />
          <Description>{messages.uriHint}</Description>
          <FieldError>{uriError}</FieldError>
        </TextField>
        <TextField
          value={form.description}
          onChange={(value) => state.changeField("description", value)}
          isInvalid={descriptionError !== undefined}
          validationBehavior="aria"
        >
          <Label>{messages.descriptionLabel}</Label>
          <TextArea rows={3} />
          <Description>{messages.descriptionHint}</Description>
          <FieldError>{descriptionError}</FieldError>
        </TextField>
      </section>

      <section aria-labelledby={connectionHeadingId} className="space-y-4">
        <h3 id={connectionHeadingId} className="font-semibold">
          {messages.connectionTitle}
        </h3>
        <div role="group" aria-labelledby={redirectUrisLabelId} className="space-y-2">
          <p id={redirectUrisLabelId} className="text-sm font-medium">
            {messages.redirectUrisLabel}
          </p>
          <p className="text-sm text-muted">{messages.redirectUrisHint}</p>
          {form.redirectUris.map((redirectUri, index) => {
            const rowError = fieldErrors.redirectUris[index];
            return (
              // 行は位置で識別し、入力値は常にフックの状態から描画する。
              <div key={index} className="flex items-start gap-2">
                <TextField
                  className="flex-1"
                  type="text"
                  inputMode="url"
                  aria-label={messages.redirectUriLabel(index + 1)}
                  value={redirectUri}
                  onChange={(value) => state.changeRedirectUri(index, value)}
                  isInvalid={rowError !== undefined}
                  isRequired
                  validationBehavior="aria"
                >
                  <Input />
                  <FieldError>{rowError === undefined ? undefined : messages[rowError]}</FieldError>
                </TextField>
                <Button
                  variant="ghost"
                  aria-label={messages.removeRedirectUri(index + 1)}
                  isDisabled={form.redirectUris.length === 1}
                  onPress={() => state.removeRedirectUri(index)}
                >
                  {messages.remove}
                </Button>
              </div>
            );
          })}
          {redirectUrisServerError === undefined ? null : (
            <p className="text-sm text-danger">{redirectUrisServerError}</p>
          )}
          <Button variant="secondary" size="sm" onPress={state.addRedirectUri}>
            {messages.addRedirectUri}
          </Button>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium">{messages.clientIdLabel}</p>
          {clientId === null ? (
            <p className="text-sm text-muted">{messages.clientIdPending}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <code className="break-all rounded bg-default px-2 py-1 text-sm">{clientId}</code>
              <CopyButton key={clientId} text={clientId} label={messages.copyClientId} />
            </div>
          )}
        </div>

        <TextField
          value={form.jwksText}
          onChange={(value) => state.changeField("jwksText", value)}
          isInvalid={jwksError !== undefined}
          isRequired
          validationBehavior="aria"
        >
          <Label>{messages.jwksLabel}</Label>
          <TextArea rows={8} className="font-mono text-sm" spellCheck={false} />
          <Description>{messages.jwksHint}</Description>
          <FieldError>{jwksError}</FieldError>
        </TextField>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" isDisabled={!state.canSave}>
          {state.isSaving ? common.saving : common.save}
        </Button>
        {editTarget.kind === "existing" ? (
          <Button variant="danger" onPress={state.requestDelete}>
            {messages.deleteClient}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
