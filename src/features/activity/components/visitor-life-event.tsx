import type { VisitorLifeEvent } from '@/features/activity/domain/life-event';

/**
 * 訪問者に見せる life event（specs/004-external-activity/contracts/visitor-life-event.md）。
 * 受け取った DTO の値だけを描画する。説明は改行を保つ文字だけで見せる（plan.md の「spec が
 * 決めないものの扱い」）。代表画像は R2 の原本を変換せずに出す（U5 の決定）
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
    {lifeEvent.cardImageUrl && (
      // 画像は R2 の原本を変換せずに返す（U5 の決定）。next/image の変換を通さない。画像の説明の文は
      // 持たない（spec が決めていない）ので、見出しと同じ内容を読み上げさせない
      // eslint-disable-next-line @next/next/no-img-element
      <img src={lifeEvent.cardImageUrl} alt="" className="w-full rounded-md" />
    )}
    {lifeEvent.description && <p className="whitespace-pre-line">{lifeEvent.description}</p>}
  </article>
);
