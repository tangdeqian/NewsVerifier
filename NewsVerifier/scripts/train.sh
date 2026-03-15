#!/usr/bin/env bash
# =============================================================================
# train.sh — One-click training wrapper that calls FKA-Owl's train scripts
# Usage: bash train.sh [subset]   (subset: bbc | guardian | usa_today | washington_post)
# =============================================================================
set -e

SUBSET=${1:-"bbc"}
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CODE_DIR="$ROOT_DIR/FAK-Owl/code"

echo "[train.sh] Training FKA-Owl on subset: $SUBSET"
echo "[train.sh] Code dir: $CODE_DIR"

cd "$CODE_DIR"

# Ensure the training script exists
TRAIN_SCRIPT="$CODE_DIR/scripts/train_DGM4_${SUBSET}.sh"
if [ ! -f "$TRAIN_SCRIPT" ]; then
    echo "Training script not found: $TRAIN_SCRIPT"
    echo "Generating training script for subset: $SUBSET ..."

    cat > "$TRAIN_SCRIPT" <<TRAINEOF
#!/usr/bin/env bash
cd ..
CUDA_VISIBLE_DEVICES=0 \
deepspeed --master_port 28459 train.py \
    --model openllama_peft \
    --stage 1 \
    --config_path ./config/train_${SUBSET}.yaml \
    --imagebind_ckpt_path ../pretrained_ckpt/imagebind_ckpt/imagebind_huge.pth \
    --vicuna_ckpt_path    ../pretrained_ckpt/vicuna_ckpt/7b_v0 \
    --delta_ckpt_path     ../pretrained_ckpt/pandagpt_ckpt/7b/pytorch_model.pt \
    --max_tgt_len 128 \
    --save_path   ../output/fka_owl_${SUBSET} \
    --log_path    ../output/logs_${SUBSET} \
    --ds_config   ./dsconfig/openllama_peft_stage_1.json
TRAINEOF
    chmod +x "$TRAIN_SCRIPT"
fi

bash "$TRAIN_SCRIPT"

# After training, copy final delta weights to the expected location
SAVE_PATH="$ROOT_DIR/FAK-Owl/output/fka_owl_${SUBSET}"
FINAL_CKPT=$(find "$SAVE_PATH" -name "*.pt" | sort | tail -1)

if [ -n "$FINAL_CKPT" ]; then
    cp "$FINAL_CKPT" "$ROOT_DIR/FAK-Owl/output/fka_owl_delta.pt"
    echo "[train.sh] Saved final delta weights to: $ROOT_DIR/FAK-Owl/output/fka_owl_delta.pt"
fi

echo "[train.sh] Training complete!"
