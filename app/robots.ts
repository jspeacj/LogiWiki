import type { MetadataRoute } from "next";
import { ORIGIN, SITE_URL, NOINDEX } from "@/lib/site";

/**
 * ⚠️ 이 파일은 **크롤러가 읽지 않는 위치**에 발행된다. 방어 수단으로 신뢰하지 말 것.
 *
 * metadata route 는 basePath 를 그대로 따라가므로 결과물은 `.../wiki/robots.txt` 다.
 * 그런데 robots.txt 규약상 크롤러는 **오리진 루트**(`https://logikitapps.com/robots.txt`)
 * 하나만 읽는다. 즉 여기서 무엇을 반환하든 색인 동작에는 영향이 없다:
 *
 *  - NOINDEX 시의 `disallow: "/"` 는 **동작하지 않는다.** 임시 *.vercel.app 배포의 실질
 *    색인 차단은 전적으로 app/layout.tsx 의 `<meta name="robots" content="noindex">`
 *    (lib/site.ts 의 NOINDEX 게이트, 기본값이 안전측)가 담당한다. AGENTS.md 가 말하는
 *    "3중 강제" 중 이 층은 실효가 없으므로, 저 meta 태그를 절대 제거하지 말 것.
 *  - `sitemap`/`host` 선언도 마찬가지로 전달되지 않는다. 승인 후 sitemap 은 메인 도메인의
 *    루트 robots.txt 에 적거나 Search Console 에 직접 제출해야 한다.
 *  - 같은 이유로 `ads.txt` 도 이 zone 에서 서빙할 수 없다 — `logikitapps.com/ads.txt`
 *    (메인 repo)가 소유해야 한다. AdSense 는 루트 ads.txt 만 조회한다.
 *
 * 그래도 파일을 남겨두는 이유: 오리진 루트 robots.txt 를 작성할 때 이 zone 이 무엇을
 * 의도하는지에 대한 SSOT 이고, 승인 후 메인 repo 로 옮겨 적을 원본이기 때문이다.
 */
export default function robots(): MetadataRoute.Robots {
  if (NOINDEX) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // 색인 가치가 없는 경로는 크롤 예산에서 뺀다(각 페이지의 noindex 와 별개 층).
      disallow: ["/admin", "/admin/", "/api/", "/account", "/favorites"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: ORIGIN,
  };
}
