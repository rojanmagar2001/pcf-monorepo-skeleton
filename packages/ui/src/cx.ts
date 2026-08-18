/**
 * Minimal class-name joiner.
 *
 * Local rather than a dependency: every byte here is bundled into the control,
 * and this is the whole of what the library needs.
 */
export type ClassValue = string | false | null | undefined;

export function cx(...values: ClassValue[]): string {
  let out = '';
  for (const value of values) {
    if (!value) continue;
    out = out === '' ? value : `${out} ${value}`;
  }
  return out;
}
