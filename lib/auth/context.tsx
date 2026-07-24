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
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRef | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Supabase 클라이언트를 **첫 화면 번들에서 빼내** 마운트 후에 받아온다.
   *
   * 왜: 이 Provider 는 루트 레이아웃에 있어 모든 페이지가 거친다. 정적 import 였을 때
   * supabase-js 가 첫 화면 청크에 들어가 **56KB**를 차지했고, 그 안에는 이 앱이 쓰지 않는
   * realtime-js 까지 포함돼 있었다(supabase-js v2 가 무조건 끌고 온다). 서적·챕터 열람은
   * 로그인 없이 되는 게 기본이라 대부분의 방문이 이 비용을 헛되이 냈다.
   *
   * 지연 로딩이 안전한 이유: 이 컨텍스트는 **표시용**이다(헤더 로그인 UI·작성 폼 분기).
   * 실제 쓰기 권한은 서버 액션 + RLS 가 강제하므로 세션이 조금 늦게 반영돼도 보안 경계와
   * 무관하다. 원래도 `loading: true` 로 시작해 세션을 비동기로 읽었으므로 초기 렌더 계약도 같다.
   *
   * env 미설정이면 import 는 되지만 createClient 가 throw → 로그아웃 상태로 degrade.
   */
  useEffect(() => {
    let active = true;
    void import("@/lib/supabase/client")
      .then(({ createClient }) => {
        if (!active) return;
        try {
          setSupabase(createClient());
        } catch {
          setSupabase(null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
    // 아직 클라이언트를 받아오는 중이면 아무것도 하지 않는다 — loading 을 여기서 끄면
    // "로딩 중" 과 "사용 불가(env 미설정)" 가 구분되지 않아 헤더가 잠깐 로그아웃으로 깜빡인다.
    if (!supabase) return;
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
