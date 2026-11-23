import { describe, expect, it } from 'vitest';
import { toDraft } from '@/shared/components/drafts';
import { RETURN_QUERY_FIELD } from '@/shared/domain/search-param';

/**
 * 直しかけの値の作り方（`src/shared/components/drafts.tsx` の `toDraft`）。直しかけかどうかは、
 * 開いたときと今の値をこの形で比べて決める
 */
describe('直しかけの値', () => {
  it('同じ名前の値は `,` でつなぎ、ファイルは含めない', () => {
    const formData = new FormData();
    formData.append('title', '題');
    formData.append('skillIds', '1');
    formData.append('skillIds', '2');
    formData.append('file', new Blob(['x']));
    expect(toDraft(formData)).toEqual({ title: '題', skillIds: '1,2' });
  });

  it('一覧の検索の値は含めない。見せ方を切り替えただけで直しかけにしない', () => {
    const table = new FormData();
    table.append('title', '題');
    table.append(RETURN_QUERY_FIELD, 'selected=u1');
    const timeline = new FormData();
    timeline.append('title', '題');
    timeline.append(RETURN_QUERY_FIELD, 'view=timeline&selected=u1');
    expect(toDraft(timeline)).toEqual({ title: '題' });
    expect(toDraft(timeline)).toEqual(toDraft(table));
  });
});
