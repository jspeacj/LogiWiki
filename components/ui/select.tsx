import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        "h-11 w-full appearance-none rounded-xl border border-white/10 bg-white/[0.03] pl-3.5 pr-10 text-sm text-foreground transition-colors",
        "focus:border-brand/50 focus:bg-white/[0.05] focus:outline-none focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-55",
        "[&>option]:bg-background-elev [&>option]:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
  </div>
));
Select.displayName = "Select";
