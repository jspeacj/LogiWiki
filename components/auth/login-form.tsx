"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isValidEmail } from "@/lib/auth/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, FieldError, OrDivider } from "./auth-card";
import { OAuthButton } from "./oauth-button";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!isValidEmail(email)) next.email = "올바른 이메일을 입력하세요.";
    if (!password) next.form = "이메일 또는 비밀번호가 올바르지 않습니다.";
    setErrors(next);
    if (next.email) return;

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      setErrors({ form: "이메일 또는 비밀번호가 올바르지 않습니다." });
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <AuthCard title="로그인" subtitle="다시 오신 걸 환영합니다.">
      <OAuthButton />
      <OrDivider label="또는" />

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <Label htmlFor="email">이메일</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
            placeholder="you@example.com"
          />
          <FieldError message={errors.email} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label htmlFor="password" className="mb-0">비밀번호</Label>
            <Link
              href="/reset-password"
              className="text-xs text-muted transition-colors hover:text-foreground"
            >
              비밀번호를 잊으셨나요?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {errors.form && (
          <p className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
            {errors.form}
          </p>
        )}

        <Button type="submit" fullWidth loading={loading}>
          로그인
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        아직 계정이 없으신가요?{" "}
        <Link
          href="/signup"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          회원가입
        </Link>
      </p>
    </AuthCard>
  );
}
