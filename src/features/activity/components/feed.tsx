import type { ReactNode } from 'react';
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
import { routes } from '@/shared/routes';

/**
 * 訪問者に見せる一覧（specs/005-feed/contracts/visitor-feed.md）。受け取った DTO の値だけを
 * 描画する。秘匿化した職歴・実績の DTO は、本文・関連 URL・画像を持たない。秘匿化した行は、
 * 本文の場所に「非公開」と出す（001 の spec の FR-021）。
 *
 * 並べる値と見せ方は、UI を考えるときに決める（plan.md の U7）。ここでは契約の最小の値だけを出す。
 * 実績・note・life event の題は個別のページへリンクする（plan.md の U4）。職歴は個別のページを
 * 持たないのでリンクしない
 */

/**
 * 代表画像（plan.md の U5）。見せ方は仮のもので、デザインを決めるときに直す。画像は R2 の原本か
 * 取得元の画像を変換せずに出す。next/image の変換を通さない。大きさを箱で決め、読み込んだ後に
 * 要素の位置をずらさない（design/guidelines.md の Loading）。中身の説明は隣の題が持つので、
 * 読み上げさせない。取得元の画像のサーバへは、一覧のページの URL を送らない
 */
const FeedImage = ({ src, isExternal = false }: { src: string; isExternal?: boolean }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img
    src={src}
    alt=""
    width={128}
    height={128}
    loading="lazy"
    decoding="async"
    referrerPolicy={isExternal ? 'no-referrer' : undefined}
    className="aspect-square w-32 rounded-md object-cover"
  />
);

const MaskedBody = () => <p>非公開</p>;

const titleLinkClassName =
  'underline underline-offset-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/**
 * 題を、個別のページか取得元へのリンクにする。`src/shared/components/text-link.tsx` は管理画面の
 * 移動のための `next/link` なので使わず、ページ送りと同じく JavaScript なしでも移れる `<a>` で作る
 */
const TitleLink = ({
  href,
  rel,
  children,
}: {
  href: string;
  rel?: string;
  children: ReactNode;
}) => (
  <h2 className="font-bold">
    <a href={href} rel={rel} className={titleLinkClassName}>
      {children}
    </a>
  </h2>
);

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
    {item.imageUrl && <FeedImage src={item.imageUrl} />}
    <p className="text-sm text-muted-foreground">{PROJECT_KIND_LABELS[item.projectKind]}</p>
    {/* 秘匿化した実績も個別のページを持つ（001 の spec の Edge Cases） */}
    <TitleLink href={routes.project(item.slug)}>{item.title}</TitleLink>
    <p>{item.organizationName}</p>
    <p className="text-sm text-muted-foreground">
      <PeriodText period={item.period} />
    </p>
    {item.isMasked && <MaskedBody />}
  </article>
);

/**
 * note。題は個別のページへリンクする（plan.md の U4）。作成日時は日本時間の暦の日付で出す。
 * 並びの日の境目（plan.md の U3）とは別に決めた、表示だけの形
 */
const NoteRow = ({ item }: { item: NoteFeedItem }) => (
  <article className="flex flex-col gap-1">
    {item.imageUrl && <FeedImage src={item.imageUrl} />}
    <p className="text-sm text-muted-foreground">note</p>
    <TitleLink href={routes.note(item.slug)}>{item.title}</TitleLink>
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
 * 外部の activity。取得元の URL へ直接リンクする（FR-020）。見せ方は分類で分ける（FR-019）。埋め込みの
 * 見せ方は取得元で決めることになるが、決まるまで（plan.md の U7）は取得元の名前を添えたリンクで
 * 出す
 */
const ExternalActivityRow = ({ item }: { item: ExternalActivityFeedItem }) => (
  <article className="flex flex-col gap-1">
    {item.imageUrl && <FeedImage src={item.imageUrl} isExternal />}
    <p className="text-sm text-muted-foreground">
      {SOURCE_KIND_LABELS[item.sourceKind]}・{item.source}
    </p>
    <TitleLink href={item.url} rel="noopener noreferrer">
      {item.title ?? item.url}
    </TitleLink>
    <p className="text-sm text-muted-foreground">
      <time dateTime={item.publishedAt}>{toTokyoCalendarDate(item.publishedAt)}</time>
    </p>
  </article>
);

/** life event。題は個別のページへリンクする（plan.md の U4） */
const LifeEventRow = ({ item }: { item: LifeEventFeedItem }) => (
  <article className="flex flex-col gap-1">
    {item.imageUrl && <FeedImage src={item.imageUrl} />}
    <p className="text-sm text-muted-foreground">life event</p>
    <TitleLink href={routes.lifeEvent(item.slug)}>{item.title}</TitleLink>
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
