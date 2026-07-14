"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AtSign,
  CheckCircle2,
  KeyRound,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { updateNickname, type AccountState } from "@/app/actions/account";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { useAuth } from "@/lib/auth/context";
import {
  hasReservedNickname,
  isValidPassword,
  NICKNAME_MAX,
  NICKNAME_MIN,
} from "@/lib/auth/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** 닉네임 액션 에러코드 → 메시지. */
function nicknameError(code?: string): string | undefined {
  switch (code) {
    case "INVALID":
      return "닉네임은 2~20자로 입력하세요.";
    case "RESERVED":
      return "사용할 수 없는 닉네임입니다.";
    case "TAKEN":
      return "이미 사용 중인 닉네임입니다.";
    case undefined:
      return undefined;
    default:
      return "문제가 발생했습니다. 다시 시도해 주세요.";
  }
}

export function AccountSettings({
  email,
  nickname,
  hasPassword,
}: {
  email: string;
  nickname: string;
  hasPassword: boolean;
}) {
  const { isAdmin, refreshProfile } = useAuth();

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        홈으로
      </Link>

      <header className="mt-5 mb-8">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-white glow-brand">
            <UserRound className="size-5.5" strokeWidth={2.1} />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              내 계정
            </h1>
            <p className="mt-0.5 text-sm text-muted">계정 정보와 보안 설정을 관리하세요.</p>
          </div>
        </div>
      </header>

      <div className="space-y-5">
        <AccountInfoCard email={email} hasPassword={hasPassword} />
        <NicknameCard current={nickname} isAdmin={isAdmin} onSaved={refreshProfile} />
        <PasswordCard hasPassword={hasPassword} />
      </div>
    </div>
  );
}

/* ── 계정 정보(읽기 전용) ─────────────────────────────────────────────────── */
function AccountInfoCard({
  email,
  hasPassword,
}: {
  email: string;
  hasPassword: boolean;
}) {
  return (
    <section className="glass rounded-2xl p-5 sm:p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
        계정 정보
      </h2>
      <dl className="space-y-3 text-sm">
        <div className="flex items-center gap-3">
          <Mail className="size-4 shrink-0 text-muted" />
          <dt className="w-28 shrink-0 text-muted">이메일</dt>
          <dd className="truncate font-medium text-foreground">{email}</dd>
        </div>
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-4 shrink-0 text-muted" />
          <dt className="w-28 shrink-0 text-muted">로그인 방식</dt>
          <dd className="font-medium text-foreground">
            {hasPassword ? "이메일 + 비밀번호" : "Google 계정"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

/* ── 닉네임 수정 ───────────────────────────────────────────────────────────── */
function NicknameCard({
  current,
  isAdmin,
  onSaved,
}: {
  current: string;
  isAdmin: boolean;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState(current);
  const [state, action, pending] = useActionState<AccountState, FormData>(
    updateNickname,
    {},
  );

  // 저장 성공 시 헤더 닉네임 즉시 갱신(auth context 동기화).
  useEffect(() => {
    if (state.ok && state.nickname) void onSaved();
  }, [state, onSaved]);

  const saved = state.ok && state.nickname ? state.nickname : current;
  const trimmed = value.trim();
  const tooShortOrLong =
    trimmed.length < NICKNAME_MIN || trimmed.length > NICKNAME_MAX;
  const reserved = hasReservedNickname(trimmed) && !isAdmin;
  const unchanged = trimmed === saved;
  const clientError = reserved
    ? "사용할 수 없는 닉네임입니다."
    : tooShortOrLong && trimmed.length > 0
      ? "닉네임은 2~20자로 입력하세요."
      : undefined;
  const serverError = nicknameError(state.error);
  const disabled = pending || unchanged || tooShortOrLong || reserved;

  return (
    <section className="glass rounded-2xl p-5 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <AtSign className="size-4 text-accent-cyan" />
        <h2 className="text-base font-semibold text-foreground">닉네임</h2>
      </div>
      <p className="mb-4 text-sm text-muted">서적 댓글·게시판에서 표시되는 이름입니다.</p>

      <form action={action} className="space-y-3">
        <div>
          <Label htmlFor="nickname" className="sr-only">닉네임</Label>
          <Input
            id="nickname"
            name="nickname"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={NICKNAME_MAX}
            autoComplete="off"
            aria-invalid={!!clientError}
          />
          {(clientError || (!state.ok && serverError)) && (
            <p className="mt-1.5 text-xs text-rose-300">{clientError ?? serverError}</p>
          )}
          {state.ok && !clientError && unchanged && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-accent-emerald">
              <CheckCircle2 className="size-3.5" />
              저장되었습니다.
            </p>
          )}
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="sm" loading={pending} disabled={disabled}>
            {pending ? "저장 중…" : "저장"}
          </Button>
        </div>
      </form>
    </section>
  );
}

/* ── 비밀번호 수정 ─────────────────────────────────────────────────────────── */
function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDone(false);
    if (!isValidPassword(password)) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setError(undefined);
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(authErrorMessage(err));
      return;
    }
    setPassword("");
    setConfirm("");
    setDone(true);
  }

  return (
    <section className="glass rounded-2xl p-5 sm:p-6">
      <div className="mb-1 flex items-center gap-2">
        <KeyRound className="size-4 text-accent-emerald" />
        <h2 className="text-base font-semibold text-foreground">비밀번호</h2>
      </div>
      <p className="mb-4 text-sm text-muted">
        {hasPassword
          ? "새 비밀번호로 변경할 수 있습니다."
          : "Google 계정으로 가입하셨습니다. 비밀번호를 설정하면 이메일로도 로그인할 수 있어요."}
      </p>

      <form onSubmit={onSubmit} noValidate className="space-y-3">
        <div>
          <Label htmlFor="new-password">새 비밀번호</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="confirm-password">비밀번호 확인</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {error && <p className="text-xs text-rose-300">{error}</p>}
        {done && (
          <p className="inline-flex items-center gap-1 text-xs text-accent-emerald">
            <CheckCircle2 className="size-3.5" />
            비밀번호가 변경되었습니다.
          </p>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            loading={loading}
            disabled={loading || !password || !confirm}
          >
            {loading ? "저장 중…" : "비밀번호 변경"}
          </Button>
        </div>
      </form>
    </section>
  );
}
