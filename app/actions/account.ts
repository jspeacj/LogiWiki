"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/actions";
import { isAdminEmail } from "@/lib/auth/admin";
import { isNicknameTaken } from "@/lib/auth/nickname";
import {
  hasReservedNickname,
  NICKNAME_MAX,
  NICKNAME_MIN,
} from "@/lib/auth/validators";

export type AccountState = {
  ok?: boolean;
  nickname?: string;
  error?: string;
};

/**
 * 닉네임 변경(개인정보 수정).
 * - 길이/예약어(브랜드·역할 사칭=어드민 전용) 검증
 * - 대소문자 무시 중복 검사(본인 제외) + DB 유니크 인덱스로 경쟁 상황 최종 차단
 * - RLS(profiles_update_own) + DB 트리거(enforce_profile_nickname)로 최종 강제
 */
export async function updateNickname(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const session = await requireUser();
  if (!session) return { error: "UNAUTHENTICATED" };
  const { supabase, user } = session;

  const nickname = String(formData.get("nickname") ?? "").trim();

  if (nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) {
    return { error: "INVALID" };
  }
  if (hasReservedNickname(nickname) && !isAdminEmail(user.email)) {
    return { error: "RESERVED" };
  }
  if (await isNicknameTaken(supabase, nickname, user.id)) {
    return { error: "TAKEN" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ nickname })
    .eq("id", user.id);

  if (error) {
    // 23505 = unique_violation: 검사 통과 후 동시 가입/변경으로 선점된 경우.
    if (error.code === "23505") return { error: "TAKEN" };
    return { error: "WRITE_FAILED" };
  }

  revalidatePath("/account");
  revalidatePath("/community");
  return { ok: true, nickname };
}
