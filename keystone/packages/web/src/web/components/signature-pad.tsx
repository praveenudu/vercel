import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine, Type } from "lucide-react";
import { cn } from "../lib/utils";

export type SignatureValue = { signature: string; signatureType: "typed" | "drawn" } | null;

/** Typed (rendered in a script font) or drawn (canvas → PNG data URL) signature. */
export function SignaturePad({ defaultName = "", onChange }: { defaultName?: string; onChange: (v: SignatureValue) => void }) {
  const [mode, setMode] = useState<"typed" | "drawn">("typed");
  const [typed, setTyped] = useState(defaultName);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    if (mode === "typed") onChange(typed.trim().length >= 2 ? { signature: typed.trim(), signatureType: "typed" } : null);
    else onChange(hasInk && canvas.current ? { signature: canvas.current.toDataURL("image/png"), signatureType: "drawn" } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, typed, hasInk]);

  useEffect(() => {
    if (mode !== "drawn" || !canvas.current) return;
    const c = canvas.current;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0b1f3a";
    setHasInk(false);
  }, [mode]);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent) => {
    drawing.current = true;
    canvas.current!.setPointerCapture(e.pointerId);
    const ctx = canvas.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvas.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setHasInk(true);
    // re-emit with the latest stroke
    if (canvas.current) onChange({ signature: canvas.current.toDataURL("image/png"), signatureType: "drawn" });
  };
  const clear = () => {
    const c = canvas.current;
    if (!c) return;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  };

  return (
    <div>
      <div className="inline-flex rounded-md border border-line p-0.5 mb-3 bg-app">
        {(["typed", "drawn"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={cn("flex items-center gap-1.5 px-3 h-8 rounded text-[13px] font-semibold cursor-pointer", mode === m ? "bg-white text-brand shadow-sm" : "text-muted")}>
            {m === "typed" ? <Type className="size-3.5" /> : <PenLine className="size-3.5" />}
            {m === "typed" ? "Type" : "Draw"}
          </button>
        ))}
      </div>
      {mode === "typed" ? (
        <div>
          <input aria-label="Typed signature" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type your full legal name" className="w-full h-10 rounded-md border border-line px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand" />
          <div className="mt-3 h-24 rounded-md border border-dashed border-line bg-app/40 flex items-end px-5 pb-3">
            <span className="font-sig text-4xl text-navy leading-none truncate">{typed || <span className="text-muted/50">Your signature</span>}</span>
          </div>
        </div>
      ) : (
        <div className="relative">
          <canvas aria-label="Draw your signature" ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} className="w-full h-36 rounded-md border border-dashed border-line bg-app/40 touch-none cursor-crosshair" />
          {!hasInk && <span className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted">Sign here with your mouse or finger</span>}
          <button type="button" onClick={clear} className="absolute top-2 right-2 flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink bg-white border border-line rounded px-2 h-7 cursor-pointer">
            <Eraser className="size-3.5" /> Clear
          </button>
        </div>
      )}
    </div>
  );
}

/** Renders a stored signature (typed name or drawn PNG). */
export function SignatureView({ signature, type, className }: { signature?: string | null; type?: string | null; className?: string }) {
  if (!signature) return <span className="text-muted text-sm">Not signed</span>;
  if (type === "drawn") return <img src={signature} alt="Signature" className={cn("h-14 object-contain", className)} />;
  return <span className={cn("font-sig text-3xl text-navy leading-none", className)}>{signature}</span>;
}
