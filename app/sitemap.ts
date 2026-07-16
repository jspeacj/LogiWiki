import type { MetadataRoute } from "next";
import { SITE_URL, NOINDEX } from "@/lib/site";
import { getSitemapData } from "@/lib/wiki/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 색인 차단(임시 운영) 상태에서는 빈 사이트맵을 반환해 조기 색인을 막는다.
  if (NOINDEX) return [];

  // 발행·검증된 서적/챕터 + 그 서적이 실제로 존재하는 토픽만 등록한다.
  // (빈 토픽 페이지를 제출하지 않는 이유는 getSitemapData 주석 참고.)
  const { urls, topics } = await getSitemapData();

  const topicEntries: MetadataRoute.Sitemap = topics.map(({ path, lastmod }) => ({
    url: `${SITE_URL}/${path}`,
    lastModified: lastmod,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const contentEntries: MetadataRoute.Sitemap = urls.map(({ path, lastmod }) => ({
    url: `${SITE_URL}/${path}`,
    lastModified: lastmod,
    changeFrequency: "weekly",
    priority: path.includes("/") ? 0.7 : 0.8,
  }));

  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/books`, changeFrequency: "daily", priority: 0.9 },
    // 정적 정보 페이지 — AdSense 심사가 존재를 확인하는 페이지들.
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE_URL}/contact`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    ...topicEntries,
    ...contentEntries,
  ];
}
