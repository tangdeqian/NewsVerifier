import { useState, useEffect, useRef, useCallback } from "react";

const API = process.env.REACT_APP_API_URL || "https://8c0616ce82374760be6bf50d9e07b016--5006.ap-shanghai2.cloudstudio.club";

// ─── CSS injected as string ────────────────────────────────────────────────
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;700&family=Syne:wght@400;600;700;800&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:       #07080c;
  --bg1:      #0d1018;
  --bg2:      #131620;
  --border:   rgba(255,255,255,0.06);
  --text:     #dde4f0;
  --muted:    #55607a;
  --accent:   #4CFFA0;
  --accent2:  #4C9FFF;
  --danger:   #FF4C6A;
  --warn:     #FFB84C;
  --radius:   10px;
  --mono:     'IBM Plex Mono', monospace;
  --sans:     'Space Grotesk', sans-serif;
  --display:  'Syne', sans-serif;
}

html, body, #root { height: 100%; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--sans);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--bg1); }
::-webkit-scrollbar-thumb { background: #222a38; border-radius: 3px; }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
@keyframes pulseRing {
  0%   { transform: scale(1);   opacity: 0.6; }
  100% { transform: scale(2.5); opacity: 0; }
}
@keyframes barFill {
  from { width: 0; }
  to   { width: var(--w); }
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
@keyframes glowPulse {
  0%, 100% { opacity: 0.5; }
  50%       { opacity: 1; }
}
@keyframes slideIn {
  from { opacity: 0; transform: translateX(-10px); }
  to   { opacity: 1; transform: translateX(0); }
}
`;

// ─── Tiny primitives ────────────────────────────────────────────────────────
const Label = ({ children }) => (
  <span style={{
    fontFamily: "var(--mono)",
    fontSize: 11,
    letterSpacing: "0.12em",
    color: "var(--muted)",
    textTransform: "uppercase",
  }}>
    {children}
  </span>
);

const Tag = ({ children, color = "var(--accent)" }) => (
  <span style={{
    fontFamily: "var(--mono)",
    fontSize: 10,
    letterSpacing: "0.1em",
    color,
    border: `1px solid ${color}33`,
    borderRadius: 4,
    padding: "2px 7px",
    background: `${color}0a`,
  }}>
    {children}
  </span>
);

const Divider = ({ color = "var(--border)" }) => (
  <div style={{ height: 1, background: color, margin: "0" }} />
);

const Input = ({ label, value, onChange, placeholder, type = "text", rows }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <Label>{label}</Label>
    {rows ? (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          background: "var(--bg1)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          color: "var(--text)",
          fontFamily: "var(--sans)",
          fontSize: 14,
          padding: "10px 14px",
          resize: "vertical",
          outline: "none",
          transition: "border-color .2s",
          width: "100%",
        }}
        onFocus={e => e.target.style.borderColor = "rgba(76,255,160,0.35)"}
        onBlur={e  => e.target.style.borderColor = "var(--border)"}
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: "var(--bg1)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          color: "var(--text)",
          fontFamily: "var(--sans)",
          fontSize: 14,
          padding: "10px 14px",
          outline: "none",
          transition: "border-color .2s",
          width: "100%",
        }}
        onFocus={e => e.target.style.borderColor = "rgba(76,255,160,0.35)"}
        onBlur={e  => e.target.style.borderColor = "var(--border)"}
      />
    )}
  </div>
);

// ─── Score bar ────────────────────────────────────────────────────────────
const ScoreBar = ({ label, value, color, delay = 0 }) => (
  <div style={{ opacity: 0, animation: `fadeUp .4s ease ${delay}ms forwards` }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
      <Label>{label}</Label>
      <span style={{ fontFamily: "var(--mono)", fontSize: 13, color, fontWeight: 700 }}>
        {value}%
      </span>
    </div>
    <div style={{ background: "var(--bg1)", borderRadius: 4, height: 5, overflow: "hidden" }}>
      <div style={{
        "--w": `${value}%`,
        height: "100%",
        background: `linear-gradient(90deg, ${color}55, ${color})`,
        borderRadius: 4,
        animation: `barFill 1s cubic-bezier(.4,0,.2,1) ${delay + 200}ms forwards`,
        width: 0,
        boxShadow: `0 0 8px ${color}55`,
      }} />
    </div>
  </div>
);

// ─── Verdict config ────────────────────────────────────────────────────────
const VERDICTS = {
  fake:      { label: "FAKE NEWS",    color: "var(--danger)", icon: "⚠" },
  real:      { label: "CREDIBLE",     color: "var(--accent)", icon: "✓" },
  uncertain: { label: "UNCERTAIN",    color: "var(--warn)",   icon: "◈" },
};

// ─── Tabs ──────────────────────────────────────────────────────────────────
const TABS = ["检测", "训练", "状态"];

// ═══════════════════════════════════════════════════════════════════════════
// Main App
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab]           = useState(0);
  const [serverStatus, setStatus] = useState(null);

  // Poll server status
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch(`${API}/api/status`);
        setStatus(await r.json());
      } catch {
        setStatus(null);
      }
    };
    poll();
    const t = setInterval(poll, 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

        {/* ── Header ── */}
        <header style={{
          borderBottom: "1px solid var(--border)",
          background: "rgba(7,8,12,.9)",
          backdropFilter: "blur(20px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: "0 32px",
          display: "flex",
          alignItems: "center",
          height: 60,
          gap: 20,
        }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36, height: 36,
              background: "linear-gradient(135deg, #4CFFA033, #4CFFA011)",
              border: "1px solid #4CFFA044",
              borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
              position: "relative",
            }}>
              🦉
              <div style={{
                position: "absolute", inset: -3,
                border: "1px solid #4CFFA022",
                borderRadius: 11,
                animation: "glowPulse 2s ease-in-out infinite",
              }} />
            </div>
            <div>
              <div style={{
                fontFamily: "var(--display)",
                fontWeight: 800,
                fontSize: 16,
                letterSpacing: "0.08em",
                color: "#fff",
              }}>
                FKA-OWL
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--muted)", letterSpacing: "0.15em" }}>
                ACM MM 2024 · FAKE NEWS DETECTOR
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ display: "flex", gap: 4, marginLeft: 24 }}>
            {TABS.map((t, i) => (
              <button
                key={t}
                onClick={() => setTab(i)}
                style={{
                  fontFamily: "var(--sans)",
                  fontSize: 13,
                  fontWeight: tab === i ? 600 : 400,
                  color: tab === i ? "#fff" : "var(--muted)",
                  background: tab === i ? "rgba(255,255,255,0.06)" : "transparent",
                  border: "none",
                  borderRadius: 6,
                  padding: "5px 14px",
                  cursor: "pointer",
                  transition: "all .15s",
                }}
              >
                {t}
              </button>
            ))}
          </nav>

          {/* Status pill */}
          <div style={{ marginLeft: "auto" }}>
            {serverStatus === null ? (
              <Tag color="var(--danger)">● 服务器离线</Tag>
            ) : serverStatus.model_loading ? (
              <Tag color="var(--warn)">● 模型加载中…</Tag>
            ) : serverStatus.model_loaded ? (
              <Tag color="var(--accent)">● 模型就绪</Tag>
            ) : (
              <Tag color="var(--danger)">● 模型未加载</Tag>
            )}
          </div>
        </header>

        {/* ── Content ── */}
        <main style={{ flex: 1, padding: "32px", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
          {tab === 0 && <DetectTab />}
          {tab === 1 && <TrainTab />}
          {tab === 2 && <StatusTab status={serverStatus} />}
        </main>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Detect Tab
// ═══════════════════════════════════════════════════════════════════════════
function DetectTab() {
  const [image,        setImage]        = useState(null);
  const [imageFile,    setImageFile]    = useState(null);
  const [title,        setTitle]        = useState("");
  const [content,      setContent]      = useState("");
  const [url,          setUrl]          = useState("");
  const [loading,      setLoading]      = useState(false);
  const [loadStep,     setLoadStep]     = useState(0);
  const [result,       setResult]       = useState(null);
  const [error,        setError]        = useState(null);
  const [dragOver,     setDragOver]     = useState(false);
  const [urlFetching,  setUrlFetching]  = useState(false);
  const fileRef = useRef();

  const STEPS = [
    "发送数据到 FKA-Owl 服务器 …",
    "ImageBind 提取视觉特征 …",
    "跨模态推理模块 (Cross-Modal) …",
    "视觉伪造定位模块 (VAL) …",
    "LLM 深度推理 (Vicuna-7B) …",
    "生成检测报告 …",
  ];

  const handleFile = useCallback(file => {
    if (!file || !file.type.startsWith("image/")) return;
    setImage(URL.createObjectURL(file));
    setImageFile(file);
  }, []);

  const fetchUrl = async () => {
    if (!url) return;
    setUrlFetching(true);
    try {
      // Ask our backend to proxy-crawl the URL
      const r = await fetch(`${API}/api/fetch_url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (r.ok) {
        const d = await r.json();
        if (d.title)   setTitle(d.title);
        if (d.content) setContent(d.content);
      }
    } catch {
      // Silently fail — user can still fill in manually
    } finally {
      setUrlFetching(false);
    }
  };

  const detect = async () => {
    if (!imageFile && !title && !content) {
      setError("请至少提供图片、标题或正文之一");
      return;
    }
    setError(null);
    setResult(null);
    setLoading(true);
    setLoadStep(0);

    const interval = setInterval(() => {
      setLoadStep(s => s < STEPS.length - 1 ? s + 1 : s);
    }, 700);

    try {
      const form = new FormData();
      if (imageFile) form.append("image", imageFile);
      form.append("title",   title);
      form.append("content", content);
      form.append("url",     url);

      const r = await fetch(`${API}/api/predict`, { method: "POST", body: form });
      const data = await r.json();

      clearInterval(interval);
      setLoadStep(STEPS.length - 1);

      if (!r.ok) throw new Error(data.error || "Unknown error");
      setTimeout(() => { setLoading(false); setResult(data); }, 400);
    } catch (e) {
      clearInterval(interval);
      setLoading(false);
      setError(e.message);
    }
  };

  const reset = () => {
    setResult(null); setImage(null); setImageFile(null);
    setTitle(""); setContent(""); setUrl(""); setError(null);
  };

  const vd = result ? (VERDICTS[result.verdict] || VERDICTS.uncertain) : null;

  return (
    <div style={{ animation: "fadeUp .5s ease" }}>
      <PageHeader
        title="虚假新闻检测"
        sub="基于 FKA-Owl 大视觉语言模型 · 跨模态知识增强"
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* LEFT */}
        <Card>
          <SectionTitle>输入内容</SectionTitle>

          {/* Image upload */}
          <div style={{ marginBottom: 18 }}>
            <Label>新闻图片（可选）</Label>
            <div
              onClick={() => fileRef.current.click()}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              style={{
                marginTop: 8,
                border: `1.5px dashed ${dragOver ? "var(--accent)" : image ? "rgba(76,255,160,.3)" : "var(--border)"}`,
                borderRadius: "var(--radius)",
                minHeight: image ? "auto" : 120,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexDirection: "column", gap: 8,
                cursor: "pointer",
                background: dragOver ? "rgba(76,255,160,.03)" : "transparent",
                transition: "all .2s",
                padding: image ? 10 : 20,
              }}
            >
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={e => handleFile(e.target.files[0])} />
              {image ? (
                <div style={{ textAlign: "center", width: "100%" }}>
                  <img src={image} alt="preview" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, border: "1px solid var(--border)" }} />
                  <div style={{ marginTop: 6, fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)" }}>
                    ✓ 图像已加载 · 点击更换
                  </div>
                </div>
              ) : (
                <>
                  <span style={{ fontSize: 28, opacity: .4 }}>🖼️</span>
                  <Label>拖拽图片或点击上传</Label>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)" }}>PNG · JPG · WEBP</span>
                </>
              )}
            </div>
          </div>

          <Input label="新闻标题" value={title} onChange={setTitle} placeholder="输入新闻标题 …" />
          <div style={{ height: 14 }} />

          {/* URL field */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Label>新闻链接（可选，自动抓取内容）</Label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com/news/ …"
                style={{
                  flex: 1,
                  background: "var(--bg1)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  color: "var(--text)",
                  fontFamily: "var(--sans)",
                  fontSize: 14,
                  padding: "10px 14px",
                  outline: "none",
                }}
                onFocus={e => e.target.style.borderColor = "rgba(76,159,255,.4)"}
                onBlur={e  => e.target.style.borderColor = "var(--border)"}
              />
              <button
                onClick={fetchUrl}
                disabled={urlFetching || !url}
                style={{
                  background: "rgba(76,159,255,.1)",
                  border: "1px solid rgba(76,159,255,.25)",
                  borderRadius: "var(--radius)",
                  color: "var(--accent2)",
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  padding: "0 14px",
                  cursor: url ? "pointer" : "not-allowed",
                  opacity: url ? 1 : .4,
                  letterSpacing: "0.08em",
                  whiteSpace: "nowrap",
                }}
              >
                {urlFetching ? "抓取中…" : "自动填充"}
              </button>
            </div>
          </div>
        </Card>

        {/* RIGHT */}
        <Card>
          <SectionTitle>新闻正文</SectionTitle>
          <Input
            label="粘贴正文内容"
            value={content}
            onChange={setContent}
            placeholder="粘贴完整新闻正文 …"
            rows={14}
          />

          {/* Module badges */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
            {[
              { icon: "👁", label: "Visual Encoder", desc: "ImageBind" },
              { icon: "🔗", label: "Cross-Modal", desc: "语义推理模块" },
              { icon: "🔍", label: "Artifact Loc.", desc: "伪造定位模块" },
              { icon: "🧠", label: "Vicuna-7B LLM", desc: "深度推理" },
            ].map(m => (
              <div key={m.label} style={{
                background: "var(--bg1)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "8px 12px",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: 18 }}>{m.icon}</span>
                <div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--accent)", letterSpacing: "0.08em" }}>{m.label}</div>
                  <div style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--muted)" }}>{m.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: "rgba(255,76,106,.06)",
          border: "1px solid rgba(255,76,106,.25)",
          borderRadius: "var(--radius)",
          padding: "12px 18px",
          fontFamily: "var(--mono)",
          fontSize: 12,
          color: "var(--danger)",
          marginBottom: 16,
          animation: "fadeUp .3s ease",
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Analyze button */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
        <button
          onClick={result ? reset : detect}
          disabled={loading}
          style={{
            fontFamily: "var(--display)",
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: "0.1em",
            color: result ? "var(--muted)" : (loading ? "var(--bg)" : "var(--bg)"),
            background: result
              ? "transparent"
              : loading
                ? "rgba(76,255,160,.2)"
                : "var(--accent)",
            border: result ? "1px solid var(--border)" : "none",
            borderRadius: "var(--radius)",
            padding: "14px 52px",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all .25s",
            boxShadow: result || loading ? "none" : "0 0 24px rgba(76,255,160,.25)",
            display: "flex", alignItems: "center", gap: 10,
          }}
        >
          {loading ? (
            <>
              <span style={{
                width: 16, height: 16,
                border: "2px solid rgba(76,255,160,.2)",
                borderTopColor: "var(--accent)",
                borderRadius: "50%",
                display: "inline-block",
                animation: "spin .7s linear infinite",
              }} />
              分析中…
            </>
          ) : result ? (
            "↺ 重新检测"
          ) : (
            "◈ 启动 FKA-Owl 检测"
          )}
        </button>
      </div>

      {/* Loading steps */}
      {loading && (
        <Card style={{ marginBottom: 20, animation: "fadeUp .4s ease" }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)", letterSpacing: "0.12em", marginBottom: 12 }}>
            ▶ FKA-OWL PIPELINE RUNNING
          </div>
          {STEPS.slice(0, loadStep + 1).map((s, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              fontFamily: "var(--mono)", fontSize: 12,
              color: i < loadStep ? "var(--muted)" : "var(--text)",
              marginBottom: 6,
              animation: `slideIn .3s ease ${i * 50}ms both`,
            }}>
              <span style={{ color: i < loadStep ? "var(--muted)" : "var(--accent)", fontSize: 10 }}>
                {i < loadStep ? "✓" : "▶"}
              </span>
              {s}
              {i === loadStep && (
                <span style={{ animation: "blink 1s infinite", color: "var(--accent)" }}>_</span>
              )}
            </div>
          ))}
        </Card>
      )}

      {/* Results */}
      {result && vd && <ResultPanel result={result} vd={vd} />}
    </div>
  );
}

function ResultPanel({ result, vd }) {
  return (
    <div style={{ animation: "fadeUp .6s ease" }}>
      {/* Verdict banner */}
      <div style={{
        background: `${vd.color}08`,
        border: `1.5px solid ${vd.color}44`,
        borderRadius: 12,
        padding: "22px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 18,
        boxShadow: `0 0 40px ${vd.color}15`,
      }}>
        <div>
          <div style={{
            fontFamily: "var(--display)",
            fontWeight: 800,
            fontSize: 28,
            color: vd.color,
            letterSpacing: "0.06em",
          }}>
            {vd.icon} {vd.label}
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
            Confidence: {result.confidence}% · Inference: {result.inference_time}s ·{" "}
            {result.model_info?.fka_weights_loaded ? "FKA-Owl Fine-tuned" : "Base PandaGPT"}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            fontFamily: "var(--mono)",
            fontSize: 44,
            fontWeight: 700,
            color: vd.color,
            lineHeight: 1,
          }}>
            {result.fake_prob}%
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em", marginTop: 2 }}>
            FAKE PROBABILITY
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Scores */}
        <Card>
          <SectionTitle>评分分析</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <ScoreBar label="虚假概率" value={result.fake_prob} color="var(--danger)" delay={0} />
            <ScoreBar label="真实概率" value={result.real_prob} color="var(--accent)" delay={100} />
            <ScoreBar label="置信度"   value={result.confidence} color="var(--accent2)" delay={200} />
          </div>
        </Card>

        {/* Model info */}
        <Card>
          <SectionTitle>模型信息</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { k: "Backbone",    v: result.model_info?.backbone || "ImageBind + Vicuna-7B" },
              { k: "Framework",   v: "FKA-Owl (ACM MM 2024)" },
              { k: "Device",      v: result.model_info?.device || "—" },
              { k: "Fine-tuned",  v: result.model_info?.fka_weights_loaded ? "Yes (FKA-Owl Delta)" : "No (Base PandaGPT)" },
              { k: "Inference",   v: `${result.inference_time}s` },
            ].map(({ k, v }) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Label>{k}</Label>
                <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--text)" }}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Raw model response */}
      <Card>
        <SectionTitle>模型原始推理输出</SectionTitle>
        <div style={{
          background: "var(--bg1)",
          borderRadius: 8,
          padding: "14px 18px",
          fontFamily: "var(--mono)",
          fontSize: 13,
          color: "var(--text)",
          lineHeight: 1.7,
          whiteSpace: "pre-wrap",
          maxHeight: 240,
          overflowY: "auto",
          border: "1px solid var(--border)",
        }}>
          {result.raw_response}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Train Tab
// ═══════════════════════════════════════════════════════════════════════════
function TrainTab() {
  const [subset,   setSubset]   = useState("bbc");
  const [status,   setStatus]   = useState(null);
  const [starting, setStarting] = useState(false);
  const logRef = useRef();

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch(`${API}/api/train/status`);
        const d = await r.json();
        setStatus(d);
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
      } catch {}
    };
    poll();
    const t = setInterval(poll, 2000);
    return () => clearInterval(t);
  }, []);

  const startTraining = async () => {
    setStarting(true);
    try {
      await fetch(`${API}/api/train`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subset }),
      });
    } finally {
      setStarting(false);
    }
  };

  const SUBSETS = ["bbc", "guardian", "usa_today", "washington_post"];

  return (
    <div style={{ animation: "fadeUp .5s ease" }}>
      <PageHeader
        title="模型训练"
        sub="在 DGM4 数据集子集上微调 FKA-Owl"
      />

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 20 }}>
        {/* Config */}
        <Card>
          <SectionTitle>训练配置</SectionTitle>

          <div style={{ marginBottom: 18 }}>
            <Label>DGM4 数据集子集</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {SUBSETS.map(s => (
                <label key={s} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 14px",
                  background: subset === s ? "rgba(76,255,160,.06)" : "var(--bg1)",
                  border: `1px solid ${subset === s ? "rgba(76,255,160,.3)" : "var(--border)"}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  transition: "all .15s",
                }}>
                  <input
                    type="radio"
                    checked={subset === s}
                    onChange={() => setSubset(s)}
                    style={{ accentColor: "var(--accent)" }}
                  />
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: subset === s ? "var(--accent)" : "var(--text)" }}>
                    {s}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <Divider />
          <div style={{ height: 14 }} />

          <InfoRow label="Backbone"    value="ImageBind + Vicuna-7B" />
          <InfoRow label="初始化权重"  value="PandaGPT (7B)" />
          <InfoRow label="训练策略"    value="DeepSpeed Stage 1 + LoRA" />
          <InfoRow label="学习率"      value="见 dsconfig/openllama_peft_stage_1.json" />

          <div style={{ marginTop: 20 }}>
            <button
              onClick={startTraining}
              disabled={starting || status?.running}
              style={{
                width: "100%",
                fontFamily: "var(--display)",
                fontWeight: 700,
                fontSize: 14,
                color: "var(--bg)",
                background: status?.running ? "rgba(255,184,76,.3)" : "var(--accent)",
                border: "none",
                borderRadius: "var(--radius)",
                padding: "12px",
                cursor: status?.running ? "not-allowed" : "pointer",
                letterSpacing: "0.06em",
                transition: "all .2s",
              }}
            >
              {status?.running ? "▶ 训练进行中 …" : "◈ 开始训练"}
            </button>
          </div>
        </Card>

        {/* Log */}
        <Card>
          <SectionTitle>
            训练日志
            {status?.running && (
              <span style={{ marginLeft: 10, fontFamily: "var(--mono)", fontSize: 10, color: "var(--warn)" }}>
                运行中 {status.progress}%
              </span>
            )}
          </SectionTitle>

          {/* Progress bar */}
          {status && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ background: "var(--bg1)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${status.progress || 0}%`,
                  background: status.error
                    ? "var(--danger)"
                    : "linear-gradient(90deg, var(--accent2), var(--accent))",
                  transition: "width .5s ease",
                  borderRadius: 4,
                }} />
              </div>
            </div>
          )}

          <div
            ref={logRef}
            style={{
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "12px 14px",
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: "#7a8899",
              height: 360,
              overflowY: "auto",
              lineHeight: 1.8,
            }}
          >
            {status?.error && (
              <div style={{ color: "var(--danger)", marginBottom: 8 }}>
                ⚠ ERROR: {status.error}
              </div>
            )}
            {status?.log?.length > 0 ? (
              status.log.map((line, i) => (
                <div key={i} style={{ color: line.includes("error") || line.includes("Error") ? "var(--danger)" : "#7a8899" }}>
                  {line}
                </div>
              ))
            ) : (
              <div style={{ color: "var(--muted)", fontStyle: "italic" }}>
                等待训练开始 …<br /><br />
                请先确保：<br />
                1. DGM4 数据集已下载到 FAK-Owl/data/DGM4/<br />
                2. Vicuna、ImageBind、PandaGPT 权重已就位<br />
                3. 运行了 scripts/setup.sh
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Status Tab
// ═══════════════════════════════════════════════════════════════════════════
function StatusTab({ status }) {
  return (
    <div style={{ animation: "fadeUp .5s ease" }}>
      <PageHeader
        title="系统状态"
        sub="服务器 · 模型 · GPU 信息"
      />

      {!status ? (
        <Card>
          <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--danger)" }}>
            ⚠ 无法连接到后端服务器 (http://localhost:5006)<br /><br />
            请确保已运行：<br />
            <code style={{ color: "var(--accent)" }}>conda activate FKA_Owl && python FAK-Owl/code/server.py</code>
          </div>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card>
            <SectionTitle>模型状态</SectionTitle>
            <InfoRow label="模型已加载"    value={status.model_loaded ? "✓ 是" : "✗ 否"} color={status.model_loaded ? "var(--accent)" : "var(--danger)"} />
            <InfoRow label="加载中"        value={status.model_loading ? "是" : "否"} />
            <InfoRow label="FKA-Owl 权重"  value={status.fka_weights ? "✓ 已加载" : "✗ 未找到（需训练）"} color={status.fka_weights ? "var(--accent)" : "var(--warn)"} />
            {status.model_error && (
              <div style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 11, color: "var(--danger)", background: "rgba(255,76,106,.06)", borderRadius: 6, padding: "8px 12px" }}>
                错误: {status.model_error}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle>GPU 信息</SectionTitle>
            {status.gpu?.name ? (
              <>
                <InfoRow label="GPU"      value={status.gpu.name} />
                <InfoRow label="总显存"   value={`${status.gpu.total_memory} GB`} />
                <InfoRow label="已用显存" value={`${status.gpu.used_memory} GB`} />
              </>
            ) : (
              <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--warn)" }}>
                ⚠ 未检测到 CUDA GPU<br />
                FKA-Owl 需要 NVIDIA GPU (推荐 ≥ 16GB VRAM)
              </div>
            )}
          </Card>

          <Card style={{ gridColumn: "1 / -1" }}>
            <SectionTitle>环境要求</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { item: "Python 3.9",                   req: "必须" },
                { item: "PyTorch 1.13.1 + CUDA 11.7",  req: "必须" },
                { item: "NVIDIA GPU (≥ 16GB VRAM)",     req: "强烈建议" },
                { item: "ImageBind checkpoint (~2GB)",  req: "必须" },
                { item: "Vicuna-7B-v1.5 (~13GB)",       req: "必须" },
                { item: "PandaGPT delta weights (~3GB)", req: "必须" },
                { item: "DGM4 数据集",                   req: "训练时必须" },
                { item: "FKA-Owl 微调权重",              req: "推理时建议" },
              ].map(({ item, req }) => (
                <div key={item} style={{
                  display: "flex", justifyContent: "space-between",
                  padding: "7px 12px",
                  background: "var(--bg1)",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                }}>
                  <span style={{ fontFamily: "var(--sans)", fontSize: 13 }}>{item}</span>
                  <Tag color={req === "必须" ? "var(--danger)" : "var(--warn)"}>{req}</Tag>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Shared components ─────────────────────────────────────────────────────

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: "var(--bg1)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "20px 22px",
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontFamily: "var(--display)",
      fontWeight: 700,
      fontSize: 14,
      color: "#fff",
      letterSpacing: "0.04em",
      marginBottom: 16,
      paddingBottom: 10,
      borderBottom: "1px solid var(--border)",
    }}>
      {children}
    </div>
  );
}

function PageHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h1 style={{
        fontFamily: "var(--display)",
        fontWeight: 800,
        fontSize: 26,
        color: "#fff",
        letterSpacing: "0.03em",
        marginBottom: 6,
      }}>
        {title}
      </h1>
      <p style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.1em" }}>
        {sub}
      </p>
    </div>
  );
}

function InfoRow({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <Label>{label}</Label>
      <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: color || "var(--text)" }}>{value}</span>
    </div>
  );
}
