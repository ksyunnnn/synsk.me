'use client';

import { useEffect, useState } from 'react';
import { CasualTimeline } from './variants/CasualTimeline';
import { CatnoseTimeline } from './variants/CatnoseTimeline';
import { ChicTimeline } from './variants/ChicTimeline';
import { EmbedTimeline } from './variants/EmbedTimeline';
import { PrinciplesTimeline } from './variants/PrinciplesTimeline';
import { RichTimeline } from './variants/RichTimeline';
import {
  TIMELINE_VARIANTS,
  VARIANT_LABEL,
  type TimelineVariant,
  type YearGroup,
} from './variants/types';

const VARIANT_COMPONENT = {
  casual: CasualTimeline,
  chic: ChicTimeline,
  catnose: CatnoseTimeline,
  rich: RichTimeline,
  principles: PrinciplesTimeline,
  embed: EmbedTimeline,
};

/**
 * 3 案を切り替えて見比べる。
 *
 * ADR-0016 は絞り込みを URL へ書き込まないと決めているため、初期値だけを
 * クエリから受け取り、切り替えでは URL を書き換えない。
 *
 * `.dark` を付け外しする仕組みがサイトに無いので、比較用にここで付け外しする。
 * 付ける先は `<html>` に限る。`globals.css` の `--color-background` は
 * `hsl(var(--background))` を `@theme`（= `:root`）で確定させるため、
 * 入れ子の要素へ `.dark` を当てても変数が差し替わらない。
 */
export const TimelineLab = ({
  groups,
  now,
  initialVariant,
}: {
  groups: YearGroup[];
  now: number;
  initialVariant: TimelineVariant;
}) => {
  const [variant, setVariant] = useState<TimelineVariant>(initialVariant);
  const [dark, setDark] = useState(false);
  const Variant = VARIANT_COMPONENT[variant];

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    return () => root.classList.remove('dark');
  }, [dark]);

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="EntryUI の案" className="flex gap-2">
          {TIMELINE_VARIANTS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => setVariant(candidate)}
              aria-pressed={variant === candidate}
              className={`rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none ${
                variant === candidate
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {VARIANT_LABEL[candidate]}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setDark((current) => !current)}
          aria-pressed={dark}
          className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none"
        >
          {dark ? 'Light' : 'Dark'}
        </button>
      </div>

      <div className="rounded-2xl bg-background px-6 py-10 text-foreground">
        <Variant groups={groups} now={now} />
      </div>
    </>
  );
};
