import type { VisitorLifeEvent } from '@/features/activity/domain/life-event';

/**
 * 訪問者に見せる life event（specs/004-external-activity/contracts/visitor-life-event.md）。
 * 受け取った DTO の値だけを描画する。説明は改行を保つ文字だけで見せる（plan.md の「spec が
 * 決めないものの扱い」）。代表画像は、配る経路を作るまで出さない（tasks.md の T071）
 */
export const VisitorLifeEventView = ({ lifeEvent }: { lifeEvent: VisitorLifeEvent }) => (
  <article className="flex flex-col gap-6">
    <header className="flex flex-col gap-2">
      {/* 題は空でありうる（plan.md の「spec が決めないものの扱い」）。見出しを欠かさないよう、空なら起きた日を見出しにする */}
      <h1 className="text-3xl font-bold">
        {lifeEvent.title ?? <time dateTime={lifeEvent.happenedOn}>{lifeEvent.happenedOn}</time>}
      </h1>
      {lifeEvent.title && (
        <p className="text-muted-foreground">
          <time dateTime={lifeEvent.happenedOn}>{lifeEvent.happenedOn}</time>
        </p>
      )}
    </header>
    {lifeEvent.description && <p className="whitespace-pre-line">{lifeEvent.description}</p>}
  </article>
);
