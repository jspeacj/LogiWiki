/**
 * LogiKit Apps 형제 플랫폼 목록 (교차 유입용 SSOT).
 *
 * 헤더 앱 런처(app switcher)와 푸터 링크가 이 목록을 공유한다.
 * - `wiki`(현재 zone)만 내부 경로("/")라 `<Link>`(basePath 자동)로, 나머지는
 *   절대 URL 이라 `<a>`(basePath 미적용)로 렌더한다.
 * - 표시 이름·설명은 여기에 직접 둔다(Phase 1 은 UI i18n 미적용 — 한국어 우선).
 */

import { ORIGIN } from "./site";

export type PlatformKey = "hub" | "wiki" | "conv" | "text" | "time" | "calc" | "fuel" | "pet";

export interface Platform {
  key: PlatformKey;
  name: string;
  desc: string;
  /** 이동 URL. 내부 경로는 "/" 로 시작, 외부는 절대 URL. */
  href: string;
  /** true 면 절대 URL 외부 링크(`<a>`), false/undefined 면 내부(`<Link>`). */
  external?: boolean;
  /** 현재 이 zone 인지 — 런처에서 '현재' 배지 + 강조. */
  current?: boolean;
}

export const PLATFORMS: Platform[] = [
  { key: "hub", name: "LogiKit Apps", desc: "1인 개발 도구 모음 허브", href: ORIGIN, external: true },
  // ⚠️ 공개 문구에 생성 방식(AI 등)을 넣지 말 것 — 이 desc 는 헤더 앱 런처와 푸터를 통해
  // **모든 페이지**에 렌더된다(AGENTS.md: 공개 화면에 "AI" 를 노출하지 않는다).
  { key: "wiki", name: "LogiWiki", desc: "IT 학습 서적 & 코딩 퀴즈", href: "/", current: true },
  { key: "conv", name: "Converter", desc: "단위·포맷 변환기 모음", href: `${ORIGIN}/conv`, external: true },
  { key: "text", name: "TextKit", desc: "텍스트 처리 도구 모음", href: `${ORIGIN}/text`, external: true },
  { key: "time", name: "Timezone Scheduler", desc: "글로벌 시차·회의시간 조율", href: `${ORIGIN}/time`, external: true },
  { key: "calc", name: "Calculator Hub", desc: "다양한 계산기 모음", href: `${ORIGIN}/calc`, external: true },
  // 형제 zone 문구는 실제 기능과 맞춘다 — 유가는 "실시간" 이 아니라 일 단위 고시/스냅샷이다
  // (허브 카드가 같은 이유로 교정된 적이 있다).
  { key: "fuel", name: "Fuel Tracker", desc: "전국·해외 유가 트래커", href: `${ORIGIN}/fuel`, external: true },
  { key: "pet", name: "PawLog", desc: "반려동물 계산기 & 품종 가이드", href: `${ORIGIN}/pet`, external: true },
];
