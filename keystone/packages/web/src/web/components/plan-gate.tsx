import type { ReactNode } from "react";
import { Link } from "wouter";
import { Lock } from "lucide-react";
import { featureMinPlan, hasFeature, PLANS, type Feature } from "../../shared/plans";
import { useMeData } from "./session";
import { cn } from "../lib/utils";

export function useFeature(f: Feature) {
  const me = useMeData();
  return hasFeature(me.plan, f);
}

export function UpgradeNote({ feature, children, className }: { feature: Feature; children?: ReactNode; className?: string }) {
  const plan = PLANS[featureMinPlan(feature)];
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border border-brand/25 bg-tint px-4 py-3", className)}>
      <Lock className="size-4 text-brand mt-0.5 shrink-0" />
      <div className="text-sm">
        <p className="text-ink font-semibold">Available on {plan.name}</p>
        {children && <p className="text-body mt-0.5">{children}</p>}
        <Link href="/billing" className="inline-block mt-1.5 font-semibold text-brand hover:underline">
          Upgrade to {plan.name} — from ${plan.annual}/mo →
        </Link>
      </div>
    </div>
  );
}
