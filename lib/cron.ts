import "server-only";

/**
 * Vercel Cron 요청 검증.
 *
 * Vercel 은 CRON_SECRET 이 설정돼 있으면 `Authorization: Bearer <secret>` 를 붙여 호출한다.
 * 운영에서 시크릿이 비어 있으면 **거부**한다(fail-closed): 예전엔 미설정 시 통과여서,
 * env 를 빠뜨리면 누구나 /api/ai/generate 를 호출해 큐를 비우고 Claude 비용을 태울 수 있었다.
 * 로컬(dev)에서는 시크릿 없이도 호출할 수 있게 둔다.
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
