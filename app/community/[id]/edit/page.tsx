import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { canonical } from "@/lib/site";
import { getServerAuth } from "@/lib/auth/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { getPost } from "@/lib/community/queries";
import { PostEditor } from "@/components/community/post-editor";

export const metadata: Metadata = {
  title: "글 수정",
  alternates: { canonical: canonical("community") },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // 로그인 필수.
  const auth = await getServerAuth();
  if (!auth?.user) redirect("/login");
  const { user } = auth;

  const post = await getPost(id);
  if (!post) notFound();

  // 작성자 본인 또는 관리자만 수정 가능.
  if (post.author_id !== user.id && !isAdminEmail(user.email)) {
    redirect(`/community/${id}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <PostEditor
        initial={{
          id: post.id,
          category: post.category,
          title: post.title,
          content: post.content,
        }}
      />
    </div>
  );
}
