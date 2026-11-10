import {
  type CareerFeedItem,
  type ExternalActivityFeedItem,
  type ExternalActivitySourceKind,
  type FeedItem,
  type LifeEventFeedItem,
  type NoteFeedItem,
  type ProjectFeedItem,
  toTokyoCalendarDate,
} from '@/features/activity/domain/feed';
import { PeriodText } from '@/shared/components/period-text';
import { PROJECT_KIND_LABELS } from '@/shared/domain/project-kind';

/**
 * 訪問者に見せる一覧（specs/005-feed/contracts/visitor-feed.md）。受け取った DTO の値だけを
 * 描画する。秘匿化した職歴・実績の DTO は、本文・関連 URL・画像を持たない。秘匿化した行は、
 * 本文の場所に「非公開」と出す（001 の spec の FR-021）。
 *
 * 並べる値と見せ方は、UI を考えるときに決める（plan.md の U7）。ここでは契約の最小の値だけを出す
 */

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
    <p className="text-sm text-muted-foreground">{PROJECT_KIND_LABELS[item.projectKind]}</p>
    <h2 className="font-bold">{item.title}</h2>
    <p>{item.organizationName}</p>
    <p className="text-sm text-muted-foreground">
      <PeriodText period={item.period} />
    </p>
    {item.isMasked && <MaskedBody />}
  </article>
);

/**
 * note。個別のページへのリンクは付けない（plan.md の U4）。作成日時は日本時間の暦の日付で出す。
 * 並びの日の境目（plan.md の U3）とは別に決めた、表示だけの形
 */
const NoteRow = ({ item }: { item: NoteFeedItem }) => (
  <article className="flex flex-col gap-1">
    <p className="text-sm text-muted-foreground">note</p>
    <h2 className="font-bold">{item.title}</h2>
    {item.description && <p>{item.description}</p>}
    <p className="text-sm text-muted-foreground">
      <time dateTime={item.createdAt}>{toTokyoCalendarDate(item.createdAt)}</time>
    </p>
  </article>
);

const SOURCE_KIND_LABELS: Record<ExternalActivitySourceKind, string> = {
  article: '記事',
  embed: '埋め込み',
  other: 'その他',
};

/**
 * 外部の activity。取得元の URL へ `<a>` で直接リンクする（FR-020）。`src/shared/components/text-link.tsx`
 * は管理画面の移動のための `next/link` なので使わない。見せ方は分類で分ける（FR-019）。埋め込みの
 * 見せ方は取得元で決めることになるが、決まるまで（plan.md の U7）は取得元の名前を添えたリンクで
 * 出す。代表の画像は出さない（plan.md の U5）
 */
const ExternalActivityRow = ({ item }: { item: ExternalActivityFeedItem }) => (
  <article className="flex flex-col gap-1">
    <p className="text-sm text-muted-foreground">
      {SOURCE_KIND_LABELS[item.sourceKind]}・{item.source}
    </p>
    <h2 className="font-bold">
      <a
        href={item.url}
        rel="noopener noreferrer"
        className="underline underline-offset-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {item.title ?? item.url}
      </a>
    </h2>
    <p className="text-sm text-muted-foreground">
      <time dateTime={item.publishedAt}>{toTokyoCalendarDate(item.publishedAt)}</time>
    </p>
  </article>
);

/** life event。個別のページへのリンクは付けない（plan.md の U4） */
const LifeEventRow = ({ item }: { item: LifeEventFeedItem }) => (
  <article className="flex flex-col gap-1">
    <p className="text-sm text-muted-foreground">life event</p>
    <h2 className="font-bold">{item.title}</h2>
    {item.description && <p>{item.description}</p>}
    <p className="text-sm text-muted-foreground">
      <time dateTime={item.happenedOn}>{item.happenedOn}</time>
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
    case 'external_activity':
      return <ExternalActivityRow item={item} />;
    case 'life_event':
      return <LifeEventRow item={item} />;
  }
};

const linkClassName =
  'w-fit underline underline-offset-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/** 番号のページへのリンクの行き先。1 ページ目は問い合わせを付けない。主キーを含めない（ADR-0048） */
const pageHref = (basePath: string, page: number) =>
  page === 1 ? basePath : `${basePath}?page=${page}`;

type FeedProps = {
  items: FeedItem[];
  /** 表示しているページの番号（1 から数える） */
  page: number;
  hasNextPage: boolean;
  /** 一覧の画面の経路。ページ送りのリンクの行き先に使う */
  basePath: string;
};

/**
 * 一覧とページ送り（research.md の R8）。ページ送りは JavaScript なしでも移れるよう `<a>` で作る。
 * 2 ページ目より先で 0 件のときは、最後のページの先なので「まだ何もない」を出さず、1 ページ目への
 * リンクを出す
 */
export const Feed = ({ items, page, hasNextPage, basePath }: FeedProps) => {
  if (items.length === 0) {
    return page === 1 ? (
      <p>まだ何もない</p>
    ) : (
      <a href={pageHref(basePath, 1)} className={linkClassName}>
        1 ページ目へ
      </a>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-col gap-6">
        {items.map((item, index) => (
          // 主キーを応答に出さないため、key は並びの位置で付ける（research.md の R6）
          <li key={index}>
            <FeedRow item={item} />
          </li>
        ))}
      </ol>
      {hasNextPage && (
        <a href={pageHref(basePath, page + 1)} className={linkClassName}>
          次のページ
        </a>
      )}
    </div>
  );
};
