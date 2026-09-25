import { Button, Description, FieldError, Input, Label, TextField } from "@heroui/react";

import { commonMessages } from "../../../lib/i18n/common-messages";
import { useMessages } from "../../../lib/i18n/i18n-provider";
import { ErrorNotice, SuccessNotice } from "../../app-shell/components/status-messages";
import type { DisplayNameForm } from "../hooks/use-display-name-form";
import { settingsMessages } from "../messages";
import { LoadStatus } from "./load-status";
import { SettingsSection } from "./settings-section";

/**
 * 表示名の編集と保存。
 * @see ./settings-sections.test.tsx
 */
export function DisplayNameSection({ form }: { form: DisplayNameForm }) {
  const messages = useMessages(settingsMessages);
  const common = useMessages(commonMessages);

  return (
    <SettingsSection title={messages.displayNameTitle} description={messages.displayNameDescription}>
      {form.me === null ? (
        <LoadStatus error={form.loadError} onRetry={form.reload} />
      ) : (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (form.canSave) void form.save();
          }}
        >
          <TextField
            value={form.displayName}
            onChange={form.changeDisplayName}
            isInvalid={form.issue !== null}
            isRequired
            validationBehavior="aria"
          >
            <Label>{messages.displayNameLabel}</Label>
            <Input />
            <Description>{messages.displayNameHint}</Description>
            <FieldError>
              {form.issue === "required" ? messages.displayNameRequired : messages.displayNameTooLong}
            </FieldError>
          </TextField>
          <p className="text-sm text-muted">{messages.accountsUserId(form.me.accountsUserId)}</p>
          <Button type="submit" variant="primary" isDisabled={!form.canSave}>
            {form.isSaving ? common.saving : common.save}
          </Button>
        </form>
      )}
      {form.saveError === null ? null : <ErrorNotice error={form.saveError} />}
      {form.isSaved ? <SuccessNotice>{common.saved}</SuccessNotice> : null}
    </SettingsSection>
  );
}
