// v1 の最終版（帯ごとに追いつく）を縦にしたもの。写真を上から下へ出す
import Link from 'next/link';

import { VerticalReveal } from './VerticalReveal';

const Page = () => (
  <main className="mx-auto grid max-w-[640px] gap-10 px-6 py-16">
    <div className="grid gap-2">
      <Link
        href="/lab/delay-visuals"
        className="w-fit text-sm text-muted-foreground underline underline-offset-4"
      >
        delay-visuals
      </Link>
      <h1 className="text-lg font-semibold">v2 縦</h1>
      <p className="text-sm text-muted-foreground">
        v1
        の最終版を縦にした。縦長の写真を上から下へ出す。赤の表示の境目は下へ進み、その下は境目の行の色を下へ伸ばす。青の内側の境目より上は動かず、その下の帯は、赤の境目が入るとき上にずれた位置から始まり、次の青線に届くまでに下へ動いて揃う。
      </p>
    </div>

    <section className="grid gap-4">
      <div className="grid gap-2">
        <h2 className="font-semibold">机の写真</h2>
        <p className="text-sm text-muted-foreground">
          写真は picsum の id 20（Aleks Dorohovich）。中央を縦長に切り取る。
        </p>
      </div>
      <VerticalReveal photos={[{ url: 'https://picsum.photos/id/20/1200/1200', x: 0.5, y: 0 }]} />
    </section>

    <section className="grid gap-4">
      <div className="grid gap-2">
        <h2 className="font-semibold">丘の写真</h2>
        <p className="text-sm text-muted-foreground">
          写真は picsum の id 46（Jeffrey Kam）。中央を縦長に切り取る。
        </p>
      </div>
      <VerticalReveal photos={[{ url: 'https://picsum.photos/id/46/1200/1200', x: 0.5, y: 0 }]} />
    </section>

    <section className="grid gap-4">
      <div className="grid gap-2">
        <h2 className="font-semibold">3 枚を並べる</h2>
        <p className="text-sm text-muted-foreground">
          3
          枚の写真をそれぞれ縦長に切り取って横に並べ、再生・コマ・設定を共有して同時に動かす。写真は左から
          picsum の id 75（Jassy Onyae）、81（Sander Weeteling）、77（May Pamintuan）。75 と 81
          は中央、77 は 1.3 倍に拡大して下寄せで切り取る。
        </p>
      </div>
      <VerticalReveal
        photos={[
          { url: 'https://picsum.photos/id/75/1000/1500', x: 0.5, y: 0.5 },
          { url: 'https://picsum.photos/id/81/1500/975', x: 0.5, y: 0.5 },
          { url: 'https://picsum.photos/id/77/1500/1013', x: 0.5, y: 1, zoom: 1.3 },
        ]}
      />
    </section>
  </main>
);

export default Page;
