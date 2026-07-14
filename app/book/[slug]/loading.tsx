import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <Skeleton className="h-4 w-40" />
      <div className="mt-6 border-b border-white/10 pb-8">
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="mt-4 h-10 w-3/4" />
        <Skeleton className="mt-4 h-4 w-full max-w-2xl" />
        <Skeleton className="mt-2 h-4 w-2/3" />
        <div className="mt-5 flex gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-20" />
          ))}
        </div>
        <Skeleton className="mt-7 h-11 w-32 rounded-full" />
      </div>
      <div className="py-8">
        <Skeleton className="h-5 w-16" />
        <div className="mt-4 flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
