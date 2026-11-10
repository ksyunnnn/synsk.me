// 花壇（A〜D の 4 列）を右から左へ出す順を、正しい順と、中ほどだけが遅れる順で並べる
import Link from 'next/link';

import { DelayReveal } from './DelayReveal';
import { routes } from '@/shared/routes';

type Column = 'A' | 'B' | 'C' | 'D';

const COLUMNS: Column[] = ['A', 'B', 'C', 'D'];
const EXPECTED: Column[] = ['D', 'C', 'B', 'A'];
const DELAYED: Column[] = ['D', 'A', 'C', 'B'];

const COLUMN_WIDTH = 50;
const HEIGHT = 80;
const STREAKS = [8, 18, 26, 38, 47, 58, 66, 74];

const Bed = ({ shown }: { shown: Column[] }) => (
  <svg
    viewBox={`0 0 ${COLUMN_WIDTH * COLUMNS.length} ${HEIGHT + 20}`}
    className="w-full"
    role="img"
    aria-label={`出ている列: ${shown.length ? shown.join('・') : 'なし'}`}
  >
    {COLUMNS.map((column, index) => {
      const x = index * COLUMN_WIDTH;
      const isShown = shown.includes(column);
      return (
        <g key={column}>
          {isShown ? (
            <rect
              x={x}
              y={0}
              width={COLUMN_WIDTH}
              height={HEIGHT}
              className="fill-muted-foreground"
            />
          ) : (
            STREAKS.map((y) => (
              <line
                key={y}
                x1={x}
                x2={x + COLUMN_WIDTH}
                y1={y}
                y2={y}
                className="stroke-border"
                strokeWidth={3}
              />
            ))
          )}
          <text
            x={x + COLUMN_WIDTH / 2}
            y={HEIGHT + 15}
            textAnchor="middle"
            className="fill-foreground text-[11px]"
          >
            {column}
          </text>
        </g>
      );
    })}
    <rect
      x={0}
      y={0}
      width={COLUMN_WIDTH * COLUMNS.length}
      height={HEIGHT}
      fill="none"
      className="stroke-foreground"
    />
  </svg>
);

// 三段の段。A が左端、B と C が段の境目、D が右端。各地点は隣の地点との中間までを受け持つ
const STEP_WIDTH = 100;
const STEP_HEIGHT = 30;
const STAIRS_WIDTH = STEP_WIDTH * 3;
const STAIRS_HEIGHT = STEP_HEIGHT * 3;
const POINTS: { point: Column; x: number; from: number; to: number }[] = [
  { point: 'A', x: 0, from: 0, to: 50 },
  { point: 'B', x: 100, from: 50, to: 150 },
  { point: 'C', x: 200, from: 150, to: 250 },
  { point: 'D', x: 300, from: 250, to: 300 },
];
const STAIRS = `M0 ${STAIRS_HEIGHT} V${STAIRS_HEIGHT - STEP_HEIGHT} H100 V${STAIRS_HEIGHT - STEP_HEIGHT * 2} H200 V0 H${STAIRS_WIDTH} V${STAIRS_HEIGHT} Z`;
const STAIRS_STREAKS = Array.from({ length: 11 }, (_, index) => 4 + index * 8);

const Stairs = ({ id, shown }: { id: string; shown: Column[] }) => (
  <svg
    viewBox={`-10 -6 ${STAIRS_WIDTH + 20} ${STAIRS_HEIGHT + 32}`}
    className="w-full"
    role="img"
    aria-label={`出ている地点: ${shown.length ? shown.join('・') : 'なし'}`}
  >
    <clipPath id={id}>
      <path d={STAIRS} />
    </clipPath>
    <g clipPath={`url(#${id})`}>
      {POINTS.map(({ point, from, to }) =>
        shown.includes(point) ? (
          <rect
            key={point}
            x={from}
            y={0}
            width={to - from}
            height={STAIRS_HEIGHT}
            className="fill-muted-foreground"
          />
        ) : (
          STAIRS_STREAKS.map((y) => (
            <line
              key={`${point}-${y}`}
              x1={from}
              x2={to}
              y1={y}
              y2={y}
              className="stroke-border"
              strokeWidth={3}
            />
          ))
        ),
      )}
    </g>
    <path d={STAIRS} fill="none" className="stroke-foreground" />
    {POINTS.map(({ point, x }) => (
      <g key={point}>
        <circle
          cx={x}
          cy={STAIRS_HEIGHT}
          r={3.5}
          className={
            shown.includes(point) ? 'fill-foreground' : 'fill-background stroke-foreground'
          }
        />
        <text
          x={x}
          y={STAIRS_HEIGHT + 20}
          textAnchor="middle"
          className="fill-foreground text-[12px]"
        >
          {point}
        </text>
      </g>
    ))}
  </svg>
);

// 出た地点の範囲だけを、左右の順を保ったまま右に詰めて描く。まだ出ていない範囲は幅を持たない
const stepTop = (x: number) => STAIRS_HEIGHT - STEP_HEIGHT * (x < 100 ? 1 : x < 200 ? 2 : 3);

const slicePath = (from: number, to: number, dx: number) => {
  const xs = [from, ...[100, 200].filter((edge) => edge > from && edge < to), to];
  const top = xs.slice(0, -1).flatMap((x, index) => {
    const y = stepTop(x);
    return [`${x + dx} ${y}`, `${xs[index + 1] + dx} ${y}`];
  });
  return `M${from + dx} ${STAIRS_HEIGHT} L${top.join(' L')} L${to + dx} ${STAIRS_HEIGHT} Z`;
};

const PackedStairs = ({ shown }: { shown: Column[] }) => {
  const slices = POINTS.filter(({ point }) => shown.includes(point));
  const packedWidth = slices.reduce((sum, { from, to }) => sum + to - from, 0);
  // 各範囲の左端は、詰めた先頭の位置に、それより前の範囲の幅を足したもの
  const placed = slices.map((slice, index) => {
    const before = slices.slice(0, index).reduce((sum, { from, to }) => sum + to - from, 0);
    const left = STAIRS_WIDTH - packedWidth + before;
    return { ...slice, dx: left - slice.from };
  });
  return (
    <svg
      viewBox={`-10 -6 ${STAIRS_WIDTH + 20} ${STAIRS_HEIGHT + 32}`}
      className="w-full"
      role="img"
      aria-label={`右に詰めて出ている地点: ${shown.join('・')}`}
    >
      {placed.map(({ point, from, to, dx }) => (
        <path
          key={point}
          d={slicePath(from, to, dx)}
          className="fill-muted-foreground stroke-foreground"
        />
      ))}
      {placed.map(({ point, x, dx }) => (
        <g key={point}>
          <circle cx={x + dx} cy={STAIRS_HEIGHT} r={3.5} className="fill-foreground" />
          <text
            x={x + dx}
            y={STAIRS_HEIGHT + 20}
            textAnchor="middle"
            className="fill-foreground text-[12px]"
          >
            {point}
          </text>
        </g>
      ))}
    </svg>
  );
};

// もとの映像をほぼ再現できた節に付ける目印
const FinalMark = () => (
  <span className="shrink-0 rounded-full bg-foreground px-2.5 py-0.5 text-xs font-semibold text-background">
    最終版
  </span>
);

// 写真を A〜D の 4 本の縦の帯に分け、出た帯だけを左右の順を保ったまま右に詰める
const PHOTO_URL = 'https://picsum.photos/id/20/900/900';

const PackedPhoto = ({ shown }: { shown: Column[] }) => (
  <div
    className="flex aspect-square w-full justify-end"
    role="img"
    aria-label={`右に詰めて出ている帯: ${shown.join('・')}`}
  >
    {COLUMNS.filter((column) => shown.includes(column)).map((column) => (
      <div
        key={column}
        className="h-full w-1/4"
        style={{
          backgroundImage: `url(${PHOTO_URL})`,
          backgroundSize: '400% 100%',
          backgroundPosition: `${(COLUMNS.indexOf(column) / (COLUMNS.length - 1)) * 100}% 0`,
        }}
      />
    ))}
  </div>
);

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
