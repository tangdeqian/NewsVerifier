# FKA-Owl 虚假新闻检测系统 — 完整部署指南

> **FKA-Owl: Advancing Multimodal Fake News Detection through Knowledge-Augmented LVLMs**  
> ACM MM 2024 · [论文](https://arxiv.org/abs/2403.01988) · [原始仓库](https://github.com/liuxuannan/FAK-Owl)

---

## 📐 系统架构

```
┌─────────────────────────────────────────────────────┐
│                   前端 (React, port 3000)            │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  检测 Tab│  │  训练 Tab│  │   状态 Tab       │  │
│  └────┬─────┘  └────┬─────┘  └──────────────────┘  │
└───────┼─────────────┼───────────────────────────────┘
        │  HTTP       │
┌───────▼─────────────▼───────────────────────────────┐
│              后端 Flask API (port 5000)              │
│  /api/predict  /api/train  /api/status               │
│  /api/fetch_url (新闻URL自动抓取)                    │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│              FKA-Owl Model (GPU)                     │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │  ImageBind  │  │ Cross-Modal  │  │ Vicuna-7B  │ │
│  │  (~2GB)     │→ │  Reasoning   │→ │  LLM       │ │
│  └─────────────┘  └──────────────┘  └────────────┘ │
│                   ┌──────────────┐                   │
│                   │Visual Artifact│                  │
│                   │  Localization │                  │
│                   └──────────────┘                   │
└─────────────────────────────────────────────────────┘
```

---

## 💻 硬件要求

| 组件 | 最低 | 推荐 |
|------|------|------|
| GPU | NVIDIA 16GB VRAM | A100 40GB |
| RAM | 32 GB | 64 GB |
| 存储 | 80 GB | 200 GB |
| CUDA | 11.7 | 11.7 |

> ⚠️ 没有 GPU 可以用 CPU 推理，但速度极慢（不推荐）

---

## 🚀 快速开始

### 步骤 1：克隆本项目

```bash
git clone <本项目地址>
cd fka-owl
```

### 步骤 2：一键初始化环境

```bash
bash scripts/setup.sh
```

此脚本会自动：
- 克隆 FAK-Owl 原始仓库
- 创建 conda 环境 `FKA_Owl` (Python 3.9)
- 安装 PyTorch 1.13.1 + CUDA 11.7
- 安装所有依赖
- 下载 ImageBind 权重 (~2GB)
- 下载 Vicuna-7B-v1.5 (~13GB)
- 下载 PandaGPT delta weights (~3GB)

### 步骤 3：下载 DGM4 数据集（训练用）

访问：https://github.com/rshaojimmy/MultiModal-DeepFake  
下载后放置于：`FAK-Owl/data/DGM4/`

目录结构：
```
FAK-Owl/data/DGM4/
├── manipulation/
│   ├── infoswap/
│   ├── simswap/
│   ├── StyleCLIP/
│   └── HFGI/
├── origin/
│   ├── bbc/
│   ├── guardian/
│   ├── usa_today/
│   └── washington_post/
└── metadata_split/  (已包含在仓库中)
```

### 步骤 4：训练模型

方式 A - 命令行：
```bash
conda activate FKA_Owl
cd FAK-Owl/code
bash scripts/train_DGM4_bbc.sh
```

方式 B - 通过 Web UI：
1. 启动服务（见步骤 5）
2. 打开浏览器 http://localhost:3000
3. 切换到「训练」Tab
4. 选择数据集子集，点击「开始训练」

训练完成后，delta 权重保存到：`FAK-Owl/output/fka_owl_delta.pt`

### 步骤 5：启动完整服务

```bash
bash scripts/start.sh
```

或分别启动：

```bash
# 终端 1 - 后端
conda activate FKA_Owl
cd FAK-Owl/code
cp ../../backend/server.py .
cp ../../backend/url_crawler.py .
python server.py

# 终端 2 - 前端
cd frontend
npm install
npm start
```

访问：**http://localhost:3000**

---

## 🔌 API 文档

### `POST /api/predict`

检测新闻真实性。支持 multipart/form-data 或 JSON。

**multipart/form-data 字段：**
| 字段 | 类型 | 说明 |
|------|------|------|
| image | File | 新闻图片（可选） |
| title | string | 新闻标题（可选） |
| content | string | 新闻正文（可选） |
| url | string | 新闻链接（可选） |

**JSON 字段（备选）：**
```json
{
  "title": "新闻标题",
  "content": "新闻正文",
  "url": "https://...",
  "image_base64": "base64编码图片"
}
```

**响应示例：**
```json
{
  "verdict": "fake",
  "fake_prob": 85,
  "real_prob": 15,
  "confidence": 85,
  "raw_response": "Based on the analysis...",
  "inference_time": 2.34,
  "model_info": {
    "backbone": "ImageBind + Vicuna-7B",
    "framework": "FKA-Owl (ACM MM 2024)",
    "device": "cuda",
    "fka_weights_loaded": true
  }
}
```

### `GET /api/status`
返回模型加载状态、GPU 信息、训练状态。

### `POST /api/train`
```json
{ "subset": "bbc" }
```

### `GET /api/train/status`
返回训练进度和实时日志。

### `POST /api/fetch_url`
```json
{ "url": "https://example.com/news/article" }
```
自动抓取并返回新闻标题和正文。

---

## 📁 项目文件结构

```
fka-owl/
├── backend/
│   ├── server.py          # Flask API 服务器
│   └── url_crawler.py     # 新闻URL内容抓取
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # React 主界面
│   │   └── index.jsx      # 入口
│   ├── public/
│   │   └── index.html
│   └── package.json
├── scripts/
│   ├── setup.sh           # 一键安装脚本
│   ├── train.sh           # 训练封装脚本
│   └── start.sh           # 启动前后端
├── FAK-Owl/               # 原始仓库（setup.sh 自动克隆）
└── README.md
```

---

## ❓ 常见问题

**Q: CUDA out of memory？**  
A: 使用 7B 模型需要 ~14GB VRAM。尝试在 server.py 中将模型改为 `load_in_8bit=True`。

**Q: 没有 GPU 能运行吗？**  
A: 可以，在 server.py 中 device 会自动 fallback 到 CPU，但每次推理需要 5-10 分钟。

**Q: FKA-Owl delta 权重未找到？**  
A: 需要先训练。在没有 FKA-Owl 微调权重的情况下，系统会使用基础 PandaGPT 权重推理，效果会稍差。

**Q: 前端报 CORS 错误？**  
A: 确保后端运行在 localhost:5000，或修改 `REACT_APP_API_URL` 环境变量。

---

## 📚 引用

```bibtex
@inproceedings{liu2024fka,
    title={FKA-Owl: Advancing Multimodal Fake News Detection through Knowledge-Augmented LVLMs},
    author={Liu, Xuannan and Li, Peipei and Huang, Huaibo and Li, Zekun and Cui, Xing and Liang, Jiahao and Qin, Lixiong and Deng, Weihong and He, Zhaofeng},
    booktitle={ACM MM},
    year={2024}
}
```
