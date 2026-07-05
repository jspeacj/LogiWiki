import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canonical } from "@/lib/site";
import { getServerAuth } from "@/lib/auth/server";
import { AccountSettings } from "@/components/account/account-settings";

export const metadata: Metadata = {
  title: "내 계정",
  alternates: { canonical: canonical("account") },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const auth = await getServerAuth();
  if (!auth?.user) redirect("/login");
  const { user, supabase } = auth;

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .maybeSingle();

  // 비밀번호(이메일) 자격이 있는지 — Google 전용 계정은 비밀번호 "설정" 안내를 띄운다.
  const hasPassword = (user.identities ?? []).some((i) => i.provider === "email");

  return (
    <AccountSettings
      email={user.email ?? ""}
      nickname={profile?.nickname ?? ""}
      hasPassword={hasPassword}
    />
  );
}
