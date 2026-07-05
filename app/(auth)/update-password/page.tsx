import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: "새 비밀번호 설정",
  alternates: { canonical: canonical("update-password") },
  robots: { index: false, follow: false },
};

export default function UpdatePasswordPage() {
  return <UpdatePasswordForm />;
}
