#!/usr/bin/env bash
#
# Turns this template into a named project by replacing every placeholder
# token (in file contents and in tracked paths) with the given project name.
#
# Usage: scripts/init_project.sh "My Project"
#
#   Citadel Placeholder -> My Project
#   CitadelPlaceholder  -> MyProject
#   CITADEL_PLACEHOLDER -> MY_PROJECT
#   citadel_placeholder -> my_project
#   citadel-placeholder -> my-project
#
# README.md is kept by the new project, so the template's bare name is also
# replaced there (and only there):
#
#   citadel             -> my_project
#
# Changes are left uncommitted for review.

set -euo pipefail

SELF="scripts/init_project.sh"
README="README.md"
TOKENS='Citadel Placeholder|CitadelPlaceholder|CITADEL_PLACEHOLDER|citadel_placeholder|citadel-placeholder'

function usage() {
  echo "Usage: $SELF \"Project Name\"" >&2
  echo "  The name must start with a letter and contain only letters, digits, spaces, '-' or '_'." >&2
  exit 1
}

if [ $# -ne 1 ] || ! echo "$1" | grep -qE '^[A-Za-z][A-Za-z0-9 _-]*$'; then
  usage
fi

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

read -r -a WORDS <<< "$(echo "$1" | tr '_-' '  ')"

export NAME_TITLE NAME_PASCAL NAME_UPPER NAME_SNAKE NAME_KEBAB
NAME_TITLE="${WORDS[*]}"
NAME_PASCAL=""
for word in "${WORDS[@]}"; do
  NAME_PASCAL+="$(echo "${word:0:1}" | tr '[:lower:]' '[:upper:]')${word:1}"
done
NAME_SNAKE="$(IFS=_; echo "${WORDS[*]}" | tr '[:upper:]' '[:lower:]')"
NAME_KEBAB="$(IFS=-; echo "${WORDS[*]}" | tr '[:upper:]' '[:lower:]')"
NAME_UPPER="$(echo "$NAME_SNAKE" | tr '[:lower:]' '[:upper:]')"

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is dirty; commit or stash your changes first." >&2
  exit 1
fi

CONTENT_FILES="$(git grep -lIE "$TOKENS" -- . ":!$SELF" || true)"
PATH_FILES="$(git ls-files | grep -E "$TOKENS" | grep -vxF "$SELF" || true)"

README_PENDING=false
if [ -f "$README" ] && grep -q 'citadel' "$README"; then
  README_PENDING=true
fi

if [ -z "$CONTENT_FILES" ] && [ -z "$PATH_FILES" ] && [ "$README_PENDING" = false ]; then
  echo "No placeholder found; this project looks already initialized." >&2
  exit 1
fi

# Names come through the environment so perl never interpolates them as code.
REPLACE='
  s/Citadel Placeholder/$ENV{NAME_TITLE}/g;
  s/CitadelPlaceholder/$ENV{NAME_PASCAL}/g;
  s/CITADEL_PLACEHOLDER/$ENV{NAME_UPPER}/g;
  s/citadel_placeholder/$ENV{NAME_SNAKE}/g;
  s/citadel-placeholder/$ENV{NAME_KEBAB}/g;
'

content_count=0
if [ -n "$CONTENT_FILES" ]; then
  echo "$CONTENT_FILES" | tr '\n' '\0' | xargs -0 perl -pi -e "$REPLACE"
  content_count=$(echo "$CONTENT_FILES" | wc -l | tr -d ' ')
fi

# Runs after the placeholder pass, so 'citadel_placeholder' is already gone and
# only the template's bare name is left to replace.
if [ -f "$README" ] && grep -q 'citadel' "$README"; then
  perl -pi -e 's/citadel/$ENV{NAME_SNAKE}/g' "$README"
  README_PENDING=true
fi

path_count=0
OLD_DIRS=()
if [ -n "$PATH_FILES" ]; then
  while IFS= read -r old_path; do
    new_path="$(echo "$old_path" | perl -pe "$REPLACE")"
    mkdir -p "$(dirname "$new_path")"
    git mv "$old_path" "$new_path"
    OLD_DIRS+=("$(dirname "$old_path")")
    path_count=$((path_count + 1))
  done <<< "$PATH_FILES"

  # Remove the old folders left empty by the moves, walking up while the
  # folder is still placeholder-named.
  for dir in "${OLD_DIRS[@]}"; do
    while [ -d "$dir" ] && echo "$dir" | grep -qE "$TOKENS" && [ -z "$(ls -A "$dir")" ]; do
      rmdir "$dir"
      dir="$(dirname "$dir")"
    done
  done
fi

echo "Initialized project:"
echo "  Title:  $NAME_TITLE"
echo "  Pascal: $NAME_PASCAL"
echo "  Upper:  $NAME_UPPER"
echo "  Snake:  $NAME_SNAKE"
echo "  Kebab:  $NAME_KEBAB"
echo "Updated $content_count file(s), renamed $path_count path(s)."
if [ "$README_PENDING" = true ]; then
  echo "Replaced the template name 'citadel' with '$NAME_SNAKE' in $README."
fi
echo "Review with 'git status' and 'git diff', then commit."
