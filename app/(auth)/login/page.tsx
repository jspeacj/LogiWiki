import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: "로그인",
  alternates: { canonical: canonical("login") },
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <LoginForm />;
}
