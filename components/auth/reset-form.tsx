"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { authUrl } from "@/lib/site";
import { isValidEmail } from "@/lib/auth/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, FieldError } from "./auth-card";

export function ResetForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError("올바른 이메일을 입력하세요.");
      return;
    }
    setError(undefined);
    setLoading(true);
    const supabase = createClient();
    // 콜백에서 코드 교환 후 update-password 로 이동.
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authUrl("auth/callback?next=/update-password"),
    });
    setLoading(false);
    // 계정 존재 여부를 노출하지 않도록 항상 성공 화면을 보여준다.
    setDone(true);
  }

  if (done) {
    return (
      <AuthCard title="비밀번호 찾기" subtitle="재설정 링크를 보냈습니다.">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-accent-cyan/12 text-accent-cyan">
            <MailCheck className="size-7" />
          </span>
          <p role="status" className="text-sm leading-relaxed text-muted-strong">
            해당 이메일로 가입된 계정이 있다면 비밀번호 재설정 링크를 보냈습니다. 메일함을 확인하세요.
          </p>
          <Link
            href="/login"
            className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            로그인으로 돌아가기
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="비밀번호 찾기" subtitle="가입한 이메일로 재설정 링크를 보내드립니다.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <Label htmlFor="email">이메일</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!error}
            placeholder="you@example.com"
          />
          <FieldError message={error} />
        </div>
        <Button type="submit" fullWidth loading={loading}>
          재설정 링크 보내기
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          로그인으로 돌아가기
        </Link>
      </p>
    </AuthCard>
  );
}
