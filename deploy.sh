#!/bin/bash
# Deploy current Code/public/ to GitHub Pages.
# Run from the repo root after committing changes to main.

set -e
cd "$(dirname "$0")"

if ! git diff-index --quiet HEAD --; then
  echo "ERROR: working tree has uncommitted changes. Commit first."
  exit 1
fi

# Recreate gh-pages branch from current Code/public/
git branch -D gh-pages 2>/dev/null || true
git subtree split --prefix Code/public -b gh-pages
git push origin gh-pages --force
git branch -D gh-pages

echo ""
echo "Deployed. Live in ~30s at:"
echo "  https://vincentbeermann.github.io/sport-tracker/"
echo ""
echo "On iPhone: pull to refresh in the installed app, or hard-reload in Safari."
