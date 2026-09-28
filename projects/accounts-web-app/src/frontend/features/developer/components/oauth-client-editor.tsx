import { Button, Description, FieldError, Input, Label, TextArea, TextField } from "@heroui/react";
import { useId } from "react";
import type { ReactNode } from "react";

import { BffError } from "../../../lib/api-client";
import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { CopyButton } from "../../app-shell/components/copy-button";
import { PlusIcon } from "../../app-shell/components/icons";
import type { OAuthClientFeedback, OAuthClientsState } from "../hooks/use-oauth-clients";
import { developerMessages } from "../messages";
import type { DeveloperMessages } from "../messages";

/**
 * 一覧の下に開くOAuthクライアントの登録・編集のフォーム。
 * 各項目は、項目名と「必須」「任意」の印、その直下に説明文、その下に入力欄の順に置く。
 * @see ../../../../../docs/specification/v0.1/design-system.ja.md
 * @see ./developer-section.test.tsx
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
 * 項目名の右の「必須」「任意」の印。
 * 必須かどうかは入力欄の属性でも伝えるため、印は読み上げない。
 */
function FieldMark({ isRequired }: { isRequired: boolean }) {
  const messages = useMessages(developerMessages);
  return (
    <span
      aria-hidden="true"
      className={`ml-2 rounded-full px-2 text-xs leading-5 font-normal ${isRequired ? "bg-danger-soft text-danger" : "bg-surface-secondary text-muted"}`}
    >
      {isRequired ? messages.requiredMark : messages.optionalMark}
    </span>
  );
}

/**
 * 項目名と印（`TextField`の中で使う）。
 */
function FieldLabel({ children, isRequired }: { children: ReactNode; isRequired: boolean }) {
  return (
    // 必須は印で示すため、HeroUIが必須の項目名に付ける「*」は出さない。
    <Label className="after:content-none">
      {children}
      <FieldMark isRequired={isRequired} />
    </Label>
  );
}

/**
 * OAuthクライアントの入力欄と「保存」「キャンセル」、編集時だけ「削除」。
 */
export function OAuthClientEditor({ state }: { state: OAuthClientsState }) {
  const messages = useMessages(developerMessages);
  const common = useMessages(commonMessages);
  const headingId = useId();
  const redirectUrisLabelId = useId();
  const redirectUrisHintId = useId();
  const { editTarget, form, fieldErrors, feedback } = state;
  if (editTarget === null) return null;

  const nameError = fieldErrorText(messages, fieldErrors.name, serverIssueText(feedback, "name"));
  const uriError = fieldErrorText(messages, fieldErrors.uri, serverIssueText(feedback, "uri"));
  const descriptionError = serverIssueText(feedback, "description");
  const redirectUrisServerError = serverIssueText(feedback, "redirectUris");
  const jwksError = fieldErrorText(messages, fieldErrors.jwks, serverIssueText(feedback, "jwks"));

  return (
    <form
      aria-labelledby={headingId}
      className="flex w-full flex-col gap-5 border-t border-border pt-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (state.canSave) void state.save();
      }}
    >
      <h3 id={headingId} className="font-display text-lg font-bold">
        {editTarget.kind === "new" ? messages.newClientTitle : editTarget.client.name}
      </h3>

      <TextField
        value={form.name}
        onChange={(value) => state.changeField("name", value)}
        isInvalid={nameError !== undefined}
        isRequired
        validationBehavior="aria"
      >
        <FieldLabel isRequired>{messages.nameLabel}</FieldLabel>
        <Description>{messages.nameHint}</Description>
        <Input placeholder={messages.namePlaceholder} />
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
        <FieldLabel isRequired={false}>{messages.uriLabel}</FieldLabel>
        <Description>{messages.uriHint}</Description>
        <Input className="font-mono text-sm" placeholder={messages.uriPlaceholder} />
        <FieldError>{uriError}</FieldError>
      </TextField>

      <TextField
        value={form.description}
        onChange={(value) => state.changeField("description", value)}
        isInvalid={descriptionError !== undefined}
        validationBehavior="aria"
      >
        <FieldLabel isRequired={false}>{messages.descriptionLabel}</FieldLabel>
        <Description>{messages.descriptionHint}</Description>
        <TextArea rows={3} placeholder={messages.descriptionPlaceholder} />
        <FieldError>{descriptionError}</FieldError>
      </TextField>

      <div role="group" aria-labelledby={redirectUrisLabelId} aria-describedby={redirectUrisHintId} className="flex flex-col gap-2">
        <p id={redirectUrisLabelId} className="text-sm font-medium">
          {messages.redirectUrisLabel}
          <FieldMark isRequired />
        </p>
        <p id={redirectUrisHintId} className="text-xs text-muted">
          {messages.redirectUrisHint}
        </p>
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
                <Input className="font-mono text-sm" placeholder={messages.redirectUriPlaceholder} />
                <FieldError>{rowError === undefined ? undefined : messages[rowError]}</FieldError>
              </TextField>
              <Button
                size="sm"
                variant="ghost"
                className="mt-1.5"
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
        <div>
          <Button size="sm" variant="tertiary" aria-label={messages.addRedirectUriLabel} onPress={state.addRedirectUri}>
            <PlusIcon className="size-4" />
            {messages.addRedirectUri}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{messages.clientIdLabel}</p>
        {editTarget.kind === "existing" ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-surface-secondary px-2 py-1 font-mono text-sm break-all">
              {editTarget.client.clientId}
            </code>
            <CopyButton key={editTarget.client.clientId} text={editTarget.client.clientId} label={messages.copyClientId} />
          </div>
        ) : (
          <p className="text-xs text-muted">{messages.clientIdIssuedOnRegister}</p>
        )}
      </div>

      <TextField
        value={form.jwksText}
        onChange={(value) => state.changeField("jwksText", value)}
        isInvalid={jwksError !== undefined}
        isRequired
        validationBehavior="aria"
      >
        <FieldLabel isRequired>{messages.jwksLabel}</FieldLabel>
        <Description>{messages.jwksHint}</Description>
        <TextArea rows={8} className="font-mono text-sm" spellCheck={false} placeholder={messages.jwksPlaceholder} />
        <FieldError>{jwksError}</FieldError>
      </TextField>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant="primary" isDisabled={!state.canSave}>
          {state.isSaving ? common.saving : common.save}
        </Button>
        <Button variant="outline" isDisabled={state.isSaving} onPress={state.cancelEditing}>
          {common.cancel}
        </Button>
        {editTarget.kind === "existing" ? (
          <Button className="ml-auto" variant="danger" onPress={() => state.requestDelete(editTarget.client)}>
            {messages.deleteClient}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
