import { FieldError, Input, TextField } from "@heroui/react";

import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { ErrorNotice, SuccessNotice } from "../../app-shell/components/status-messages";
import type { DisplayNameForm } from "../hooks/use-display-name-form";
import { settingsMessages } from "../messages";
import { LoadStatus } from "./load-status";
import { SettingsSection } from "./settings-section";

/**
 * 表示名の入力と文字数。
 * 保存・破棄は画面下の保存バーで行い、Enterでも保存する。
 * @see ./settings-sections.test.tsx
 */
export function DisplayNameSection({ form }: { form: DisplayNameForm }) {
  const messages = useMessages(settingsMessages);
  const common = useMessages(commonMessages);
  const isInvalid = form.issue !== null;

  return (
    <SettingsSection title={messages.displayNameTitle} description={messages.displayNameDescription}>
      {form.me === null ? (
        <LoadStatus error={form.loadError} onRetry={form.reload} />
      ) : (
        <form
          className="w-full"
          onSubmit={(event) => {
            event.preventDefault();
            if (form.canSave) void form.save();
          }}
        >
          <TextField
            aria-label={messages.displayNameTitle}
            value={form.displayName}
            onChange={form.changeDisplayName}
            isInvalid={isInvalid}
            isRequired
            validationBehavior="aria"
            className="w-full"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Input className="max-w-[calc(360px*var(--scale))] min-w-0 flex-[1_1_calc(220px*var(--scale))]" />
              <span className={`text-xs tabular-nums ${isInvalid ? "text-danger" : "text-muted"}`}>
                {messages.displayNameCount(form.displayNameLength)}
              </span>
            </div>
            <FieldError>
              {form.issue === "required" ? messages.displayNameRequired : messages.displayNameTooLong}
            </FieldError>
          </TextField>
        </form>
      )}
      {form.saveError === null ? null : <ErrorNotice error={form.saveError} />}
      {form.isSaved ? <SuccessNotice>{common.saved}</SuccessNotice> : null}
    </SettingsSection>
  );
}
