import type { MetadataRoute } from "next";
import { SITE_URL, NOINDEX } from "@/lib/site";
import { getTopics } from "@/lib/wiki/topics-db";
import { getPublishedSitemapUrls } from "@/lib/wiki/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 색인 차단(임시 운영) 상태에서는 빈 사이트맵을 반환해 조기 색인을 막는다.
  if (NOINDEX) return [];

  // 발행·검증된 서적/챕터만 등록(초안·검수중·보관은 제외). 서로 독립적이라 병렬로 읽는다.
  const [bookUrls, topics] = await Promise.all([
    getPublishedSitemapUrls(),
    getTopics(),
  ]);
  const topicEntries: MetadataRoute.Sitemap = topics.map(({ slug }) => ({
    url: `${SITE_URL}/topic/${slug}`,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  const contentEntries: MetadataRoute.Sitemap = bookUrls.map(({ path, lastmod }) => ({
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
