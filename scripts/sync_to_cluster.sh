#!/usr/bin/env bash
# Sync the parts of the validated local pipeline state that are NOT in git to the 8xH100 cluster.
#
# The code itself is on GitHub now (branch hackathon-submission of
# git@github.com:eklavyagoyal/ehl-zurich-hackathon-submission.git) — clone that on the cluster
# first. This script only handles the data tiers .gitignore deliberately excludes: the compiled
# TimeF registry (~2MB, always), the trained checkpoint (308MB, opt-in — it's a *.pt file, .gitignore
# excludes those), and the raw ESA-AD Mission1 extract (3.6GB, opt-in, only needed to rebuild/widen
# the connector's build).
#
# Usage:
#   scripts/sync_to_cluster.sh user@cluster-host [--with-checkpoint] [--with-raw-data] \
#       [--remote-root PATH] [--remote-repo PATH]
#
#   --with-checkpoint   also copy OpenTSLM/results/.../best_model.pt (308MB) — useful as a
#                        fallback/reference checkpoint if a bigger cluster run doesn't finish.
#   --with-raw-data     also copy the raw ESA-AD Mission1 extract (3.6GB) — only needed if you
#                        plan to rebuild/widen the TimeNet connector's build on the cluster.
#                        Not needed to just train against the already-compiled registry.
#   --remote-root PATH  where data/registry live on the remote, default /var/tmp/$USER/zurich-hackathon
#   --remote-repo PATH  where you `git clone`d the repo on the cluster, default
#                        ~/ehl-zurich-hackathon-submission (only used for --with-checkpoint, to
#                        place best_model.pt at the right path inside your clone)
#
# After this runs, set on the cluster (see docs/CLUSTER_BRIEF.md §3):
#   export ESA_MISSION1_SUBSYSTEM5_REGISTRY=<remote-root>/timenet_registry
#   export ESA_MISSION1_SUBSYSTEM5_RATIONALES=<remote-repo>/artifacts/cot_rationales.json
#   export ESA_MISSION1_DIR=<remote-root>/data/ESA-Mission1   # only if --with-raw-data

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 user@cluster-host [--with-checkpoint] [--with-raw-data] [--remote-root PATH] [--remote-repo PATH]" >&2
  exit 1
fi

CLUSTER="$1"
shift

WITH_CHECKPOINT=false
WITH_RAW_DATA=false
REMOTE_ROOT="/var/tmp/\$USER/zurich-hackathon"
REMOTE_REPO="~/ehl-zurich-hackathon-submission"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-checkpoint) WITH_CHECKPOINT=true; shift ;;
    --with-raw-data) WITH_RAW_DATA=true; shift ;;
    --remote-root) REMOTE_ROOT="$2"; shift 2 ;;
    --remote-repo) REMOTE_REPO="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DATA_ROOT="/var/tmp/hrm/zurich-hackathon"

echo "==> [1/3] Compiled TimeF registry (~2MB)"
ssh "$CLUSTER" "mkdir -p '$REMOTE_ROOT'"
rsync -avz \
  "$LOCAL_DATA_ROOT/timenet_registry/" "$CLUSTER:$REMOTE_ROOT/timenet_registry/"

if $WITH_CHECKPOINT; then
  CKPT_REL="OpenTSLM/results/Llama_3_2_3B/OpenTSLMSP/stage6_esa_cot/checkpoints"
  if [[ -f "$REPO_ROOT/$CKPT_REL/best_model.pt" ]]; then
    echo "==> [2/3] Trained checkpoint (308MB, --with-checkpoint) -> $REMOTE_REPO/$CKPT_REL/"
    ssh "$CLUSTER" "mkdir -p '$REMOTE_REPO/$CKPT_REL'"
    rsync -avzP "$REPO_ROOT/$CKPT_REL/best_model.pt" "$CLUSTER:$REMOTE_REPO/$CKPT_REL/best_model.pt"
  else
    echo "==> [2/3] --with-checkpoint given but no checkpoint found at $CKPT_REL/best_model.pt yet (skipping)"
  fi
else
  echo "==> [2/3] Skipping checkpoint (pass --with-checkpoint to include it)"
fi

if $WITH_RAW_DATA; then
  echo "==> [3/3] Raw ESA-AD Mission1 extract (3.6GB, --with-raw-data)"
  rsync -avzP "$LOCAL_DATA_ROOT/data/ESA-Mission1/" "$CLUSTER:$REMOTE_ROOT/data/ESA-Mission1/"
else
  echo "==> [3/3] Skipping raw data (pass --with-raw-data to include it)"
fi

cat <<EOF

Done. On the cluster (after \`git clone --branch hackathon-submission ...\` into $REMOTE_REPO), set:
  export ESA_MISSION1_SUBSYSTEM5_REGISTRY=$REMOTE_ROOT/timenet_registry
  export ESA_MISSION1_SUBSYSTEM5_RATIONALES=$REMOTE_REPO/artifacts/cot_rationales.json
EOF
if $WITH_RAW_DATA; then
  echo "  export ESA_MISSION1_DIR=$REMOTE_ROOT/data/ESA-Mission1"
fi
