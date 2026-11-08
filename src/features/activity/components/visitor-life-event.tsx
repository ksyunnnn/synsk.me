import { paragraphsOf, type VisitorLifeEvent } from '@/features/activity/domain/life-event';

/**
 * 訪問者に見せる life event（specs/004-external-activity/contracts/visitor-life-event.md）。
 * 受け取った DTO の値だけを描画する。見た目は 001 の実績のページ
 * （src/features/project/components/visitor-project.tsx）と同じ部品と余白にする
 * （research.md の R10）。代表画像は、画像の仕組みができてから出す（plan.md の U10）
 */
export const VisitorLifeEventView = ({ lifeEvent }: { lifeEvent: VisitorLifeEvent }) => {
  const paragraphs = paragraphsOf(lifeEvent.description);
  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          <time dateTime={lifeEvent.happenedOn}>{lifeEvent.happenedOn}</time>
        </p>
        <h1 className="text-3xl font-bold">{lifeEvent.title}</h1>
      </header>
      {paragraphs.length > 0 && (
        <div className="flex flex-col gap-4">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="whitespace-pre-line">
              {paragraph}
            </p>
          ))}
        </div>
      )}
    </article>
  );
};
