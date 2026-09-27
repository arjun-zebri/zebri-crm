#!/usr/bin/env bash
# Start the local Supabase stack in CI, surviving registry rate limits.
#
# Why this exists: `supabase start` pulls its images from public.ecr.aws by
# default, and ECR Public caps anonymous pulls per source IP. GitHub-hosted
# runners share IPs, so CI intermittently died with
# "toomanyrequests: Data limit exceeded" before a single test ran.
#
# Two defences:
#   1. Only start the services the tests use. Integration + e2e need
#      postgres, auth (gotrue), postgrest, kong and storage; nothing touches
#      realtime, edge functions, mail, studio or analytics. That cuts the pull
#      from 13 images to 5.
#   2. Try each registry Supabase publishes the same images to, in turn:
#      Docker Hub (not rate limited for GitHub-hosted runners), then GHCR,
#      then ECR last. `SUPABASE_INTERNAL_IMAGE_REGISTRY` is the pinned CLI's
#      (v2.65.5) switch for this; every image tag it pins was confirmed to
#      exist on all three registries before this landed.
#
# Bumping the CLI? Re-check that the new pinned tags exist on docker.io and
# ghcr.io, and that `supabase start --help` still lists these -x names.
set -uo pipefail

EXCLUDE="realtime,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor"
REGISTRIES=(docker.io ghcr.io public.ecr.aws)

attempt=0
for round in 1 2; do
  for registry in "${REGISTRIES[@]}"; do
    attempt=$((attempt + 1))
    echo "::group::supabase start via ${registry} (attempt ${attempt})"
    if SUPABASE_INTERNAL_IMAGE_REGISTRY="$registry" supabase start --workdir . -x "$EXCLUDE"; then
      echo "::endgroup::"
      exit 0
    fi
    echo "::endgroup::"
    echo "::warning::supabase start failed via ${registry}; trying the next registry"
    # Clear any half-started containers so the next attempt starts clean.
    supabase stop --no-backup --workdir . >/dev/null 2>&1 || true
    sleep $((round * 15))
  done
done

echo "::error::supabase start failed on every registry"
exit 1
