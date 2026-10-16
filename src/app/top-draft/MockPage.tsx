import type { Metadata } from 'next';
import Link from 'next/link';

// トップの下書きから飛ぶ先のモック。マージすると本番で開けるため、検索結果に出さない
export const mockMetadata = (title: string): Metadata => ({
  title: `${title}（モック） | synsk.me`,
  robots: { index: false, follow: false },
});

// 行き先があることだけを示し、中身は持たない
export const MockPage = ({ title, note }: { title: string; note?: string }) => (
  <main className="mx-auto grid max-w-[480px] gap-6 px-6 pt-16 pb-24 font-light">
    <span className="w-fit rounded-sm border border-muted-foreground px-1 text-[10px] leading-4 text-muted-foreground">
      モック
    </span>
    <h1 className="text-lg font-semibold">{title}</h1>
    {note && <p className="text-sm text-muted-foreground">{note}</p>}
    <div className="grid min-h-[240px] place-items-center rounded-xl border-[1.5px] border-dashed border-muted-foreground text-sm text-muted-foreground">
      中身は未定
    </div>
    <Link href="/top-draft" className="w-fit font-normal underline underline-offset-4">
      ← トップの下書きへ戻る
    </Link>
  </main>
);
