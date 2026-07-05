"use client";

import { Badge } from "@/components/ui/badge";
import {
  CATEGORY_LABEL,
  CATEGORY_STYLE,
  type Category,
} from "@/lib/community/types";

export function CategoryBadge({ category }: { category: Category }) {
  return (
    <Badge className={CATEGORY_STYLE[category]}>
      {CATEGORY_LABEL[category]}
    </Badge>
  );
}
