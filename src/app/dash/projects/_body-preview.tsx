'use client';

import { ToggleGroup } from '@base-ui/react/toggle-group';
import { Toggle } from '@base-ui/react/toggle';
import { useState } from 'react';
import { MarkdownText } from '@/features/resume/components/visitor-resume';
import { fontFamily, sourceSans } from '@/lib/fonts';
import { MarkdownBody } from '@/shared/components/markdown-body';
import { VIEW_SWITCH, viewSwitchItem } from '@/shared/components/split-view';
import type { MediaStorageKey } from '@/shared/domain/media';

/**
 * 実績の本文のプレビュー。保存していない本文を、訪問者に見せる 2 つの場所の見え方で描く。
 * 見え方は画面を移らずに切り替える。見た目は一覧のツールバーの `ViewSwitch` にそろえ、操作は
 * Base UI の ToggleGroup に任せる（HIG Segmented controls）。
 *
 * - 実績のページ: 訪問者の実績のページ（/projects/{slug}）の本文と同じ部品・同じ幅
 *   （main の `max-w-2xl px-4`）
 * - 職務経歴書: 職務経歴書の実績の本文の部品（`MarkdownText`）。列の幅・書体・地は、
 *   /dash/resumes/{id}/preview の実績の本文の列で 2026-11-24 に測った値（幅 478.9375px、
 *   Source Sans 3 と Noto Sans JP の 300、文字の色 #242424、地 #fafafa に紙の粒子を multiply）
 *
 * features をまたぐため、組み立ては app に置く（ADR-0026 の依存の向き）
 */

type View = 'project' | 'resume';

const VIEWS: { value: View; label: string }[] = [
  { value: 'project', label: '実績のページ' },
  { value: 'resume', label: '職務経歴書' },
];

/** 職務経歴書の実績の本文の列の幅（実測） */
const RESUME_COLUMN_WIDTH = 'w-[478.9375px]';

export const ProjectBodyPreview = ({
  body,
  mediaSrc,
}: {
  body: string;
  mediaSrc: (storageKey: MediaStorageKey) => string | null;
}) => {
  const [view, setView] = useState<View>('project');

  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup
        aria-label="プレビューの見え方"
        value={[view]}
        onValueChange={(values) => {
          const next = values[0] as View | undefined;
          // 選んでいる見え方をもう一度押しても、選んだままにする
          if (next) setView(next);
        }}
        className={`${VIEW_SWITCH} self-start`}
      >
        {VIEWS.map((option) => (
          <Toggle
            key={option.value}
            value={option.value}
            className={viewSwitchItem(view === option.value)}
          >
            {option.label}
          </Toggle>
        ))}
      </ToggleGroup>
      <div className="overflow-x-auto rounded-xl border border-border">
        {view === 'project' ? (
          <div className="mx-auto w-full max-w-2xl px-4 py-6">
            <section className="flex flex-col gap-2">
              <h2 className="text-caption text-muted-foreground">本文</h2>
              <MarkdownBody body={body} mediaSrc={mediaSrc} />
            </section>
          </div>
        ) : (
          <div
            className={`bg-[#fafafa] bg-blend-multiply px-6 py-6 font-light text-[#242424] ${sourceSans.className}`}
            style={{ fontFamily, backgroundImage: "url('/resume-paper-grain.png')" }}
          >
            <div className={`mx-auto ${RESUME_COLUMN_WIDTH} [overflow-wrap:anywhere]`}>
              <MarkdownText text={body} mediaSrc={mediaSrc} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
