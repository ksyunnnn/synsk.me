// 花壇（A〜D の 4 列）を右から左へ出す順を、正しい順と、中ほどだけが遅れる順で並べる
import Link from 'next/link';

import { DelayReveal } from './DelayReveal';
import { Bed, DELAYED, EXPECTED, FinalMark, PackedPhoto, PackedStairs, Stairs } from './Diagrams';
import { routes } from '@/shared/routes';

const Page = () => (
  <main className="mx-auto grid max-w-[640px] gap-10 px-6 py-16">
    <div className="grid gap-2">
      <Link
        href={routes.labPage('delay-visuals')}
        className="w-fit text-sm text-muted-foreground underline underline-offset-4"
      >
        delay-visuals
      </Link>
      <h1 className="text-lg font-semibold">v1 コマ送り</h1>
      <p className="text-sm text-muted-foreground">
        灰色の花壇を左端 A から右端 D までの 4
        列に分けた。花壇は右から左へ出る。塗った列が出ている列、横の筋がまだ出ていない列。
      </p>
    </div>

    <div className="grid grid-cols-2 gap-4 text-sm font-semibold">
      <p>正しい順（D→C→B→A）</p>
      <p>見える順（D→A→C→B）</p>
    </div>

    {EXPECTED.map((_, index) => (
      <section key={index} className="grid gap-2 border-b border-border pb-8 last:border-b-0">
        <h2 className="text-sm text-muted-foreground tabular-nums">コマ {index + 1}</h2>
        <div className="grid grid-cols-2 gap-4">
          <Bed shown={EXPECTED.slice(0, index + 1)} />
          <Bed shown={DELAYED.slice(0, index + 1)} />
        </div>
      </section>
    ))}

    <div className="grid gap-2 pt-10">
      <h2 className="font-semibold">三段の段</h2>
      <p className="text-sm text-muted-foreground">
        同じ順を三段の段で描いた。A が左端、B と C が段の境目、D
        が右端。塗った範囲と黒い点が出ている地点、横の筋と白い点がまだ出ていない地点。
      </p>
    </div>

    <div className="grid grid-cols-2 gap-4 text-sm font-semibold">
      <p>正しい順（D→C→B→A）</p>
      <p>見える順（D→A→C→B）</p>
    </div>

    {EXPECTED.map((_, index) => (
      <section key={index} className="grid gap-2 border-b border-border pb-8 last:border-b-0">
        <h3 className="text-sm text-muted-foreground tabular-nums">コマ {index + 1}</h3>
        <div className="grid grid-cols-2 gap-4">
          <Stairs id={`stairs-expected-${index}`} shown={EXPECTED.slice(0, index + 1)} />
          <Stairs id={`stairs-delayed-${index}`} shown={DELAYED.slice(0, index + 1)} />
        </div>
      </section>
    ))}

    <div className="grid gap-2 pt-10">
      <h2 className="font-semibold">三段の段を右に詰める</h2>
      <p className="text-sm text-muted-foreground">
        まだ出ていない範囲は幅を持たず、出た範囲だけが左右の順を保ったまま右に詰まる。正しい順では本物の階段の右側を切り取った形になり、見える順では階段そのものが歪む。
      </p>
    </div>

    <div className="grid grid-cols-2 gap-4 text-sm font-semibold">
      <p>正しい順（D→C→B→A）</p>
      <p>見える順（D→A→C→B）</p>
    </div>

    {EXPECTED.map((_, index) => (
      <section key={index} className="grid gap-2 border-b border-border pb-8 last:border-b-0">
        <h3 className="text-sm text-muted-foreground tabular-nums">コマ {index + 1}</h3>
        <div className="grid grid-cols-2 gap-4">
          <PackedStairs shown={EXPECTED.slice(0, index + 1)} />
          <PackedStairs shown={DELAYED.slice(0, index + 1)} />
        </div>
      </section>
    ))}

    <div className="grid gap-2 pt-10">
      <h2 className="font-semibold">写真を右に詰める</h2>
      <p className="text-sm text-muted-foreground">
        写真を左から A〜D の 4 本の縦の帯に分け、出た帯だけを右に詰めた。写真は picsum の id
        20（Aleks Dorohovich）。
      </p>
    </div>

    <div className="grid grid-cols-2 gap-4 text-sm font-semibold">
      <p>正しい順（D→C→B→A）</p>
      <p>見える順（D→A→C→B）</p>
    </div>

    {EXPECTED.map((_, index) => (
      <section key={index} className="grid gap-2 border-b border-border pb-8 last:border-b-0">
        <h3 className="text-sm text-muted-foreground tabular-nums">コマ {index + 1}</h3>
        <div className="grid grid-cols-2 gap-4">
          <PackedPhoto shown={EXPECTED.slice(0, index + 1)} />
          <PackedPhoto shown={DELAYED.slice(0, index + 1)} />
        </div>
      </section>
    ))}

    <div className="grid gap-2 pt-10">
      <h2 className="font-semibold">2 本の境目で再現する</h2>
      <p className="text-sm text-muted-foreground">
        横長の写真を右から左へ出す。赤の表示の境目は左へ進み、その左は境目の列の色を横に引き伸ばす。青の内側の境目は写真の上で動かず、その右はそのまま、左は時間とともに左へ引き伸ばされる。写真は
        picsum の id 20（Aleks Dorohovich）。
      </p>
    </div>

    <DelayReveal mode="stretch" />

    <div className="grid gap-2 pt-10">
      <h2 className="font-semibold">2 本の境目で再現する（ずれ）</h2>
      <p className="text-sm text-muted-foreground">
        上と同じく写真を右から左へ出す。青の内側の境目より右は 1 枚目の写真、左は同じ写真の 2
        枚目を左へずらして出す。ずれは時間とともに大きくなり、青のすぐ右の絵が青のすぐ左にもう一度出てくる。
      </p>
    </div>

    <DelayReveal mode="shift" />

    <div className="grid gap-2 pt-10">
      <h2 className="font-semibold">2 本の境目で再現する（ずれを繰り返す）</h2>
      <p className="text-sm text-muted-foreground">
        青の内側の境目を、いちばん右の境目から左端まで等しい間隔で何本も置く。境目を 1
        本左へ越えるごとに、写真がもう一段左へずれる。左端の帯でのずれの合計が、上の節のずれの最大と同じになる。
      </p>
    </div>

    <DelayReveal mode="repeat" />

    <div className="grid gap-2 pt-10">
      <h2 className="font-semibold">2 本の境目で再現する（帯ごとにずれが直る）</h2>
      <p className="text-sm text-muted-foreground">
        帯の置き方は上と同じ。赤の表示の境目が帯の中を通る間だけ、その帯がずれる。帯に入るときは
        0、真ん中で最大、次の青線に届いたときに 0 へ戻る。出し終えたときには 1 枚の写真に揃う。
      </p>
    </div>

    <DelayReveal mode="settle" />

    <div className="grid gap-2 pt-10">
      <h2 className="flex items-center gap-2 font-semibold">
        2 本の境目で再現する（帯ごとに左へ追いつく）
        <FinalMark />
      </h2>
      <p className="text-sm text-muted-foreground">
        帯の置き方は上と同じ。赤の表示の境目が帯に入るとき、その帯の絵は右にずれた位置から始まり、次の青線に届くまでに左へ動いて本来の位置に揃う。絵は左へ一方向にだけ動く。
      </p>
    </div>

    <DelayReveal mode="catchup" />

    <div className="grid gap-2 pt-10">
      <h2 className="flex items-center gap-2 font-semibold">
        2 本の境目で再現する（帯ごとに左へ追いつく・丘の写真）
        <FinalMark />
      </h2>
      <p className="text-sm text-muted-foreground">
        上と同じ動きを、丘の写真で試す。写真の高さの 48% から下を、3:1 の帯で切り取って使う。写真は
        picsum の id 46（Jeffrey Kam）。
      </p>
    </div>

    <DelayReveal
      mode="catchup"
      photo={{ url: 'https://picsum.photos/id/46/1800/1800', top: 0.48 }}
    />
  </main>
);

export default Page;
