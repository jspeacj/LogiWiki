import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/reset-form";
import { canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: "비밀번호 찾기",
  alternates: { canonical: canonical("reset-password") },
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return <ResetForm />;
}
