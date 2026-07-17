import { Skeleton } from "@/components/ui/skeleton";

/**
 * /account 로딩 스켈레톤.
 *
 * force-dynamic + getServerAuth() + profiles 조회가 전부 블로킹인데 경계가 없어서,
 * 헤더 메뉴에서 "내 계정" 을 눌러도 렌더가 끝날 때까지 아무 반응이 없었다.
 *
 * 실제 화면(AccountSettings)과 동일하게 max-w-2xl — 뒤로가기 링크 → 헤더 → 카드 3장.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Skeleton className="h-4 w-16" />
      <header className="mt-6 border-b border-white/10 pb-6">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="mt-2 h-9 w-32" />
      </header>
      <div className="mt-8 space-y-4">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
