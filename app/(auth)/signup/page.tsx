import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";
import { canonical } from "@/lib/site";

export const metadata: Metadata = {
  title: "회원가입",
  alternates: { canonical: canonical("signup") },
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return <SignupForm />;
}
