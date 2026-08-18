import { z } from '@document-intake/api-client';

/**
 * Runtime validation of the manifest's input properties.
 *
 * The host will hand us whatever a maker typed into the property panel, so the
 * values are validated here rather than trusted. zod comes from
 * `@document-intake/api-client` so the control validates against the very same
 * zod instance the generated schemas were built with.
 *
 * Nothing below is hand-typed: `ControlInputs` is inferred from the schema.
 */
export const controlInputsSchema = z.object({
  baseUrl: z
    .string()
    .trim()
    .min(1, 'baseUrl is required.')
    .refine(
      (value) => /^https?:\/\//i.test(value) || value.startsWith('/'),
      'baseUrl must be an absolute http(s) URL or a host-relative path such as "/api/v1".',
    ),
  pageSize: z.number().int().min(1).max(200).catch(25),
});

export type ControlInputs = z.infer<typeof controlInputsSchema>;

export type ControlInputsResult =
  | { ok: true; value: ControlInputs }
  | { ok: false; message: string };

/**
 * Reads and validates the manifest inputs off the framework context.
 *
 * Returns a result rather than throwing: a misconfigured property should
 * render an error inside the control, not take the whole form down.
 */
export function readControlInputs(parameters: {
  baseUrl?: { raw?: string | null };
  pageSize?: { raw?: number | null };
}): ControlInputsResult {
  const parsed = controlInputsSchema.safeParse({
    baseUrl: parameters.baseUrl?.raw ?? '',
    pageSize: parameters.pageSize?.raw ?? 25,
  });

  if (parsed.success) return { ok: true, value: parsed.data };

  const message = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
    .join('; ');
  return { ok: false, message };
}
