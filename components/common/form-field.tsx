import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { Label } from "@/components/ui/label";

/**
 * A labelled form control with its error (or, when there's none, a hint)
 * below. The control gets aria-invalid and aria-describedby pointing at that
 * message, so a screen reader reads the error with the field.
 */
export function FormField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  const messageId = `${id}-message`;
  const message = error ?? hint;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        "aria-invalid": error ? true : undefined,
        "aria-describedby": message ? messageId : undefined,
      })
    : children;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {control}
      {message && (
        <p
          id={messageId}
          className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
        >
          {message}
        </p>
      )}
    </div>
  );
}

/**
 * After a failed submit: focus (and so scroll to) the first field with an
 * error, in the order given. For a group (a checkbox list), its first control.
 */
export function focusFirstError(fieldIds: Array<[string, string | undefined]>) {
  const firstId = fieldIds.find(([, error]) => error)?.[0];
  if (!firstId) return;
  const element = document.getElementById(firstId);
  const target =
    element && !element.matches("input, button, textarea, select")
      ? element.querySelector<HTMLElement>("input, button, textarea, select")
      : element;
  target?.focus();
}
