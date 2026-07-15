"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { authUrl } from "@/lib/site";
import {
  hasReservedNickname,
  isValidEmail,
  isValidNickname,
  isValidPassword,
} from "@/lib/auth/validators";
import { isAdminEmail } from "@/lib/auth/admin";
import { authErrorMessage } from "@/lib/auth/errors";
import { isNicknameTaken } from "@/lib/auth/nickname";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, FieldError, OrDivider } from "./auth-card";
import { OAuthButton } from "./oauth-button";

type Errors = {
  nickname?: string;
  email?: string;
  password?: string;
  passwordConfirm?: string;
  form?: string;
};

export function SignupForm() {
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!isValidNickname(nickname)) next.nickname = "닉네임은 2~20자로 입력하세요.";
    // 예약 닉네임(브랜드/역할 사칭)은 관리자 계정만 사용 가능.
    else if (hasReservedNickname(nickname) && !isAdminEmail(email))
      next.nickname = "사용할 수 없는 닉네임입니다.";
    if (!isValidEmail(email)) next.email = "올바른 이메일을 입력하세요.";
    if (!isValidPassword(password)) next.password = "비밀번호는 8자 이상이어야 합니다.";
    if (password !== confirm) next.passwordConfirm = "비밀번호가 일치하지 않습니다.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    const supabase = createClient();

    // 닉네임 중복 검사(대소문자 무시). 최종 무결성은 DB 유니크 인덱스가 보장.
    if (await isNicknameTaken(supabase, nickname)) {
      setLoading(false);
      setErrors({ nickname: "이미 사용 중인 닉네임입니다." });
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { nickname: nickname.trim() },
        emailRedirectTo: authUrl("auth/callback"),
      },
    });
    setLoading(false);

    if (error) {
      // 원문(error.message)을 그대로 뿌리면 GoTrue 가 본문 없는 5xx 를 줄 때 "{}" 가 노출된다.
      setErrors({ form: authErrorMessage(error) });
      return;
    }

    // 이미 가입된 이메일: Supabase 는 이메일 존재 여부 노출을 막기 위해 에러 대신
    // 빈 identities 로 가짜 성공을 반환한다(Confirm email 활성 시). 이를 중복으로 판정.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      setErrors({ email: "이미 가입된 이메일입니다." });
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <AuthCard title="회원가입" subtitle="이메일을 확인해 주세요.">
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-accent-emerald/12 text-accent-emerald">
            <MailCheck className="size-7" />
          </span>
          <p role="status" className="text-sm leading-relaxed text-muted-strong">
            입력하신 이메일로 인증 링크를 보냈습니다. 메일의 링크를 눌러 가입을 완료하세요.
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
    <AuthCard title="회원가입" subtitle="댓글·추천과 자유게시판을 이용하려면 가입하세요.">
      <OAuthButton />
      <OrDivider label="또는" />

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div>
          <Label htmlFor="nickname">닉네임</Label>
          <Input
            id="nickname"
            autoComplete="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            aria-invalid={!!errors.nickname}
            maxLength={20}
          />
          <FieldError message={errors.nickname} />
        </div>

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
          <Label htmlFor="password">비밀번호</Label>
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
            aria-invalid={!!errors.passwordConfirm}
          />
          <FieldError message={errors.passwordConfirm} />
        </div>

        {errors.form && (
          <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
            {errors.form}
          </p>
        )}

        <Button type="submit" fullWidth loading={loading}>
          가입하기
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        이미 계정이 있으신가요?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          로그인
        </Link>
      </p>
    </AuthCard>
  );
}
