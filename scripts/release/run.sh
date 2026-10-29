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
# A dry run creates no tag and no release, needs no token, and restores
# dist/ afterwards (it was checked clean before being rebuilt for the tag).
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
grep -H '"revision"' "${files[@]}"
echo "::endgroup::"

notes="tc-mobile template packages v0 for $TAG, built from the pinned sources in sources.json at this tag. See docs/schema.md, \"Releases\"."
if $dry_run; then
  echo "Dry run passed. A release would run:"
  echo "  gh release create $TAG ${files[*]} --verify-tag --draft --title $TAG"
  git checkout -- dist
  echo "dist/ restored to the committed files."
  exit 0
fi

gh release create "$TAG" "${files[@]}" \
  --repo "$GITHUB_REPOSITORY" \
  --verify-tag \
  --draft \
  --title "$TAG" \
  --notes "$notes"
