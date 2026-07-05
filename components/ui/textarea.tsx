import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted/70 transition-colors",
      "focus:border-brand/50 focus:bg-white/[0.05] focus:outline-none focus-visible:outline-none",
      "disabled:cursor-not-allowed disabled:opacity-55 resize-y min-h-32",
      "aria-[invalid=true]:border-rose-400/60",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
