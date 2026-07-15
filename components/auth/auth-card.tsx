import Link from "next/link";
import { BookOpen } from "lucide-react";
import { siteConfig } from "@/lib/site";

/**
 * 인증 페이지 공통 셸. 좌측 브랜드 패널 + 우측 폼(글래스모피즘 분할 레이아웃).
 * 좁은 화면에서는 좌측 패널을 숨기고 상단에 컴팩트 로고만 노출한다.
 */
export function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-5xl items-center px-5 py-10">
      <div className="glass grid w-full overflow-hidden rounded-3xl md:grid-cols-2">
        {/* 좌측 브랜드 패널 */}
        <div className="relative hidden flex-col justify-between bg-gradient-to-br from-brand/20 via-brand-2/10 to-transparent p-8 md:flex">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background:
                "radial-gradient(60% 50% at 30% 10%, rgb(99 102 241 / 0.25), transparent 70%)",
            }}
            aria-hidden
          />
          <Link href="/" className="relative flex items-center gap-2.5 font-semibold">
            <span className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-2 text-white glow-brand">
              <BookOpen className="size-4.5" strokeWidth={2.2} />
            </span>
            <span className="text-[15px] tracking-tight">{siteConfig.shortName}</span>
          </Link>
          <div className="relative">
            <h2 className="text-2xl font-bold leading-snug tracking-tight text-foreground">
              배우고, 나누고, 확인하세요.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-strong">
              서적 열람은 로그인 없이 무료입니다. 로그인하면 댓글·추천과 자유게시판을 이용할 수 있어요.
            </p>
          </div>
        </div>

        {/* 우측 폼 영역 */}
        <div className="bg-background-elev/40 p-7 sm:p-10">
          <Link href="/" className="mb-7 inline-flex items-center gap-2 font-semibold md:hidden">
            <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-2 text-white">
              <BookOpen className="size-4" strokeWidth={2.2} />
            </span>
            <span className="text-sm tracking-tight">{siteConfig.shortName}</span>
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** 폼 필드 에러 텍스트. */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs text-rose-300">
      {message}
    </p>
  );
}

/** "또는" 구분선. */
export function OrDivider({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-muted">
      <span className="h-px flex-1 bg-white/[0.08]" />
      {label}
      <span className="h-px flex-1 bg-white/[0.08]" />
    </div>
  );
}
