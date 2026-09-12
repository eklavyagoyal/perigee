#!/usr/bin/env bash
# Sync the validated local pipeline state to the 8xH100 cluster.
#
# Ships in tiers because the pieces have very different sizes: repo code + generated CoT
# labels + the compiled TimeF registry (~15MB total) should always go; the trained checkpoint
# (308MB) and the raw ESA-AD Mission1 extract (3.6GB) are opt-in flags since they're only
# needed for specific reasons (see usage below).
#
# Usage:
#   scripts/sync_to_cluster.sh user@cluster-host [--with-checkpoint] [--with-raw-data] [--remote-root PATH]
#
#   --with-checkpoint   also copy OpenTSLM/results/.../best_model.pt (308MB) — useful as a
#                        fallback/reference checkpoint if a bigger cluster run doesn't finish.
#   --with-raw-data     also copy the raw ESA-AD Mission1 extract (3.6GB) — only needed if you
#                        plan to rebuild/widen the TimeNet connector's build on the cluster.
#                        Not needed to just train against the already-compiled registry.
#   --remote-root PATH  where data/registry live on the remote, default /var/tmp/$USER/zurich-hackathon
#                        (the repo itself goes to ~/zurich-hackathon regardless).
#
# After this runs, set on the cluster (see CLUSTER_BRIEF.md §3):
#   export ESA_MISSION1_SUBSYSTEM5_REGISTRY=<remote-root>/timenet_registry
#   export ESA_MISSION1_SUBSYSTEM5_RATIONALES=~/zurich-hackathon/cot_rationales.json
#   export ESA_MISSION1_DIR=<remote-root>/data/ESA-Mission1   # only if --with-raw-data

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 user@cluster-host [--with-checkpoint] [--with-raw-data] [--remote-root PATH]" >&2
  exit 1
fi

CLUSTER="$1"
shift

WITH_CHECKPOINT=false
WITH_RAW_DATA=false
REMOTE_ROOT="/var/tmp/\$USER/zurich-hackathon"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-checkpoint) WITH_CHECKPOINT=true; shift ;;
    --with-raw-data) WITH_RAW_DATA=true; shift ;;
    --remote-root) REMOTE_ROOT="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_DATA_ROOT="/var/tmp/hrm/zurich-hackathon"
REMOTE_REPO_DEST="~/zurich-hackathon"

echo "==> [1/4] Repo code + generated CoT labels (~15MB, excluding the checkpoint)"
rsync -avz --delete \
  --exclude '.git' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  --exclude '.venv' \
  --exclude 'results/**/*.pt' \
  "$REPO_ROOT/" "$CLUSTER:$REMOTE_REPO_DEST/"

echo "==> [2/4] Compiled TimeF registry (~2MB)"
ssh "$CLUSTER" "mkdir -p '$REMOTE_ROOT'"
rsync -avz \
  "$LOCAL_DATA_ROOT/timenet_registry/" "$CLUSTER:$REMOTE_ROOT/timenet_registry/"

if $WITH_CHECKPOINT; then
  CKPT_REL="OpenTSLM/results/Llama_3_2_3B/OpenTSLMSP/stage6_esa_cot/checkpoints"
  if [[ -f "$REPO_ROOT/$CKPT_REL/best_model.pt" ]]; then
    echo "==> [3/4] Trained checkpoint (308MB, --with-checkpoint)"
    ssh "$CLUSTER" "mkdir -p '$REMOTE_REPO_DEST/$CKPT_REL'"
    rsync -avzP "$REPO_ROOT/$CKPT_REL/best_model.pt" "$CLUSTER:$REMOTE_REPO_DEST/$CKPT_REL/best_model.pt"
  else
    echo "==> [3/4] --with-checkpoint given but no checkpoint found at $CKPT_REL/best_model.pt yet (skipping)"
  fi
else
  echo "==> [3/4] Skipping checkpoint (pass --with-checkpoint to include it)"
fi

if $WITH_RAW_DATA; then
  echo "==> [4/4] Raw ESA-AD Mission1 extract (3.6GB, --with-raw-data)"
  rsync -avzP "$LOCAL_DATA_ROOT/data/ESA-Mission1/" "$CLUSTER:$REMOTE_ROOT/data/ESA-Mission1/"
else
  echo "==> [4/4] Skipping raw data (pass --with-raw-data to include it)"
fi

cat <<EOF

Done. On the cluster, set:
  export ESA_MISSION1_SUBSYSTEM5_REGISTRY=$REMOTE_ROOT/timenet_registry
  export ESA_MISSION1_SUBSYSTEM5_RATIONALES=$REMOTE_REPO_DEST/cot_rationales.json
EOF
if $WITH_RAW_DATA; then
  echo "  export ESA_MISSION1_DIR=$REMOTE_ROOT/data/ESA-Mission1"
fi
