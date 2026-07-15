"use client";

import { useActionState, useState } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import {
  updateAiSettings,
  type AdminActionState,
  type AiSettings,
} from "@/app/actions/wiki-admin";
import { BOOK_LANGUAGES, LANGUAGE_LABEL } from "@/lib/wiki/types";
import { errorText } from "@/lib/wiki/messages";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ERR = { FORBIDDEN: "관리자만 변경할 수 있습니다." };

const COUNTS = [0, 1, 2, 3, 4, 5];

/**
 * 매일 자동 생성 설정(관리자 전용).
 *
 * 비용이 걸린 설정이라 "켬 + 권수"를 한눈에 보이게 하고, 켤 때 예상 비용을 명시한다.
 * apiEnabled=false(=ANTHROPIC_API_KEY 미설정)면 켜도 cron 이 스킵한다는 걸 분명히 알린다.
 */
export function AiSettingsForm({
  settings,
  apiEnabled,
}: {
  settings: AiSettings;
  apiEnabled: boolean;
}) {
  const [state, action, pending] = useActionState<AdminActionState, FormData>(
    updateAiSettings,
    {},
  );
  const [enabled, setEnabled] = useState(settings.enabled);
  const [count, setCount] = useState(settings.daily_book_count);

  // 권당 대략 $0.1~0.15 (claude-haiku-4-5 기준, 챕터 5~9개).
  const monthlyLow = (count * 0.1 * 30).toFixed(0);
  const monthlyHigh = (count * 0.15 * 30).toFixed(0);
  const willRun = enabled && count > 0 && apiEnabled;

  return (
    <form
      action={action}
      className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7"
    >
      {/* 켬/끔 */}
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--brand,#6366f1)]"
        />
        <span>
          <span className="block text-[15px] font-semibold text-foreground">
            매일 자동으로 서적 초안 생성
          </span>
          <span className="block text-sm text-muted">
            매일 cron 이 Claude 에게 학습 수요가 높을 만한 주제를 제안받아 초안을 만듭니다.
            <strong className="text-muted-strong"> 생성물은 항상 초안이며, 관리자가 검수·승인해야만 발행됩니다.</strong>
          </span>
        </span>
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="daily_book_count">하루 생성 권수</Label>
          <Select
            id="daily_book_count"
            name="daily_book_count"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            disabled={!enabled}
          >
            {COUNTS.map((n) => (
              <option key={n} value={n}>
                {n === 0 ? "0권 (생성 안 함)" : `${n}권`}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="language">언어</Label>
          <Select
            id="language"
            name="language"
            defaultValue={settings.language}
            disabled={!enabled}
          >
            {BOOK_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_LABEL[lang] ?? lang}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* 비용 경고 — 켜져 있고 권수가 1 이상일 때만 */}
      {enabled && count > 0 && (
        <div
          className={cn(
            "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm",
            apiEnabled
              ? "border-accent-amber/30 bg-accent-amber/10 text-accent-amber"
              : "border-white/12 bg-white/[0.03] text-muted",
          )}
        >
          {apiEnabled ? (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} />
          ) : (
            <Sparkles className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} />
          )}
          <span>
            {apiEnabled ? (
              <>
                유료 Claude API 를 <strong>매일</strong> 호출합니다. 하루 {count}권 기준
                <strong> 월 약 ${monthlyLow}~${monthlyHigh}</strong> 가 청구됩니다.
              </>
            ) : (
              <>
                <code className="rounded bg-white/[0.06] px-1 py-0.5 text-xs">
                  ANTHROPIC_API_KEY
                </code>{" "}
                가 설정되지 않아 <strong>실제로는 생성되지 않습니다</strong>. 설정만 저장되며,
                키를 넣는 즉시 다음 cron 부터 동작합니다.
              </>
            )}
          </span>
        </div>
      )}

      {state.ok && (
        <p role="status" className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-300">
          저장되었습니다. {willRun ? "다음 cron 부터 적용됩니다." : "현재는 자동 생성이 동작하지 않습니다."}
        </p>
      )}
      {state.error && (
        <p role="alert" className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-300">
          {errorText(state.error, ERR)}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          설정 저장
        </Button>
      </div>
    </form>
  );
}
