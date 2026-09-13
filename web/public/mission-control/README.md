# Mission Control replay

This is a static replay bundle for `/mission-control`. Hosting needs no GPU,
model weights or API credentials. The route uses the existing Next deployment
and has no worker or API calls.

`replay.json` contains five curated TimeNet windows, their actual irregular time
offsets, float32 source values, normalized values, exact saved prompt text, exact
saved responses, ESA reference labels, and all 246 test predictions as scored rows.
Scale, cursor and zoom only change the view. Replay timing is presentation timing,
not model execution timing. Reference reveal is a presentation control; labels
are included in the public bundle.

The prediction snapshot is the 2026-09-13 05:13 UTC OpenTSLM SoftPrompt Llama 3.2
3B run. SHA-256 of the original `test_predictions.jsonl`:
`38f92839518fd7ec9aba7ad195a5fdb2ec7b011631d7e308f0433273132b4ffd`.
This does not establish that the run is a particular v13/v14 checkpoint. Encoder
diagrams show verified architecture and actual input patches, not saved internal
activations. Exact padded batch tensors were not recorded; displayed patch counts
are the minimum for a single window.

The export joins saved answers to the current TimeNet registry by deterministic
loader order. All 246 gold texts and channels align. The selected raw mean/std and
telecommand text reproduce the saved context exactly. Original numeric inference
tensors were not recorded, so historical numeric identity cannot independently be
proven. Exported signal checksums pin the values now included in this bundle.

Curated zero-based prediction rows: 4 (Anomaly detected), 38 (Anomaly missed),
0 (Rare Event flagged), 14 (Rare Event quiet), 1 (Nominal quiet). These illustrate
behavior and are not a random performance sample. Metrics use the full cohort.

The trained task maps Anomaly and Rare Event to positive. Its 246 test rows give
TP 89 / FP 0 / FN 34 / TN 123. Anomaly-only rescoring gives TP 25 / FP 64 / FN 12 /
TN 145; that is a different target, not a retrained model. The split is
historical and predates the event-grouping correction. These saved 246 rows are
not the new 224-window evaluation; they must not be relabeled as fixed-split results.
The pitch checklist now reports a retrained OpenTSLM result of 75.89% accuracy and
F1 0.727 on the corrected split; that separate run is not this replay. Results do not establish
generalization to unseen events or deployment precision.

To reproduce the export, run `scripts/export_mission_control_replay.py` from the
repository root in the OpenTSLM Python environment, supplying `--project`,
`--registry`, `--predictions`, `--labels` and `--output`. The script checks the
pinned prediction checksum before writing output. It never loads model weights
or runs training. Only the exported bundle is needed by the website.

Data provenance: ESA Anomaly Dataset (ESA-AD), Mission1; Airbus Defence and Space /
KP Labs / ESA ESOC → TimeNet `esa/mission1-subsystem5` version 1.0.0. Source times
are timezone-naive and displayed as UTC-equivalent wall-clock times.
