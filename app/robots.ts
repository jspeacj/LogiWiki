import type { MetadataRoute } from "next";
import { ORIGIN, SITE_URL, NOINDEX } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // 임시 *.vercel.app 운영 동안 전체 색인 차단. 승인 후 NEXT_PUBLIC_NOINDEX=false 로 해제.
  if (NOINDEX) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: ORIGIN,
  };
}
