/**
 * Harness configuration.
 *
 * Deliberately a plain module constant rather than `import.meta.env`: the
 * libraries under test forbid reading the environment, and the harness models
 * the host injecting config at runtime, exactly as the control's `init()` does.
 */
export const API_BASE_PATH = '/api/v1';

/** The absolute API root, resolved against wherever the harness is served. */
export function resolveBaseUrl(origin: string = window.location.origin): string {
  return `${origin}${API_BASE_PATH}`;
}
