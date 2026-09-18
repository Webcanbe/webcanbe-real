/** A repeated capture can advance sequence without changing the displayed view.
 * Pointer coordinates may be rebound only to an exactly identical raster in the
 * same route, viewport, generation and accepted source revision. Server-side input
 * still checks the new sequence and fresh authority. No fuzzy/image hash match. */
type Raster = { png?: string; generation?: string; revision?: string; observation?: { route: string; viewport: { width: number; height: number } } }
export function samePointerFrame(before?: Raster, after?: Raster) {
  return Boolean(before?.png && before.generation && before.revision && before.observation && after?.observation && before.png === after.png && before.generation === after.generation && before.revision === after.revision && before.observation.route === after.observation.route && before.observation.viewport.width === after.observation.viewport.width && before.observation.viewport.height === after.observation.viewport.height)
}
