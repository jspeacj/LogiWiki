import type { Metadata } from "next";
import { canonical } from "@/lib/site";
import { listPosts } from "@/lib/community/queries";
import { isCategory, normalizePageSize } from "@/lib/community/types";
import { CommunityHeader } from "@/components/community/community-header";
import { CategoryFilter } from "@/components/community/category-filter";
import { SearchBar } from "@/components/community/search-bar";
import { PostList } from "@/components/community/post-list";
import { PageSizeSelect } from "@/components/ui/page-size-select";
import { Pagination } from "@/components/ui/pagination";

// UGC — 색인 제외(AdSense 대량 동적/도어웨이 정책 회피).
export const metadata: Metadata = {
  title: "자유게시판",
  alternates: { canonical: canonical("community") },
  robots: { index: false, follow: false },
};

// 사용자별 세션·검색어에 따라 매 요청 렌더.
export const dynamic = "force-dynamic";

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const category = isCategory(sp.category) ? sp.category : "all";
  const q = typeof sp.q === "string" ? sp.q : "";
  const page = Number(sp.page) || 1;
  const perPage = normalizePageSize(sp.per);

  const { items, page: current, totalPages } = await listPosts({
    category,
    q,
    page,
    perPage,
  });

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <CommunityHeader />

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CategoryFilter active={category} />
        <SearchBar initial={q} />
      </div>

      <div className="mt-5 flex justify-end">
        <PageSizeSelect value={perPage} />
      </div>

      <div className="mt-3">
        <PostList items={items} searching={!!q} />
      </div>

      <Pagination page={current} totalPages={totalPages} />
    </div>
  );
}
