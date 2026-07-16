import "server-only";
import { headers } from "next/headers";

/**
 * 인메모리 슬라이딩 윈도 레이트리밋(best-effort).
 *
 * 용도: 비로그인 사용자가 유발하는 **유료 외부 API 호출**(Claude 채점) 남용 억제.
 * 서버리스라 인스턴스마다 카운터가 따로 놀지만, 인스턴스 수는 유한하므로
 * "무제한 호출" 은 확실히 막힌다. 로그인 사용자에 대한 정확한 제한은 DB 트리거가
 * 담당한다(0008: quiz_attempts_rate_limit) — 이건 그 위의 저비용 1차 방어선.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5000; // 메모리 상한(초과 시 만료된 것부터 정리)

function prune(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size > MAX_KEYS) {
    // 그래도 넘치면 가장 오래된 것부터 버린다(삽입 순서 = Map 순회 순서).
    const excess = buckets.size - MAX_KEYS;
    let i = 0;
    for (const key of buckets.keys()) {
      if (i++ >= excess) break;
      buckets.delete(key);
    }
  }
}

/** 윈도 내 허용 횟수를 넘었으면 false. */
export function consume(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  prune(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/**
 * 프록시 뒤(Vercel)에서의 클라이언트 IP. 없으면 "unknown" 으로 합쳐서 제한.
 *
 * ⚠️ `x-forwarded-for` 의 **첫** 항목을 믿으면 안 된다. 이 헤더는 프록시가 뒤에 덧붙이는
 * 구조라 클라이언트가 미리 채워 보낸 값이 앞에 남는다. 즉 `X-Forwarded-For: 1.2.3.4` 를
 * 매 요청 다르게 보내면 IP 별 레이트리밋이 통째로 우회된다(유료 채점 리미터 포함).
 *
 * Vercel 이 직접 세팅해 신뢰할 수 있는 `x-real-ip` 를 먼저 보고, 없을 때만 XFF 의
 * **마지막** 항목(=가장 바깥 프록시가 관찰한 실제 peer)으로 폴백한다.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const real = h.get("x-real-ip");
  if (real) return real.trim();

  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1]!;
  }
  return "unknown";
}
