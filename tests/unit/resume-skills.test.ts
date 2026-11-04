import { describe, expect, it } from 'vitest';
import { listResumeSkills } from '@/features/resume/domain/resume-skills';
import type { CalendarDate } from '@/shared/domain/period';

/**
 * 職務経歴書のスキルの一覧と経験年数（specs/002-resume/spec.md の FR-026〜FR-028、
 * research.md の R12）。数え方は 001 の FR-033（tests/unit/period-experience.test.ts）と同じ
 */

const NOW = new Date('2026-11-04T00:00:00.000Z');

const project = (skills: string[], startedOn: string, endedOn: string | null = null) => ({
  skills,
  period: { startedOn: startedOn as CalendarDate, endedOn: endedOn as CalendarDate | null },
});

describe('スキルの一覧（FR-026）', () => {
  it('写した実績のスキルの名前を集め、同じ名前を 1 つにまとめる', () => {
    const skills = listResumeSkills(
      [
        project(['TypeScript', 'Go'], '2024-01-01', '2024-12-31'),
        project(['Go'], '2025-01-01', '2025-06-30'),
      ],
      [],
      NOW,
    );
    expect(skills.map((s) => s.name).sort()).toEqual(['Go', 'TypeScript']);
  });

  it('大文字と小文字が違う名前は別のスキルにする（plan.md の U11 の仮の形）', () => {
    const skills = listResumeSkills([project(['go', 'Go'], '2024-01-01', '2024-01-31')], [], NOW);
    expect(skills.map((s) => s.name).sort()).toEqual(['Go', 'go']);
  });

  it('経験の長い順に並べる', () => {
    const skills = listResumeSkills(
      [project(['A'], '2024-01-01', '2024-01-31'), project(['B'], '2020-01-01', '2020-12-31')],
      [],
      NOW,
    );
    expect(skills.map((s) => s.name)).toEqual(['B', 'A']);
  });
});

describe('経験年数（FR-027・FR-028）', () => {
  it('写した実績の期間をつなぎ、重なる月を 1 回だけ数える', () => {
    const [go] = listResumeSkills(
      [project(['Go'], '2024-01-01', '2024-06-30'), project(['Go'], '2024-04-01', '2024-12-31')],
      [],
      NOW,
    );
    expect(go).toEqual({ name: 'Go', months: 12 });
  });

  it('終わりの日が空の実績は、求める日の月（日本時間）までを数える', () => {
    const [go] = listResumeSkills([project(['Go'], '2026-01-01')], [], NOW);
    expect(go.months).toBe(11);
  });

  it('写した上書きがあれば、求めた値の代わりに使う', () => {
    const [go] = listResumeSkills(
      [project(['Go'], '2024-01-01', '2024-01-31')],
      [{ skillName: 'Go', months: 71 }],
      NOW,
    );
    expect(go).toEqual({ name: 'Go', months: 71 });
  });

  it('写した実績につながっていない上書きは出さない', () => {
    expect(listResumeSkills([], [{ skillName: 'Go', months: 71 }], NOW)).toEqual([]);
  });
});
