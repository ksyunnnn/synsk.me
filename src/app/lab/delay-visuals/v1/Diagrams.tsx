// v1 のページが並べる図。花壇・段・写真を、出た列だけ描く

type Column = 'A' | 'B' | 'C' | 'D';

const COLUMNS: Column[] = ['A', 'B', 'C', 'D'];
export const EXPECTED: Column[] = ['D', 'C', 'B', 'A'];
export const DELAYED: Column[] = ['D', 'A', 'C', 'B'];

const COLUMN_WIDTH = 50;
const HEIGHT = 80;
const STREAKS = [8, 18, 26, 38, 47, 58, 66, 74];

export const Bed = ({ shown }: { shown: Column[] }) => (
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

export const Stairs = ({ id, shown }: { id: string; shown: Column[] }) => (
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

export const PackedStairs = ({ shown }: { shown: Column[] }) => {
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
export const FinalMark = () => (
  <span className="shrink-0 rounded-full bg-foreground px-2.5 py-0.5 text-xs font-semibold text-background">
    最終版
  </span>
);

// 写真を A〜D の 4 本の縦の帯に分け、出た帯だけを左右の順を保ったまま右に詰める
const PHOTO_URL = 'https://picsum.photos/id/20/900/900';

export const PackedPhoto = ({ shown }: { shown: Column[] }) => (
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
