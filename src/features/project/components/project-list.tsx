import {
  toProjectCardPreview,
  type ProjectListFilter,
  type ProjectOrganizationOption,
  type ProjectSummary,
} from '@/features/project/domain/project';
import { TextLink } from '@/shared/components/text-link';
import { cn } from '@/lib/utils';
import { formatPeriod } from '@/shared/domain/period';
import { SITE_STATUSES, SITE_STATUS_LABELS } from '@/shared/domain/site-status';
import { PROJECT_KINDS, PROJECT_KIND_LABELS } from '@/shared/domain/project-kind';
import { routes } from '@/shared/routes';

/** オーナーの実績の一覧（`/dash/projects`）の部品 */

const MASKED_LABELS = { true: '秘匿化する', false: '秘匿化しない' } as const;

/** 1 つの条件を radio で選ぶ。選んでいる値はブラウザ標準の checked で示し、見た目は付けない */
const RadioGroup = ({
  legend,
  name,
  current,
  options,
}: {
  legend: string;
  name: string;
  current: string;
  options: { value: string; label: string }[];
}) => (
  <fieldset>
    <legend>{legend}</legend>
    {[{ value: '', label: 'すべて' }, ...options].map(({ value, label }) => (
      <label key={value} className="mr-4">
        <input type="radio" name={name} value={value} defaultChecked={value === current} /> {label}
      </label>
    ))}
  </fieldset>
);

/** 選んでいる条件の言葉。件数の横に出す */
export const describeProjectListFilter = (
  filter: ProjectListFilter,
  organizations: ProjectOrganizationOption[],
): string[] =>
  [
    filter.kind && PROJECT_KIND_LABELS[filter.kind],
    filter.organizationUid && organizations.find((o) => o.uid === filter.organizationUid)?.name,
    filter.status && SITE_STATUS_LABELS[filter.status],
    filter.isMasked !== null && MASKED_LABELS[`${filter.isMasked}`],
  ].filter((text): text is string => typeof text === 'string');

/**
 * 絞り込みの欄。HTML 標準の GET の form で、4 つの条件をまとめて選び、「絞り込む」で 1 回だけ移る。
 * 選んだだけでは移らない（WCAG 2.2 SC 3.2.2）。部品の見た目は付けず、ブラウザ標準のままにする。
 * 空の値（すべて）は、読む側が条件なしとして扱う
 */
export const ProjectListFilters = ({
  filter,
  organizations,
}: {
  filter: ProjectListFilter;
  organizations: ProjectOrganizationOption[];
}) => (
  <form method="get" action={routes.dash.projects.list} className="flex flex-col gap-4">
    <RadioGroup
      legend="種類"
      name="kind"
      current={filter.kind ?? ''}
      options={PROJECT_KINDS.map((kind) => ({ value: kind, label: PROJECT_KIND_LABELS[kind] }))}
    />
    <fieldset>
      <legend>組織</legend>
      {/* Tailwind の preflight が消した、ブラウザ標準の見た目に戻す */}
      <select
        name="org"
        aria-label="組織"
        className="[all:revert]"
        defaultValue={filter.organizationUid ?? ''}
      >
        <option value="">すべて</option>
        {organizations.map(({ uid, name }) => (
          <option key={uid} value={uid}>
            {name}
          </option>
        ))}
      </select>
    </fieldset>
    <RadioGroup
      legend="サイトに載せるか"
      name="status"
      current={filter.status ?? ''}
      options={SITE_STATUSES.map((s) => ({ value: s, label: SITE_STATUS_LABELS[s] }))}
    />
    <RadioGroup
      legend="秘匿化するか"
      name="masked"
      current={filter.isMasked === null ? '' : String(filter.isMasked)}
      options={[
        { value: 'true', label: MASKED_LABELS.true },
        { value: 'false', label: MASKED_LABELS.false },
      ]}
    />
    <p>
      <button type="submit" className="[all:revert]">
        絞り込む
      </button>
    </p>
  </form>
);

/**
 * サイトに載せるか・秘匿化するかの札。言葉で伝え、色だけに頼らない（WCAG 2.2 SC 1.4.1、
 * https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html）。「載せる」「秘匿化する」は
 * 塗った札、「載せない」「秘匿化しない」は点線の枠の札にし、形でも分ける
 */
const StateBadge = ({ on, children }: { on: boolean; children: string }) => (
  <span
    className={cn(
      'rounded-sm border px-2 py-0.5 text-xs',
      on
        ? 'border-foreground bg-foreground text-background'
        : 'border-dashed border-muted-foreground text-muted-foreground',
    )}
  >
    {children}
  </span>
);

export const ProjectListCard = ({ project }: { project: ProjectSummary }) => {
  const { excerpt, imageKey } = toProjectCardPreview(project);
  return (
    <li className="relative flex flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
      {/* 画像の枠の高さを先に決め、読み込みの後に要素の位置をずらさない（design/guidelines.md の
          Loading）。画像は飾りとして出し、中身の説明は題と本文が持つ */}
      <div className="aspect-video bg-muted">
        {imageKey && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={routes.dash.projects.media(project.uid, imageKey)}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        )}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <p className="flex flex-wrap gap-2">
          <StateBadge on={project.status === 'published'}>
            {SITE_STATUS_LABELS[project.status]}
          </StateBadge>
          <StateBadge on={project.isMasked}>{MASKED_LABELS[`${project.isMasked}`]}</StateBadge>
        </p>
        <p className="text-sm text-muted-foreground">
          {PROJECT_KIND_LABELS[project.kind]}・{formatPeriod(project.period)}
        </p>
        {/* 題のリンクの ::after をカード全体に広げ、カードのどこを押しても開く。
            リンクの名前は題だけのまま */}
        <h2 className="font-bold">
          <TextLink
            href={routes.dash.projects.row(project.uid)}
            className="after:absolute after:inset-0"
          >
            {project.title}
          </TextLink>
        </h2>
        <p className="text-sm text-muted-foreground">{project.organizationName}</p>
        {excerpt && <p className="line-clamp-3 text-sm">{excerpt}</p>}
      </div>
    </li>
  );
};
