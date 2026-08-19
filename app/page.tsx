"use client";

import { useEffect, useRef, useState } from "react";

type Mode = "prepare" | "trace";
type Style = "outline" | "pencil" | "simple";

export default function Home() {
  const [mode, setMode] = useState<Mode>("prepare");
  const [style, setStyle] = useState<Style>("outline");
  const [detail, setDetail] = useState(48);
  const [opacity, setOpacity] = useState(0.62);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [sketchUrl, setSketchUrl] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [locked, setLocked] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef({ active: false, sx: 0, sy: 0, x: 50, y: 50 });

  useEffect(() => {
    return () => stopCamera();
  }, []);

  async function startCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setError("Camera access was blocked. Open this site over HTTPS and allow camera permission.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  function handleFile(file?: File) {
    if (!file) return;
  
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image.");
      return;
    }
  
    setError("");
  
    const reader = new FileReader();
  
    reader.onload = () => {
      const url = reader.result as string;
      setImageUrl(url);
      makeSketch(url, style, detail);
    };
  
    reader.onerror = () => {
      setError("Couldn't read that image. Please try another photo.");
    };
  
    reader.readAsDataURL(file);
  }

  function makeSketch(url: string, selectedStyle: Style = style, selectedDetail = detail) {
    const img = new Image();
    img.onload = () => {
      const max = 1200;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, w, h);
      const src = ctx.getImageData(0, 0, w, h);
      const out = ctx.createImageData(w, h);
      const gray = new Float32Array(w * h);

      for (let i = 0; i < gray.length; i++) {
        const p = i * 4;
        gray[i] = 0.299 * src.data[p] + 0.587 * src.data[p + 1] + 0.114 * src.data[p + 2];
      }

      const threshold = 42 + (100 - selectedDetail) * 1.05;

      for (let yy = 1; yy < h - 1; yy++) {
        for (let xx = 1; xx < w - 1; xx++) {
          const i = yy * w + xx;
          const gx =
            -gray[i - w - 1] + gray[i - w + 1] +
            -2 * gray[i - 1] + 2 * gray[i + 1] +
            -gray[i + w - 1] + gray[i + w + 1];
          const gy =
            -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] +
            gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
          const mag = Math.sqrt(gx * gx + gy * gy);
          const p = i * 4;

          let alpha = mag > threshold ? Math.min(235, 80 + mag * 1.5) : 0;
          if (selectedStyle === "simple") alpha = mag > threshold * 1.18 ? Math.min(220, 70 + mag * 1.35) : 0;
          if (selectedStyle === "pencil") alpha = mag > threshold * 0.82 ? Math.min(180, 45 + mag * 0.9) : 0;

          out.data[p] = 25;
          out.data[p + 1] = 20;
          out.data[p + 2] = 18;
          out.data[p + 3] = alpha;
        }
      }

      ctx.clearRect(0, 0, w, h);
      ctx.putImageData(out, 0, 0);
      setSketchUrl(canvas.toDataURL("image/png"));
    };
    img.src = url;
  }

  function chooseStyle(next: Style) {
    setStyle(next);
    if (imageUrl) makeSketch(imageUrl, next, detail);
  }

  function changeDetail(value: number) {
    setDetail(value);
    if (imageUrl) makeSketch(imageUrl, style, value);
  }

  function pointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (locked) return;
    dragRef.current = { active: true, sx: e.clientX, sy: e.clientY, x, y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function pointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active || locked) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = ((e.clientX - dragRef.current.sx) / rect.width) * 100;
    const dy = ((e.clientY - dragRef.current.sy) / rect.height) * 100;
    setX(Math.max(0, Math.min(100, dragRef.current.x + dx)));
    setY(Math.max(0, Math.min(100, dragRef.current.y + dy)));
  }

  function pointerUp() {
    dragRef.current.active = false;
  }

  return (
    <main className="app">
      <header className="topbar">
        <button className="iconBtn" onClick={() => mode === "trace" ? setMode("prepare") : inputRef.current?.click()} aria-label="Back">‹</button>
        <div className="brand">Trace<span>Canvas</span></div>
        {mode === "prepare" ? (
          <button className="doneBtn" disabled={!sketchUrl} onClick={() => { setMode("trace"); startCamera(); }}>TRACE</button>
        ) : (
          <button className="doneBtn" onClick={() => { setLocked(true); }}>✓</button>
        )}
      </header>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {mode === "prepare" ? (
        <section className="prepare">
          {!imageUrl ? (
            <div className="empty">
              <div className="cameraCircle">⌁</div>
              <h1>Turn a photo into a drawing guide</h1>
              <p>Upload a photo, simplify its lines, then trace it on your real canvas.</p>
              <div className="actions">
                <button className="primary" onClick={() => inputRef.current?.click()}>🖼 Choose photo</button>
                <button className="secondary" onClick={startCamera}>📷 Use camera</button>
              </div>
            </div>
          ) : (
            <div className="editor">
              <div className="preview">
                <img src={imageUrl} alt="Reference" />
                {sketchUrl && <img className="sketchPreview" src={sketchUrl} alt="Sketch" />}
              </div>

              <div className="controls">
                <div className="sectionTitle">Drawing style</div>
                <div className="chips">
                  {(["outline", "pencil", "simple"] as Style[]).map((s) => (
                    <button key={s} className={style === s ? "chip active" : "chip"} onClick={() => chooseStyle(s)}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>

                <label className="rangeLabel">
                  <span>Detail</span><b>{detail}%</b>
                </label>
                <input type="range" min="5" max="95" value={detail} onChange={(e) => changeDetail(Number(e.target.value))} />

                <button className="primary wide" onClick={() => { setMode("trace"); startCamera(); }}>Open tracing camera →</button>
                <button className="secondary wide" onClick={() => inputRef.current?.click()}>Choose another photo</button>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="trace">
          <video ref={videoRef} className="camera" playsInline muted />
          {!cameraOn && (
            <div className="cameraFallback">
              <button className="primary" onClick={startCamera}>Enable camera</button>
            </div>
          )}

          {sketchUrl && (
            <div
              className={locked ? "overlay locked" : "overlay"}
              style={{ left: `${x}%`, top: `${y}%`, opacity, transform: `translate(-50%, -50%) scale(${zoom})` }}
              onPointerDown={pointerDown}
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
            >
              <img src={sketchUrl} alt="Trace guide" draggable={false} />
            </div>
          )}

          <div className="traceHint">{locked ? "🔒 Guide locked — draw on your canvas" : "Drag the guide into place"}</div>

          <div className="traceControls">
            <button className={locked ? "tool active" : "tool"} onClick={() => setLocked((v) => !v)}>
              {locked ? "🔒" : "🔓"}<small>{locked ? "Locked" : "Lock"}</small>
            </button>
            <div className="opacity">
              <span>◌</span>
              <input type="range" min="0.08" max="1" step="0.01" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
              <span>●</span>
            </div>
            <button className="tool" onClick={() => setZoom((v) => Math.min(2.5, v + 0.1))}>＋<small>Zoom</small></button>
            <button className="tool" onClick={() => setZoom((v) => Math.max(0.5, v - 0.1))}>−<small>Out</small></button>
          </div>

          {error && <div className="error">{error}</div>}
        </section>
      )}
    </main>
  );
}