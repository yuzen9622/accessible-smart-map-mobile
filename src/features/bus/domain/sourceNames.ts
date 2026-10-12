/** Display labels never replace canonical request or identity values. */
export function busName(display: string | null | undefined, canonical: string | null | undefined, fallback = ''): string {
  return display?.trim() || canonical?.trim() || fallback;
}
