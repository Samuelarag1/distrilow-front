"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField, focusFirstError } from "@/components/common/form-field";
import type { BranchType } from "@/lib/api-types";
import {
  BRANCH_TYPE_LABELS,
  type BranchFormErrors,
  type BranchFormValues,
} from "@/lib/branches/branch-form";

/** Field id inside a branch form: `${idPrefix}-${field}`. */
function branchFieldId(idPrefix: string, field: keyof BranchFormValues) {
  return `${idPrefix}-${field}`;
}

/** After a failed submit: focus the first field with an error, in form order. */
export function focusFirstBranchError(idPrefix: string, errors: BranchFormErrors) {
  focusFirstError(
    (["name", "code", "address", "email"] as const).map((field) => [
      branchFieldId(idPrefix, field),
      errors[field],
    ])
  );
}

/**
 * The fields of a branch, shared by Sucursales (create and edit) and the
 * onboarding, so both ask for the same thing in the same way.
 */
export function BranchFormFields({
  idPrefix,
  values,
  errors,
  onChange,
}: {
  idPrefix: string;
  values: BranchFormValues;
  errors: BranchFormErrors;
  onChange: <K extends keyof BranchFormValues>(
    field: K,
    value: BranchFormValues[K]
  ) => void;
}) {
  const id = (field: keyof BranchFormValues) => branchFieldId(idPrefix, field);

  return (
    <>
      {/* One column on a phone, two from sm up. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={id("name")} label="Nombre" error={errors.name}>
          <Input
            id={id("name")}
            value={values.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="Ej: Sucursal Centro"
          />
        </FormField>
        <FormField id={id("code")} label="Código" error={errors.code}>
          <Input
            id={id("code")}
            value={values.code}
            onChange={(e) => onChange("code", e.target.value)}
            placeholder="Ej: SUC-001"
            autoCapitalize="characters"
            spellCheck={false}
          />
        </FormField>
      </div>

      <FormField id={id("address")} label="Dirección" error={errors.address}>
        <Input
          id={id("address")}
          value={values.address}
          onChange={(e) => onChange("address", e.target.value)}
          placeholder="Ej: Av. Siempreviva 742"
        />
      </FormField>

      <FormField id={id("branchType")} label="Tipo">
        <Select
          value={values.branchType}
          onValueChange={(value) => onChange("branchType", value as BranchType)}
        >
          <SelectTrigger id={id("branchType")} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(BRANCH_TYPE_LABELS) as BranchType[]).map((type) => (
              <SelectItem key={type} value={type}>
                {BRANCH_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={id("phone")} label="Teléfono (opcional)">
          <Input
            id={id("phone")}
            type="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={(e) => onChange("phone", e.target.value)}
            placeholder="Ej: 351 555-1234"
          />
        </FormField>
        <FormField id={id("email")} label="Email (opcional)" error={errors.email}>
          <Input
            id={id("email")}
            type="email"
            autoCapitalize="none"
            spellCheck={false}
            value={values.email}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="sucursal@ejemplo.com"
          />
        </FormField>
      </div>
    </>
  );
}
