import type { ReactNode } from 'react';
import {
  FEED_ITEM_TYPE_LABELS,
  FEED_PROJECT_KIND_LABELS,
  hostOf,
  type FeedItem,
  type FeedPage,
} from '@/features/activity/domain/feed';
import { isExternalSource, SOURCE_LABELS } from '@/features/activity/domain/source';
import type { Period } from '@/shared/domain/period';

/**
 * 訪問者の一覧（specs/005-feed/contracts/visitor-feed.md）。受け取った DTO の値だけを描画する。
 * 秘匿化した実績・職歴の DTO は、本文・関連 URL・画像を持たない。
 *
 * 実績と職歴の本文は、書式が決まるまで出さない。秘匿化したものだけ、本文の場所に「非公開」と
 * 出す（spec の FR-013、research.md の R9）。代表画像と埋め込みは読まない（R9・R10）
 */

const LINK =
  'underline-offset-4 hover:underline rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const PeriodText = ({ period }: { period: Period }) => (
  <>
    <time dateTime={period.startedOn}>{period.startedOn}</time>
    {' 〜 '}
    {period.endedOn && <time dateTime={period.endedOn}>{period.endedOn}</time>}
  </>
);

const Masked = () => <p className="text-sm text-muted-foreground">本文: 非公開</p>;

/** 種類の名前の横に出す言葉。外部の activity は取得元の名前、実績は実績の種類 */
const subLabelOf = (item: FeedItem): string | null => {
  if (item.type === 'external_activity')
    return isExternalSource(item.source) ? SOURCE_LABELS[item.source] : null;
  if (item.type === 'project') return FEED_PROJECT_KIND_LABELS[item.projectKind];
  return null;
};

const Title = ({
  href,
  external,
  children,
}: {
  href?: string;
  external?: boolean;
  children: ReactNode;
}) =>
  href ? (
    <a
      href={href}
      className={`text-lg font-bold ${LINK}`}
      {...(external ? { rel: 'noopener noreferrer' } : {})}
    >
      {children}
    </a>
  ) : (
    <span className="text-lg font-bold">{children}</span>
  );

const Body = ({ item }: { item: FeedItem }) => {
  switch (item.type) {
    case 'note':
      return (
        <>
          <Title href={`/notes/${item.slug}`}>{item.title}</Title>
          {item.description && <p className="text-muted-foreground">{item.description}</p>}
        </>
      );
    case 'external_activity':
      return (
        <Title href={item.url} external>
          {item.title ?? hostOf(item.url)}
        </Title>
      );
    case 'life_event':
      return <Title href={`/life-events/${item.slug}`}>{item.title}</Title>;
    case 'project':
      return (
        <>
          <Title href={`/projects/${item.slug}`}>{item.title}</Title>
          <p className="text-sm text-muted-foreground">
            {item.organizationName}・<PeriodText period={item.period} />
          </p>
          {item.skills.length > 0 && (
            <p className="text-sm text-muted-foreground">スキル: {item.skills.join('、')}</p>
          )}
          {item.isMasked && <Masked />}
        </>
      );
    case 'career':
      return (
        <>
          <Title>
            {item.organizationName}・{item.role}
          </Title>
          <p className="text-sm text-muted-foreground">
            <PeriodText period={item.period} />
          </p>
          {item.isMasked && <Masked />}
        </>
      );
  }
};

const FeedEntry = ({ item }: { item: FeedItem }) => {
  const subLabel = subLabelOf(item);
  return (
    <article
      className="flex flex-col gap-1"
      data-item-type={item.type}
      {...(item.type === 'external_activity' ? { 'data-source-kind': item.sourceKind } : {})}
    >
      <p className="text-sm text-muted-foreground">
        <time dateTime={item.date}>{item.date}</time>
        {'・'}
        {FEED_ITEM_TYPE_LABELS[item.type]}
        {subLabel && `・${subLabel}`}
      </p>
      <Body item={item} />
    </article>
  );
};

const pageHref = (page: number) => (page === 1 ? '/timeline' : `/timeline?page=${page}`);

export const Feed = ({ feed }: { feed: FeedPage }) => (
  <div className="flex flex-col gap-12">
    {feed.items.length === 0 ? (
      <div className="flex flex-col gap-4">
        <p>まだ何もありません。</p>
        {feed.page > 1 && (
          <p>
            <a href="/timeline" className={`underline ${LINK}`}>
              最初のページへ
            </a>
          </p>
        )}
      </div>
    ) : (
      <ol className="flex flex-col gap-10">
        {feed.items.map((item) => (
          <li key={`${item.type}-${item.id}`}>
            <FeedEntry item={item} />
          </li>
        ))}
      </ol>
    )}
    {(feed.page > 1 || feed.hasNext) && feed.items.length > 0 && (
      <nav aria-label="ページ" className="flex justify-between">
        {feed.page > 1 ? (
          <a href={pageHref(feed.page - 1)} className={`underline ${LINK}`}>
            新しいものへ
          </a>
        ) : (
          <span />
        )}
        {feed.hasNext && (
          <a href={pageHref(feed.page + 1)} className={`underline ${LINK}`}>
            古いものへ
          </a>
        )}
      </nav>
    )}
  </div>
);
