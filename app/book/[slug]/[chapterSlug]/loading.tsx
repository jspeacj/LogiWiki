import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-10">
        <aside className="mb-8 lg:mb-0">
          <Skeleton className="h-4 w-40" />
          <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-white/10 p-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        </aside>
        <div className="min-w-0">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="mt-4 h-9 w-2/3" />
          <div className="mt-8 flex flex-col gap-3">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className={i % 4 === 3 ? "h-4 w-2/3" : "h-4 w-full"} />
            ))}
            <Skeleton className="mt-3 h-40 w-full rounded-xl" />
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className={i % 3 === 2 ? "h-4 w-1/2" : "h-4 w-full"} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
