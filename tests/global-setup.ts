// Runs once before any test file. Tests read pinned inputs through
// readSource; with a cold .cache/sources/ each worker would download its own
// inputs from Door43 inside a test's timeout, many at once, and a burst of
// 500s or a slow fetch failed tests that had nothing wrong with them
// (issue #111). Fetching what is missing here, a few at a time and with
// retries, leaves the tests reading only from the cache.
import { fetchMissing, sources } from "../scripts/lib/sources.ts";

export default async function setup(): Promise<void> {
  const fetched = await fetchMissing(sources());
  if (fetched > 0) {
    console.log(`fetched ${fetched} pinned inputs into .cache/sources/`);
  }
}
