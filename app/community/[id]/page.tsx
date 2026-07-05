import type { Metadata } from "next";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { canonical } from "@/lib/site";
import {
  getComments,
  getPost,
  incrementViews,
} from "@/lib/community/queries";
import { PostDetailView } from "@/components/community/post-detail-view";

export const dynamic = "force-dynamic";

// UGC 상세 — 색인 제외.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  return {
    title: post ? post.title : "자유게시판",
    alternates: { canonical: canonical(`community/${id}`) },
    robots: { index: false, follow: false },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // 글·댓글을 병렬 로드(직렬 워터폴 제거). 존재 판정은 post 결과로.
  const [post, comments] = await Promise.all([getPost(id), getComments(id)]);
  if (!post) notFound();

  // 조회수 증가는 렌더 경로에서 제외 — 응답 후 실행(레이턴시 영향 없음, 실패 무해).
  after(() => incrementViews(id));

  return <PostDetailView post={post} comments={comments} />;
}
