import type { FeedItem } from '@/features/activity/domain/feed';
import { routes } from '@/shared/routes';

/**
 * トップの線の間に置く、一覧の activity の題の並び。題を「, 」でつなぐ。行き先は一覧
 * （feed.tsx）と同じで、職歴は個別のページを持たないのでリンクしない。外部の activity は別のタブで
 * 開く。リンクの色は design/foundations.pen に無い（アクセントカラーが未定）ため、文字の色のまま
 * 下線で示す
 */
const linkOf = (item: FeedItem): { href: string; isExternal: boolean } | null => {
  switch (item.type) {
    case 'career':
      return null;
    case 'project':
      return { href: routes.project(item.slug), isExternal: false };
    case 'note':
      return { href: routes.note(item.slug), isExternal: false };
    case 'external_activity':
      return { href: item.url, isExternal: true };
    case 'life_event':
      return { href: routes.lifeEvent(item.slug), isExternal: false };
  }
};

const titleOf = (item: FeedItem): string => {
  switch (item.type) {
    case 'career':
      return item.organizationName;
    case 'external_activity':
      return item.title ?? item.url;
    default:
      return item.title;
  }
};

export const ActivityLinks = ({ items }: { items: FeedItem[] }) => (
  <p className="break-words">
    {items.map((item, index) => {
      const link = linkOf(item);
      return (
        <span key={index}>
          {index > 0 && ', '}
          {link === null ? (
            titleOf(item)
          ) : (
            <a
              href={link.href}
              {...(link.isExternal && { target: '_blank', rel: 'noopener noreferrer' })}
              className="underline underline-offset-2"
            >
              {titleOf(item)}
            </a>
          )}
        </span>
      );
    })}
  </p>
);
