/** Unique, clearly-labelled record names so test data never collides with real rows. */
export const TEST_PREFIX = 'ZZ-E2E'

export function uniqueName(label: string): string {
  const stamp = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`
  return `${TEST_PREFIX} ${label} ${stamp}`
}
