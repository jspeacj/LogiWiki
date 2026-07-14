"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { isValidPassword } from "@/lib/auth/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, FieldError } from "./auth-card";

type Errors = { password?: string; confirm?: string; form?: string };

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!isValidPassword(password)) next.password = "비밀번호는 8자 이상이어야 합니다.";
    if (password !== confirm) next.confirm = "비밀번호가 일치하지 않습니다.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setErrors({ form: authErrorMessage(error) });
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <AuthCard title="새 비밀번호 설정" subtitle="비밀번호가 변경되었습니다.">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-accent-emerald/12 text-accent-emerald">
            <ShieldCheck className="size-7" />
          </span>
          <p className="text-sm leading-relaxed text-muted-strong">
            새 비밀번호로 변경되었습니다. 이제 로그인할 수 있습니다.
          </p>
          <Button onClick={() => router.push("/login")}>로그인</Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="새 비밀번호 설정" subtitle="사용할 새 비밀번호를 입력하세요.">
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <Label htmlFor="password">새 비밀번호</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password}
          />
          <FieldError message={errors.password} />
        </div>
        <div>
          <Label htmlFor="confirm">비밀번호 확인</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={!!errors.confirm}
          />
          <FieldError message={errors.confirm} />
        </div>

        {errors.form && (
          <p className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
            {errors.form}
          </p>
        )}

        <Button type="submit" fullWidth loading={loading}>
          비밀번호 변경
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
