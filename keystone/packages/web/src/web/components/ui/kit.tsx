import { forwardRef, useEffect, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { Loader2, X, Info, Inbox } from "lucide-react";
import { cn } from "../../lib/utils";

type Variant = "primary" | "outline" | "ghost" | "danger" | "success" | "subtle";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark shadow-sm",
  outline: "bg-white text-brand border border-brand hover:bg-tint",
  ghost: "text-body hover:bg-app",
  danger: "bg-bad text-white hover:bg-bad/90",
  success: "bg-ok text-white hover:bg-ok/90",
  subtle: "bg-app text-ink hover:bg-line",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean; icon?: ReactNode }>(
  ({ className, variant = "primary", size = "md", loading, icon, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer",
        size === "sm" ? "h-8 px-3 text-[13px]" : size === "lg" ? "h-12 px-6 text-base" : "h-10 px-4 text-sm",
        variants[variant],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export function Card({ title, info, action, children, className, bodyClass }: { title?: ReactNode; info?: string; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cn("bg-white border border-line rounded-lg", className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 px-5 h-14 border-b border-line">
          <h3 className="text-[17px] font-semibold text-ink flex items-center gap-2">
            {title}
            {info && (
              <span title={info} className="text-muted">
                <Info className="size-4" />
              </span>
            )}
          </h3>
          {action}
        </header>
      )}
      <div className={cn("p-5", bodyClass)}>{children}</div>
    </section>
  );
}

const pillTones: Record<string, string> = {
  green: "bg-ok-tint text-ok",
  amber: "bg-warn-tint text-warn",
  red: "bg-bad-tint text-bad",
  blue: "bg-tint text-brand",
  gray: "bg-app text-muted",
  navy: "bg-navy text-white",
};
const statusTone: Record<string, string> = {
  active: "green", paid: "green", approved: "green", confirmed: "green", occupied: "green", completed: "green", low: "green", approve: "green", "on file": "green", "not required": "gray",
  listed: "blue", sent: "blue", assigned: "blue", scheduled: "blue", screening: "blue", submitted: "blue", review: "amber", tenant_signed: "amber", in_progress: "amber", pending: "amber", reported: "amber", pending_second: "amber", moderate: "amber", conditional: "amber", info_requested: "amber", due: "amber", high: "amber", normal: "gray",
  rejected: "red", overdue: "red", emergency: "red", decline: "red", missing: "red", "1099-NEC required": "red",
  draft: "gray", vacant: "gray", ended: "gray", closed: "gray", new: "blue",
};
const statusLabel: Record<string, string> = { tenant_signed: "Awaiting countersign", pending_second: "Needs 2nd approval", info_requested: "Info requested", in_progress: "In progress", review: "In review", sent: "Out for signature" };

export function Pill({ children, tone, className }: { children: ReactNode; tone?: keyof typeof pillTones; className?: string }) {
  const t = tone ?? (typeof children === "string" ? (statusTone[children] as keyof typeof pillTones) : undefined) ?? "gray";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize whitespace-nowrap", pillTones[t], className)}>
      {typeof children === "string" ? (statusLabel[children] ?? children.replace(/_/g, " ")) : children}
    </span>
  );
}

export function PageHeader({ icon, title, subtitle, actions, children }: { icon: ReactNode; title: string; subtitle?: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      <div className="size-12 rounded-lg bg-tint text-brand grid place-items-center shrink-0 [&>svg]:size-6">{icon}</div>
      <div className="min-w-0">
        <h1 className="text-[28px] leading-tight font-bold text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
      </div>
      {children}
      <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="block text-[13px] font-semibold text-ink mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  );
}

const inputCls = "w-full h-10 rounded-md border border-line bg-white px-3 text-sm text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition";
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cn(inputCls, className)} {...p} />);
Input.displayName = "Input";
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...p }, ref) => (
  <select ref={ref} className={cn(inputCls, "pr-8 cursor-pointer", className)} {...p}>
    {children}
  </select>
));
Select.displayName = "Select";
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => <textarea ref={ref} className={cn(inputCls, "h-auto py-2 min-h-[90px]", className)} {...p} />);
Textarea.displayName = "Textarea";

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/40 p-4 pt-[6vh] backdrop-blur-[2px]" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cn("w-full bg-white rounded-lg shadow-2xl page-enter", wide ? "max-w-3xl" : "max-w-lg")}>
        <div className="flex items-center justify-between px-6 h-14 border-b border-line">
          <h3 className="font-bold text-lg">{title}</h3>
          <button aria-label="Close" onClick={onClose} className="text-muted hover:text-ink cursor-pointer">
            <X className="size-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-6 py-4 border-t border-line bg-app/50 rounded-b-lg">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-brand", className)} />;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted text-sm">
      <Spinner /> {label}
    </div>
  );
}

export function Empty({ title, children, icon, action }: { title: string; children?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="text-center py-12 px-6">
      <div className="mx-auto size-12 rounded-full bg-tint text-brand grid place-items-center mb-3 [&>svg]:size-6">{icon ?? <Inbox />}</div>
      <p className="font-semibold text-ink">{title}</p>
      {children && <p className="text-sm text-muted mt-1 max-w-md mx-auto">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "ok" | "bad" | "warn" }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("text-2xl font-bold mt-1", tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-ink")}>{value}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

/** A Stat in its own bordered tile, for KPI rows. */
export function StatBox(props: Parameters<typeof Stat>[0]) {
  return (
    <div className="bg-white border border-line rounded-lg p-5">
      <Stat {...props} />
    </div>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted [&_th]:px-4 [&_th]:py-3 [&_th]:bg-app/60 [&_th]:whitespace-nowrap [&_td]:px-4 [&_td]:py-3 [&_td]:border-t [&_td]:border-line [&_tbody_tr:hover]:bg-app/40">
        {children}
      </table>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: string; count?: number }[] }) {
  return (
    <div className="flex gap-1 border-b border-line mb-5 overflow-x-auto overflow-y-hidden">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn("px-4 h-11 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap cursor-pointer transition-colors", value === t.id ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink")}
        >
          {t.label}
          {t.count != null && <span className={cn("ml-2 rounded-full px-1.5 py-0.5 text-[11px]", value === t.id ? "bg-tint" : "bg-app")}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  return <p className="text-sm text-bad bg-bad-tint rounded-md px-3 py-2">{error instanceof Error ? error.message : String(error)}</p>;
}
