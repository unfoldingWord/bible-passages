#!/usr/bin/env bash
# The release path (docs/schema.md, "Releases"), shared by
# .github/workflows/release.yml and a local dry run so both run the same
# steps. Run from the repository root after `npm ci`.
#
#   scripts/release/run.sh <tag>          release: the tag must exist; makes a
#                                         draft GitHub release (workflow only)
#   scripts/release/run.sh --dry-run [tag]
#                                         every step up to, not including,
#                                         creating the release, at HEAD; the
#                                         tag defaults to v<package.json version>
#
# A dry run creates no tag and no release and needs no token. It refuses to
# start unless data/ and dist/ are clean (the build overwrites them, so an
# uncommitted edit would be lost without a trace), and restores both when it
# ends, passed or failed. It does fetch main and the release tags from
# origin (--force moves local tag refs to match), as the release must.
set -euo pipefail

dry_run=false
if [ "${1:-}" = "--dry-run" ]; then
  dry_run=true
  shift
fi
version=$(node -p 'require("./package.json").version')
TAG=${1:-}
if [ -z "$TAG" ]; then
  if ! $dry_run; then
    echo "usage: scripts/release/run.sh [--dry-run] <tag>" >&2
    exit 2
  fi
  TAG="v$version"
fi
$dry_run && echo "Dry run for $TAG at HEAD $(git rev-parse --short HEAD): no tag or release is created."

# Before anything writes: the build below overwrites data/ and dist/, and the
# check in step 3 can only compare with what is committed.
dirty=$(git status --porcelain --untracked-files=all -- data dist)
if [ -n "$dirty" ]; then
  echo "$dirty"
  echo "::error::data/ or dist/ has uncommitted changes; commit or stash them first."
  exit 1
fi
if $dry_run; then
  # Safe to clean: both were just shown to match HEAD, untracked files included.
  trap 'git checkout -- data dist && git clean -fdq -- data dist && echo "data/ and dist/ restored to the committed files."' EXIT
fi

# 1. The committed dist/ already carries package.json's version, so the tag
# must name that version: bump package.json in a reviewed PR, then tag the
# merge.
echo "::group::Tag is vX.Y.Z, matches package.json and is on main"
if ! [[ "$TAG" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
  echo "::error::Tag $TAG is not vX.Y.Z."
  exit 1
fi
if [ "v$version" != "$TAG" ]; then
  echo "::error::Tag $TAG does not match package.json version $version."
  exit 1
fi
if $dry_run; then
  commit=$(git rev-parse HEAD)
else
  commit=$(git rev-parse "$TAG^{commit}")
fi
git fetch --no-tags origin main
if ! git merge-base --is-ancestor "$commit" FETCH_HEAD; then
  echo "::error::Commit $commit for $TAG is not on main."
  exit 1
fi
echo "$TAG names package.json $version; $commit is on main."
echo "::endgroup::"

# The release tags are the key check's baseline. Fetch them explicitly: an
# empty tag list reads as "never released" and skips every span comparison.
echo "::group::Fetch release tags"
git fetch --tags --force origin
echo "::endgroup::"

# 2. RELEASE_TAG makes the key-stability test compare with every release tag
# except this one, rather than with this tag itself.
echo "::group::npm run verify"
RELEASE_TAG="$TAG" npm run verify
echo "::endgroup::"

# 3. As in CI: data/ and dist/ rebuilt from the pinned sources must match
# the committed files exactly.
echo "::group::Generated files match a fresh build"
npm run build
git status --porcelain --untracked-files=all -- data dist
if [ -n "$(git status --porcelain --untracked-files=all -- data dist)" ]; then
  echo "::error::data/ or dist/ differs from a fresh build."
  exit 1
fi
echo "::endgroup::"

# 4. Only source.revision changes: it becomes the tag. Every attached file
# must then carry it (scripts/lib/release.ts).
echo "::group::Build dist/ for the release"
RELEASE_TAG="$TAG" node scripts/data/dist.ts
# An assignment, not process substitution, so a failed check stops the run.
assets=$(node scripts/release/assets.ts "$TAG")
mapfile -t files <<<"$assets"
# A log line only: checkAssets has already decided.
grep -H '"revision"' "${files[@]}" || true
echo "::endgroup::"

notes="tc-mobile template packages v0 for $TAG, built from the pinned sources in sources.json at this tag. See docs/schema.md, \"Releases\"."
# The release needs GITHUB_REPOSITORY (set -u); a local dry run may lack it.
if $dry_run; then repo=${GITHUB_REPOSITORY:-unfoldingWord/bible-passages}; else repo=$GITHUB_REPOSITORY; fi
create=(gh release create "$TAG" "${files[@]}" --repo "$repo"
  --verify-tag --draft --title "$TAG" --notes "$notes")
if $dry_run; then
  echo "Dry run passed. A release would run:"
  printf ' %q' "${create[@]}"
  echo
  exit 0
fi

"${create[@]}"
