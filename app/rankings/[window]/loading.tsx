import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <header className="border-b border-white/10 pb-6">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="mt-2 h-9 w-72" />
      </header>
      <div className="mt-6 flex gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-20 rounded-full" />
        ))}
      </div>
      <div className="mt-8 flex flex-col gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-[86px] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
