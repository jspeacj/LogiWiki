import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 text-sm text-foreground placeholder:text-muted/70 transition-colors",
      "focus:border-brand/50 focus:bg-white/[0.05] focus:outline-none focus-visible:outline-none",
      "disabled:cursor-not-allowed disabled:opacity-55",
      "aria-[invalid=true]:border-rose-400/60",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";
