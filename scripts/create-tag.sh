#!/usr/bin/env bash
# scripts/create-tag.sh — owner-gated tag staging
#
# Usage:
#   scripts/create-tag.sh                    # dry-run (default)
#   scripts/create-tag.sh --execute          # actually create the tag
#   scripts/create-tag.sh --execute --push   # create + push (DANGEROUS)
#
# This script is intentionally conservative:
#   - Default behavior is DRY-RUN: prints what would be done.
#   - The --execute flag is the explicit owner opt-in.
#   - The --push flag requires both --execute and a second confirmation prompt.
#   - The script aborts if the working tree has uncommitted changes that
#     could pollute the release state.
#
# Exit codes:
#   0 = success or dry-run
#   1 = failure (validation, dirty tree, missing tag message, etc.)
#   2 = dry-run only, no action taken
#
# This script does NOT modify any history. It uses `git tag -a` for
# annotated tags so the tag carries the version metadata and the
# release notes.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

TAG_NAME="${TAG_NAME:-v1.0.0-rc1}"
TAG_MESSAGE_FILE="${TAG_MESSAGE_FILE:-$REPO_ROOT/artifacts/release-candidates/v1.0/CHANGELOG.md}"
EXECUTE=0
PUSH=0

for arg in "$@"; do
  case "$arg" in
    --execute) EXECUTE=1 ;;
    --push) PUSH=1 ;;
    --tag=*) TAG_NAME="${arg#--tag=}" ;;
    --message=*) TAG_MESSAGE_FILE="${arg#--message=}" ;;
    -h|--help)
      sed -n '2,25p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

# --- Validation -----------------------------------------------------------

if [ ! -f "$TAG_MESSAGE_FILE" ]; then
  echo "Tag message file not found: $TAG_MESSAGE_FILE" >&2
  echo "Set TAG_MESSAGE_FILE to the path of the annotated tag body." >&2
  exit 1
fi

if [ "$EXECUTE" -eq 0 ]; then
  echo "DRY-RUN — no tag will be created. Pass --execute to actually create the tag."
  echo ""
fi

if ! git diff --quiet HEAD -- 2>/dev/null; then
  echo "Working tree has unstaged changes. Commit or stash before tagging." >&2
  echo "Use --allow-dirty to override (not recommended)." >&2
  if [ "${ALLOW_DIRTY:-0}" != "1" ]; then
    exit 1
  fi
  echo "ALLOW_DIRTY=1 set; proceeding despite dirty tree."
fi

# Check if tag already exists
if git rev-parse --verify "refs/tags/$TAG_NAME" >/dev/null 2>&1; then
  echo "Tag '$TAG_NAME' already exists locally." >&2
  if [ "$EXECUTE" -eq 0 ]; then
    echo "DRY-RUN: would refuse to overwrite existing tag."
    exit 2
  fi
  echo "Refusing to overwrite existing tag. Delete it first or pick a new tag name." >&2
  exit 1
fi

# Check remote configuration (informational only)
REMOTE_URL="$(git config --get remote.origin.url || true)"
if [ -z "$REMOTE_URL" ]; then
  echo "No remote 'origin' configured. The tag will only exist locally."
  echo "Configure a remote with: git remote add origin <url>" >&2
fi

# --- Action ---------------------------------------------------------------

TAG_BODY="$(cat "$TAG_MESSAGE_FILE")"
TAG_SUBJECT="Release $TAG_NAME"

echo "Tag name:    $TAG_NAME"
echo "Tag type:    annotated (-a)"
echo "Tag subject: $TAG_SUBJECT"
echo "Tag body:    $TAG_MESSAGE_FILE ($(wc -l <"$TAG_MESSAGE_FILE") lines)"
echo "Remote:      ${REMOTE_URL:-<none configured>}"
echo ""

if [ "$EXECUTE" -eq 0 ]; then
  echo "DRY-RUN complete. No action taken."
  echo "To create the tag, run: scripts/create-tag.sh --execute"
  if [ "$PUSH" -eq 1 ]; then
    echo "  (the --push flag is ignored in dry-run)"
  fi
  exit 2
fi

# Confirmation prompt for --execute (skipped when --yes is set)
if [ "${YES:-0}" != "1" ]; then
  echo "About to create annotated tag '$TAG_NAME'."
  if [ "$PUSH" -eq 1 ]; then
    echo "And then push it to '${REMOTE_URL:-<no remote>}'."
  fi
  read -r -p "Proceed? [y/N] " confirm
  case "$confirm" in
    y|Y|yes|YES) ;;
    *)
      echo "Aborted."
      exit 1
      ;;
  esac
fi

# Create the annotated tag
GIT_EDITOR=true git tag -a "$TAG_NAME" -m "$TAG_SUBJECT" -F "$TAG_MESSAGE_FILE"
echo "Tag '$TAG_NAME' created locally."
git show --no-patch --format="%H%n%s%n%an <%ae>%n%ad" "$TAG_NAME"

# Optional push
if [ "$PUSH" -eq 1 ]; then
  if [ -z "$REMOTE_URL" ]; then
    echo "Cannot push: no remote 'origin' configured." >&2
    exit 1
  fi
  echo ""
  echo "Pushing tag to origin..."
  git push origin "$TAG_NAME"
  echo "Tag pushed."
fi

echo ""
echo "Done."
