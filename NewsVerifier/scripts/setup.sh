#!/usr/bin/env bash
# =============================================================================
# FKA-Owl Complete Setup Script
# Installs all dependencies, downloads model weights, and verifies the setup.
# Run: bash setup.sh
# =============================================================================
set -e

BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }
hdr()  { echo -e "\n${BOLD}━━━ $1 ━━━${NC}"; }

# ─── 0. Check prerequisites ───────────────────────────────────────────────────
hdr "Checking prerequisites"
command -v git     >/dev/null 2>&1 || err "git not found"
command -v conda   >/dev/null 2>&1 || err "conda not found (install Miniconda first)"
command -v python  >/dev/null 2>&1 || warn "python not found (will use conda python)"
log "Prerequisites OK"

# ─── 1. Clone repository ──────────────────────────────────────────────────────
hdr "Cloning FAK-Owl repository"
if [ ! -d "FAK-Owl" ]; then
    git clone https://github.com/liuxuannan/FAK-Owl.git
    log "Repository cloned"
else
    log "Repository already exists, pulling latest …"
    cd FAK-Owl && git pull && cd ..
fi

# ─── 2. Create conda environment ──────────────────────────────────────────────
hdr "Creating conda environment (FKA_Owl, Python 3.9)"
if ! conda env list | grep -q "FKA_Owl"; then
    conda create -n FKA_Owl python=3.9.0 -y
    log "Environment created"
else
    log "Environment FKA_Owl already exists"
fi

# ─── 3. Activate and install PyTorch ──────────────────────────────────────────
hdr "Installing PyTorch (CUDA 11.7)"
conda run -n FKA_Owl pip install \
    torch==1.13.1+cu117 \
    torchvision==0.14.1+cu117 \
    torchaudio==0.13.1 \
    --extra-index-url https://download.pytorch.org/whl/cu117
log "PyTorch installed"

# ─── 4. Install project dependencies ──────────────────────────────────────────
hdr "Installing project dependencies"
conda run -n FKA_Owl pip install -r FAK-Owl/requirements.txt --no-build-isolation
conda run -n FKA_Owl pip install \
    flask flask-cors \
    transformers==4.33.0 \
    accelerate \
    deepspeed \
    sentencepiece \
    peft \
    Pillow \
    requests \
    beautifulsoup4 \
    trafilatura
log "Dependencies installed"

# ─── 5. Download ImageBind checkpoint ─────────────────────────────────────────
hdr "Downloading ImageBind checkpoint (~2GB)"
IMAGEBIND_DIR="FAK-Owl/pretrained_ckpt/imagebind_ckpt"
mkdir -p "$IMAGEBIND_DIR"
if [ ! -f "$IMAGEBIND_DIR/imagebind_huge.pth" ]; then
    wget -q --show-progress \
        "https://dl.fbaipublicfiles.com/imagebind/imagebind_huge.pth" \
        -O "$IMAGEBIND_DIR/imagebind_huge.pth"
    log "ImageBind downloaded"
else
    log "ImageBind checkpoint already exists"
fi

# ─── 6. Download Vicuna-7B (via Hugging Face) ─────────────────────────────────
hdr "Downloading Vicuna-7B model (~13GB)"
VICUNA_DIR="FAK-Owl/pretrained_ckpt/vicuna_ckpt/7b_v0"
mkdir -p "$VICUNA_DIR"
if [ ! -f "$VICUNA_DIR/config.json" ]; then
    warn "Vicuna-7B requires ~13GB. Downloading via HuggingFace Hub …"
    conda run -n FKA_Owl python - <<'EOF'
from huggingface_hub import snapshot_download
snapshot_download(
    repo_id="lmsys/vicuna-7b-v1.5",
    local_dir="FAK-Owl/pretrained_ckpt/vicuna_ckpt/7b_v0",
    ignore_patterns=["*.msgpack", "*.h5"],
)
print("Vicuna downloaded!")
EOF
    log "Vicuna-7B downloaded"
else
    log "Vicuna checkpoint already exists"
fi

# ─── 7. Download PandaGPT delta weights ───────────────────────────────────────
hdr "Downloading PandaGPT delta weights (~3GB)"
PANDAGPT_DIR="FAK-Owl/pretrained_ckpt/pandagpt_ckpt/7b"
mkdir -p "$PANDAGPT_DIR"
if [ ! -f "$PANDAGPT_DIR/pytorch_model.pt" ]; then
    conda run -n FKA_Owl python - <<'EOF'
from huggingface_hub import hf_hub_download
hf_hub_download(
    repo_id="openllmplayground/pandagpt_7b_max_len_1024",
    filename="pytorch_model.pt",
    local_dir="FAK-Owl/pretrained_ckpt/pandagpt_ckpt/7b/",
)
print("PandaGPT weights downloaded!")
EOF
    log "PandaGPT weights downloaded"
else
    log "PandaGPT weights already exist"
fi

# ─── 8. Install pytorchvideo (for audio, sometimes needed) ────────────────────
hdr "Installing pytorchvideo"
if ! conda run -n FKA_Owl python -c "import pytorchvideo" 2>/dev/null; then
    conda run -n FKA_Owl pip install pytorchvideo || \
    (git clone https://github.com/facebookresearch/pytorchvideo /tmp/ptv && \
     conda run -n FKA_Owl pip install --editable /tmp/ptv/)
fi
log "pytorchvideo OK"

# ─── 9. Copy our backend server ───────────────────────────────────────────────
hdr "Setting up backend server"
cp backend/server.py FAK-Owl/code/server.py
log "Backend server copied"

# ─── 10. Summary ──────────────────────────────────────────────────────────────
hdr "Setup Complete"
echo ""
echo "  Next steps:"
echo ""
echo "  1. Download DGM4 dataset (for training):"
echo "     https://github.com/rshaojimmy/MultiModal-DeepFake"
echo "     Place it at: FAK-Owl/data/DGM4/"
echo ""
echo "  2. Train the model:"
echo "     conda activate FKA_Owl"
echo "     cd FAK-Owl/code && bash scripts/train_DGM4_bbc.sh"
echo "     (or use the web UI's Training tab)"
echo ""
echo "  3. Start the backend:"
echo "     conda activate FKA_Owl"
echo "     cd FAK-Owl/code && python server.py"
echo ""
echo "  4. Start the frontend:"
echo "     cd frontend && npm install && npm start"
echo ""
echo "  5. Open: http://localhost:3000"
echo ""
