"use client";

/**
 * 클라이언트 인증 컨텍스트.
 *
 * 브라우저 Supabase 클라이언트의 세션을 구독해 로그인 상태와 프로필(닉네임)을 노출한다.
 * 헤더의 로그인/로그아웃 UI, 작성 폼의 권한 분기 등 클라이언트 표시용으로만 쓴다.
 * (실제 쓰기 권한은 서버 액션 + RLS 가 최종 검증한다.)
 *
 * Supabase env 미설정 시엔 클라이언트 생성을 건너뛰고 로그아웃 상태로 degrade 한다
 * → 로컬에서 Supabase 없이도 앱이 정상 렌더된다.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isAdminEmail } from "@/lib/auth/admin";
import type { ProfileRef } from "@/lib/auth/types";

type AuthValue = {
  user: User | null;
  profile: ProfileRef | null;
  /** 관리자 계정 여부(표시 분기용 — 실제 권한은 서버/RLS 강제). */
  isAdmin: boolean;
  loading: boolean;
  /** 프로필(닉네임 등) 재조회 — 개인정보 수정 후 헤더 즉시 갱신용. */
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // 클라이언트는 컴포넌트 생애주기 동안 한 번만 생성(lazy initializer).
  // env 미설정 시 createClient 가 throw → null 로 두고 로그아웃 상태로 동작.
  const [supabase] = useState<SupabaseClient | null>(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  });
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRef | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(
    async (uid: string | undefined) => {
      if (!supabase || !uid) {
        setProfile(null);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url")
        .eq("id", uid)
        .maybeSingle();
      setProfile(data ?? null);
    },
    [supabase],
  );

  useEffect(() => {
    if (!supabase) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    let active = true;

    // 표시용 초기 상태는 getSession()으로 로컬(쿠키/스토리지)에서 즉시 읽는다.
    // getUser()는 매 로드마다 Auth 서버 왕복이 발생해 불필요 — 실제 권한은 서버/RLS가 강제.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(data.session?.user ?? null);
      void loadProfile(data.session?.user?.id).finally(() => {
        if (active) setLoading(false);
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      void loadProfile(session?.user?.id);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, loadProfile]);

  const refreshProfile = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    setUser(data.user);
    await loadProfile(data.user?.id);
  }, [supabase, loadProfile]);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, [supabase]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      profile,
      isAdmin: isAdminEmail(user?.email),
      loading,
      refreshProfile,
      signOut,
    }),
    [user, profile, loading, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
