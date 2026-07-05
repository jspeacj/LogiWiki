import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canonical } from "@/lib/site";
import { getServerAuth } from "@/lib/auth/server";
import { PostEditor } from "@/components/community/post-editor";

export const metadata: Metadata = {
  title: "글쓰기",
  alternates: { canonical: canonical("community/new") },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NewPostPage() {
  // 로그인 필수(서버측 강제). 미로그인 시 로그인 페이지로.
  const auth = await getServerAuth();
  if (!auth?.user) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <PostEditor />
    </div>
  );
}
