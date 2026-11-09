import {
  FEED_PROJECT_KIND_LABELS,
  type CareerFeedItem,
  type FeedItem,
  type NoteFeedItem,
  type ProjectFeedItem,
} from '@/features/activity/domain/feed';
import type { Period } from '@/shared/domain/period';

/**
 * 訪問者に見せる一覧（specs/005-feed/contracts/visitor-feed.md）。受け取った DTO の値だけを
 * 描画する。秘匿化した職歴・実績の DTO は、本文・関連 URL・画像を持たない。秘匿化した行は、
 * 本文の場所に「非公開」と出す（001 の spec の FR-021）。
 *
 * 並べる値と見せ方は、UI を考えるときに決める（plan.md の U7）。ここでは契約の最小の値だけを出す
 */

const PeriodText = ({ period }: { period: Period }) => (
  <>
    <time dateTime={period.startedOn}>{period.startedOn}</time>
    {' 〜 '}
    {period.endedOn && <time dateTime={period.endedOn}>{period.endedOn}</time>}
  </>
);

const MaskedBody = () => <p>非公開</p>;

const CareerRow = ({ item }: { item: CareerFeedItem }) => (
  <article className="flex flex-col gap-1">
    <p className="text-sm text-muted-foreground">職歴</p>
    <h2 className="font-bold">{item.organizationName}</h2>
    <p>{item.role}</p>
    <p className="text-sm text-muted-foreground">
      <PeriodText period={item.period} />
    </p>
    {item.isMasked && <MaskedBody />}
  </article>
);

const ProjectRow = ({ item }: { item: ProjectFeedItem }) => (
  <article className="flex flex-col gap-1">
    <p className="text-sm text-muted-foreground">{FEED_PROJECT_KIND_LABELS[item.projectKind]}</p>
    <h2 className="font-bold">{item.title}</h2>
    <p>{item.organizationName}</p>
    <p className="text-sm text-muted-foreground">
      <PeriodText period={item.period} />
    </p>
    {item.isMasked && <MaskedBody />}
  </article>
);

/**
 * note。個別のページへのリンクは付けない（plan.md の U4）。作成日時は、日の境目の時刻帯が
 * 決まるまで（plan.md の U3）保存した値のまま出す
 */
const NoteRow = ({ item }: { item: NoteFeedItem }) => (
  <article className="flex flex-col gap-1">
    <p className="text-sm text-muted-foreground">note</p>
    <h2 className="font-bold">{item.title}</h2>
    {item.description && <p>{item.description}</p>}
    <p className="text-sm text-muted-foreground">
      <time dateTime={item.createdAt}>{item.createdAt}</time>
    </p>
  </article>
);

const FeedRow = ({ item }: { item: FeedItem }) => {
  switch (item.type) {
    case 'career':
      return <CareerRow item={item} />;
    case 'project':
      return <ProjectRow item={item} />;
    case 'note':
      return <NoteRow item={item} />;
  }
};

export const Feed = ({ items }: { items: FeedItem[] }) =>
  items.length === 0 ? (
    <p>まだ何もない</p>
  ) : (
    <ol className="flex flex-col gap-6">
      {items.map((item, index) => (
        // 主キーを応答に出さないため、key は並びの位置で付ける（research.md の R6）
        <li key={index}>
          <FeedRow item={item} />
        </li>
      ))}
    </ol>
  );
