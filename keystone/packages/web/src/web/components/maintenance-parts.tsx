import { useState } from "react";
import { ImageIcon, Camera, X } from "lucide-react";
import { useFileUrl } from "../queries/files";
import { uploadFile, openFile } from "../lib/upload";
import { Pill, Spinner } from "./ui/kit";
import { cn } from "../lib/utils";

export function PhotoThumb({ file, className }: { file: { key: string; name: string }; className?: string }) {
  const q = useFileUrl(file.key);
  return (
    <button type="button" onClick={() => openFile(file.key, file.name)} className={cn("size-20 rounded-md overflow-hidden bg-app border border-line grid place-items-center cursor-pointer", className)} title={file.name}>
      {q.data?.url ? <img src={q.data.url} alt={file.name} className="size-full object-cover" /> : <ImageIcon className="size-5 text-muted" />}
    </button>
  );
}

/** Uploads photos to storage and returns {key,name}[] via onChange. */
export function PhotoUploader({ value, onChange }: { value: { key: string; name: string }[]; onChange: (v: { key: string; name: string }[]) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      {value.map((p) => (
        <div key={p.key} className="relative">
          <PhotoThumb file={p} />
          <button type="button" onClick={() => onChange(value.filter((x) => x.key !== p.key))} className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-ink text-white grid place-items-center cursor-pointer"><X className="size-3" /></button>
        </div>
      ))}
      <label className="size-20 rounded-md border-2 border-dashed border-line grid place-items-center text-muted hover:border-brand hover:text-brand cursor-pointer">
        {busy ? <Spinner /> : <span className="flex flex-col items-center text-[11px] font-semibold"><Camera className="size-5 mb-0.5" />Add photo</span>}
        <input
          type="file"
          aria-label="Add photos"
          accept="image/*"
          multiple
          className="hidden"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            if (!files.length) return;
            setBusy(true);
            try {
              const ups = await Promise.all(files.map(uploadFile));
              onChange([...value, ...ups.map((u) => ({ key: u.key, name: u.name }))]);
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
      </label>
    </div>
  );
}

export function PriorityPill({ p }: { p: string }) {
  return <Pill tone={p === "emergency" ? "red" : p === "high" ? "amber" : p === "low" ? "green" : "gray"}>{p}</Pill>;
}
