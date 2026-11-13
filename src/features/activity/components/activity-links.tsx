import type { FeedItem } from '@/features/activity/domain/feed';
import { routes } from '@/shared/routes';

/**
 * トップの線の間に置く、一覧の activity の題の並び。題を「, 」でつなぐ。行き先は一覧
 * （feed.tsx）と同じで、職歴は個別のページを持たないのでリンクしない。リンクは下線と
 * ブラウザのリンク色（CSS のシステムカラー LinkText）で出す
 */
const hrefOf = (item: FeedItem): string | null => {
  switch (item.type) {
    case 'career':
      return null;
    case 'project':
      return routes.project(item.slug);
    case 'note':
      return routes.note(item.slug);
    case 'external_activity':
      return item.url;
    case 'life_event':
      return routes.lifeEvent(item.slug);
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
  <p>
    {items.map((item, index) => {
      const href = hrefOf(item);
      return (
        <span key={index}>
          {index > 0 && ', '}
          {href === null ? (
            titleOf(item)
          ) : (
            <a
              href={href}
              rel={item.type === 'external_activity' ? 'noopener noreferrer' : undefined}
              className="text-[color:LinkText] underline underline-offset-2"
            >
              {titleOf(item)}
            </a>
          )}
        </span>
      );
    })}
  </p>
);
