import os, sys, json, time, uuid, base64, logging, threading
from io import BytesIO
from pathlib import Path

import torch
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ── 路径配置 ──────────────────────────────────────
CODE_DIR      = Path("/workspace/NewsVerifier/FAK-Owl/code")
IMAGEBIND_CKPT = "/workspace/NewsVerifier/FAK-Owl/pretrained_ckpt/imagebind_ckpt/imagebind_huge.pth"
VICUNA_CKPT    = "/workspace/NewsVerifier/FAK-Owl/pretrained_ckpt/vicuna_ckpt/7b_v0"
PANDAGPT_CKPT  = "/workspace/NewsVerifier/FAK-Owl/pretrained_ckpt/pandagpt_ckpt/7b/pytorch_model.pt"
DELTA_CKPT     = "/workspace/NewsVerifier/FAK-Owl/code/ckpt/train_DGM4/pytorch_model.pt"
UPLOAD_FOLDER  = Path("/tmp/fka_owl_uploads")
UPLOAD_FOLDER.mkdir(exist_ok=True)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

MODEL = None
MODEL_LOADING = False
MODEL_ERROR = None

def load_model():
    global MODEL, MODEL_LOADING, MODEL_ERROR
    MODEL_LOADING = True
    try:
        os.chdir(str(CODE_DIR))
        if str(CODE_DIR) not in sys.path:
            sys.path.insert(0, str(CODE_DIR))

        from model.openllama import OpenLLAMAPEFTModel

        model = OpenLLAMAPEFTModel(**{
            "model": "openllama_peft",
            "imagebind_ckpt_path": IMAGEBIND_CKPT,
            "vicuna_ckpt_path": VICUNA_CKPT,
            "delta_ckpt_path": PANDAGPT_CKPT,
            "stage": 2,
            "max_tgt_len": 128,
            "lora_r": 32,
            "lora_alpha": 32,
            "lora_dropout": 0.1,
        })

        delta = torch.load(PANDAGPT_CKPT, map_location="cpu")
        model.load_state_dict(delta, strict=False)

        if os.path.exists(DELTA_CKPT):
            logger.info("Loading FKA-Owl fine-tuned weights...")
            fka = torch.load(DELTA_CKPT, map_location="cpu")
            model.load_state_dict(fka, strict=False)
            logger.info("✅ FKA-Owl weights loaded")
        else:
            logger.warning("⚠️  FKA-Owl delta not found, using base PandaGPT")

        MODEL = model.eval().cuda() if torch.cuda.is_available() else model.eval()
        logger.info("✅ Model ready on %s", "cuda" if torch.cuda.is_available() else "cpu")
    except Exception as e:
        MODEL_ERROR = str(e)
        logger.exception("Model load failed: %s", e)
    finally:
        MODEL_LOADING = False

threading.Thread(target=load_model, daemon=True).start()

FAKE_PROMPT = (
    "Based on the image and news text, is this news fake or real? "
    "Start with 'fake' or 'real', then explain."
)

def run_inference(image_path, title, content):
    if MODEL is None:
        raise RuntimeError("Model not loaded")

    text = ""
    if title:   text += f"Title: {title}\n"
    if content: text += f"Content: {content}\n"
    text += FAKE_PROMPT

    inputs = {"text_input": text}
    if image_path and os.path.exists(image_path):
        inputs["image_paths"] = [image_path]

    t0 = time.time()
    with torch.no_grad():
        response = MODEL.generate(inputs, max_gen_len=256, temperature=0.1, top_p=0.75)
    elapsed = round(time.time() - t0, 2)

    r = response.strip().lower()
    if r.startswith("fake"):
        verdict, fp, rp = "fake", 85, 15
    elif r.startswith("real"):
        verdict, fp, rp = "real", 10, 90
    else:
        fc, rc = r.count("fake"), r.count("real")
        if fc > rc:   verdict, fp, rp = "fake", 70, 30
        elif rc > fc: verdict, fp, rp = "real", 25, 75
        else:         verdict, fp, rp = "uncertain", 50, 50

    return {
        "verdict": verdict,
        "fake_prob": fp,
        "real_prob": rp,
        "confidence": max(fp, rp),
        "raw_response": response.strip(),
        "inference_time": elapsed,
        "model_info": {
            "backbone": "ImageBind + Vicuna-7B",
            "framework": "FKA-Owl (ACM MM 2024)",
            "device": "cuda" if torch.cuda.is_available() else "cpu",
            "fka_weights_loaded": os.path.exists(DELTA_CKPT),
        }
    }

@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/api/status")
def status():
    gpu = {}
    if torch.cuda.is_available():
        gpu = {
            "name": torch.cuda.get_device_name(0),
            "total_memory": round(torch.cuda.get_device_properties(0).total_memory/1e9, 1),
            "used_memory": round(torch.cuda.memory_allocated(0)/1e9, 2),
        }
    return jsonify({
        "model_loaded": MODEL is not None,
        "model_loading": MODEL_LOADING,
        "model_error": MODEL_ERROR,
        "fka_weights": os.path.exists(DELTA_CKPT),
        "gpu": gpu,
    })

@app.route("/api/predict", methods=["POST"])
def predict():
    if MODEL is None:
        code = 503 if MODEL_LOADING else 500
        return jsonify({"error": "Model loading..." if MODEL_LOADING else MODEL_ERROR}), code

    title = content = ""
    image_path = None

    if request.content_type and "multipart" in request.content_type:
        title   = request.form.get("title", "")
        content = request.form.get("content", "")
        if "image" in request.files:
            f = request.files["image"]
            image_path = str(UPLOAD_FOLDER / f"{uuid.uuid4()}{Path(f.filename).suffix or '.jpg'}")
            f.save(image_path)
    else:
        data    = request.get_json(force=True, silent=True) or {}
        title   = data.get("title", "")
        content = data.get("content", "")
        if data.get("image_base64"):
            img = Image.open(BytesIO(base64.b64decode(data["image_base64"]))).convert("RGB")
            image_path = str(UPLOAD_FOLDER / f"{uuid.uuid4()}.jpg")
            img.save(image_path, "JPEG")

    if not title and not content and not image_path:
        return jsonify({"error": "Please provide title, content, or image"}), 400

    try:
        return jsonify(run_inference(image_path, title, content))
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if image_path and os.path.exists(image_path):
            os.remove(image_path)

@app.route("/api/fetch_url", methods=["POST"])
def fetch_url():
    try:
        import requests
        from bs4 import BeautifulSoup
        url = (request.get_json(force=True, silent=True) or {}).get("url", "")
        if not url:
            return jsonify({"error": "url required"}), 400
        r = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        soup = BeautifulSoup(r.text, "html.parser")
        title = soup.find("h1")
        title = title.get_text(strip=True) if title else ""
        paras = [p.get_text(strip=True) for p in soup.find_all("p") if len(p.get_text(strip=True)) > 40]
        return jsonify({"title": title, "content": "\n".join(paras)[:4000]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5006))
    logger.info("Starting FKA-Owl API on port %d", port)
    app.run(host="0.0.0.0", port=port, debug=False, threaded=True)