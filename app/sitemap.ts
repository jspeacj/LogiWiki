import type { MetadataRoute } from "next";
import { SITE_URL, NOINDEX } from "@/lib/site";
import { TOPIC_SLUGS } from "@/lib/wiki/topics";
import { getPublishedSitemapUrls } from "@/lib/wiki/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 색인 차단(임시 운영) 상태에서는 빈 사이트맵을 반환해 조기 색인을 막는다.
  if (NOINDEX) return [];

  // 발행·검증된 서적/챕터만 등록(초안·검수중·보관은 제외).
  const bookUrls = await getPublishedSitemapUrls();

  const topicEntries: MetadataRoute.Sitemap = TOPIC_SLUGS.map((slug) => ({
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
    ...topicEntries,
    ...contentEntries,
  ];
}
