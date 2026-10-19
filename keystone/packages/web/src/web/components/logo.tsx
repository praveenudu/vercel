import { cn } from "../lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <path d="M16 2 2 13v17h28V13L16 2Z" fill="currentColor" />
      <path d="M11.5 30V19.5l4.5-3.6 4.5 3.6V30" fill="white" />
      <path d="M13.6 30v-7.3L16 20.8l2.4 1.9V30" fill="currentColor" opacity=".9" />
    </svg>
  );
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className={light ? "text-white" : "text-navy"} />
      <span className={cn("text-[22px] font-extrabold tracking-[0.18em]", light ? "text-white" : "text-navy")}>KEYSTONE</span>
    </span>
  );
}
