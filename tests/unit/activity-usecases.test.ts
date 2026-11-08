import { describe, expect, it, vi } from 'vitest';
import { deleteActivity, editActivity } from '@/features/activity/application/edit-activity';
import { registerActivity } from '@/features/activity/application/register-activity';
import {
  canDelete,
  editableFieldsOf,
  parseActivityRegistration,
  type ExternalActivity,
} from '@/features/activity/domain/activity';
import type { ActivityRepository } from '@/features/activity/domain/activity-repository';
import {
  calendarDateToPublishedAt,
  publishedAtToCalendarDate,
} from '@/features/activity/domain/date';
import { parseRegisteredUrl } from '@/features/activity/domain/source';
import type { CalendarDate } from '@/shared/domain/period';

/**
 * URL を指名して、または手で入力して外部の activity を登録・書き換え・削除する
 * （specs/004-external-activity/spec.md の User Story 4、FR-009〜FR-012・FR-021・FR-022・
 * FR-031・FR-033）。値はすべて作り物
 */

const OWNER = { email: 'owner@synsk.test' };
const UID = '0123456789abcdef0123456789abcdef';

const fakeActivities = (overrides: Partial<ActivityRepository> = {}): ActivityRepository => ({
  listStoredKeys: vi.fn(),
  applyFetch: vi.fn(),
  recordFetchResult: vi.fn(),
  listFetchResults: vi.fn(),
  list: vi.fn(),
  findForEdit: vi.fn(async () => null),
  findIdByUid: vi.fn(),
  register: vi.fn(async () => ({ ok: true as const, id: 1, uid: UID })),
  edit: vi.fn(async () => ({ ok: true as const })),
  delete: vi.fn(async () => ({ ok: true })),
  listRefreshTargets: vi.fn(),
  applyRefresh: vi.fn(),
  ...overrides,
});

const activity = (overrides: Partial<ExternalActivity> = {}): ExternalActivity => ({
  id: 1,
  uid: UID,
  source: 'codepen_pen',
  externalId: 'fakePen',
  url: 'https://codepen.io/ksyunnnn/pen/fakePen',
  title: '作り物の pen',
  publishedAt: '2026-01-01T15:00:00.000Z',
  imageUrl: null,
  createdAt: '2026-11-09T00:00:00.000Z',
  ...overrides,
});

describe('日付の読み替え（research.md の R9）', () => {
  it('暦の日付は日本時間の 0 時の UTC の日時になり、戻すと同じ日になる', () => {
    const publishedAt = calendarDateToPublishedAt('2026-01-02' as CalendarDate);
    expect(publishedAt).toBe('2026-01-01T15:00:00.000Z');
    expect(publishedAtToCalendarDate(publishedAt)).toBe('2026-01-02');
  });
});

describe('parseRegisteredUrl', () => {
  it.each([
    [
      'x_post',
      'https://twitter.com/ksyunnnn/status/123?s=20',
      'https://x.com/ksyunnnn/status/123',
      '123',
    ],
    [
      'spotify_playlist',
      'https://open.spotify.com/playlist/abc123?si=x',
      'https://open.spotify.com/playlist/abc123',
      'abc123',
    ],
    [
      'youtube_video',
      'https://youtu.be/fakeVideo01',
      'https://www.youtube.com/watch?v=fakeVideo01',
      'fakeVideo01',
    ],
    [
      'codesandbox_sandbox',
      'https://codesandbox.io/p/sandbox/fake-id',
      'https://codesandbox.io/s/fake-id',
      'fake-id',
    ],
    [
      'codepen_pen',
      'https://codepen.io/ksyunnnn/pen/fakePen',
      'https://codepen.io/ksyunnnn/pen/fakePen',
      'fakePen',
    ],
    ['unlisted', 'https://example.com/fake-article', 'https://example.com/fake-article', null],
  ] as const)('%s の %s を正規の URL と ID にする', (source, input, url, externalId) => {
    expect(parseRegisteredUrl(source, input)).toEqual({ url, externalId });
  });

  it.each([
    ['x_post', 'https://example.com/ksyunnnn/status/1'],
    ['spotify_playlist', 'https://open.spotify.com/album/abc'],
    ['codepen_pen', 'https://codepen.io/ksyunnnn'],
    ['unlisted', 'ftp://example.com/a'],
  ] as const)('%s に別の取得元の URL %s を拒む', (source, input) => {
    expect(parseRegisteredUrl(source, input)).toBeNull();
  });
});

describe('parseActivityRegistration', () => {
  it('日付が無ければ保存しない（FR-011）', () => {
    expect(
      parseActivityRegistration({
        source: 'x_post',
        url: 'https://x.com/a/status/1',
        title: '',
        publishedOn: '',
      }),
    ).toEqual({ ok: false, errors: { publishedOn: 'missing' } });
  });

  it('手で入力する取得元は題を必ず入れる。URL を指名する取得元は題を読まない', () => {
    expect(
      parseActivityRegistration({
        source: 'unlisted',
        url: 'https://example.com/a',
        title: ' ',
        publishedOn: '2026-01-01',
      }),
    ).toEqual({ ok: false, errors: { title: 'missing' } });
    expect(
      parseActivityRegistration({
        source: 'x_post',
        url: 'https://x.com/a/status/1',
        title: '入れても使わない',
        publishedOn: '2026-01-01',
      }),
    ).toMatchObject({ ok: true, registration: { mode: 'url' } });
  });

  it('一覧を取る取得元は登録できない', () => {
    expect(
      parseActivityRegistration({
        source: 'zenn_article',
        url: 'https://zenn.dev/a',
        title: 'a',
        publishedOn: '2026-01-01',
      }),
    ).toEqual({ ok: false, errors: { source: 'invalid' } });
  });
});

describe('registerActivity', () => {
  it('オーナーでなければ、外へ要求を出さず、何も書かない（FR-031）', async () => {
    const activities = fakeActivities();
    const fetchRegistered = vi.fn();
    const outcome = await registerActivity({ activities, fetchRegistered }, null, {
      source: 'x_post',
      url: 'https://x.com/a/status/1',
      title: '',
      publishedOn: '2026-01-01',
    });
    expect(outcome).toEqual({ status: 'forbidden' });
    expect(fetchRegistered).not.toHaveBeenCalled();
    expect(activities.register).not.toHaveBeenCalled();
  });

  it('URL を指名する取得元は、取得元の題と、オーナーの日付で保存する（FR-009・FR-011）', async () => {
    const activities = fakeActivities();
    await registerActivity(
      {
        activities,
        fetchRegistered: async () => ({ ok: true, title: '作り物の投稿', imageUrl: null }),
      },
      OWNER,
      { source: 'x_post', url: 'https://x.com/a/status/1', title: '', publishedOn: '2026-01-02' },
    );
    expect(activities.register).toHaveBeenCalledWith('x_post', {
      externalId: '1',
      url: 'https://x.com/a/status/1',
      title: '作り物の投稿',
      imageUrl: null,
      publishedAt: '2026-01-01T15:00:00.000Z',
    });
  });

  it('取得元から題を取れなければ保存しない（research.md の R9）', async () => {
    const activities = fakeActivities();
    const outcome = await registerActivity(
      {
        activities,
        fetchRegistered: async () => ({
          ok: false,
          reason: '取得元が題を返さなかった',
          gone: false,
        }),
      },
      OWNER,
      {
        source: 'youtube_video',
        url: 'https://youtu.be/fakeVideo01',
        title: '',
        publishedOn: '2026-01-02',
      },
    );
    expect(outcome).toMatchObject({ status: 'invalid', errors: { url: 'fetch-failed' } });
    expect(activities.register).not.toHaveBeenCalled();
  });

  it('登録していないサイトの URL を、手で入れた題で保存する（FR-005・FR-010）', async () => {
    const activities = fakeActivities();
    const fetchRegistered = vi.fn();
    await registerActivity({ activities, fetchRegistered }, OWNER, {
      source: 'unlisted',
      url: 'https://example.com/fake-article',
      title: '作り物の記事',
      publishedOn: '2024-05-01',
    });
    expect(fetchRegistered).not.toHaveBeenCalled();
    expect(activities.register).toHaveBeenCalledWith(
      'unlisted',
      expect.objectContaining({ externalId: null, title: '作り物の記事' }),
    );
  });

  it('同じ項目があれば、保存できない理由を返す', async () => {
    const activities = fakeActivities({
      register: vi.fn(async () => ({ ok: false as const, reason: 'duplicate' as const })),
    });
    expect(
      await registerActivity({ activities, fetchRegistered: vi.fn() }, OWNER, {
        source: 'unlisted',
        url: 'https://example.com/a',
        title: 'a',
        publishedOn: '2024-05-01',
      }),
    ).toMatchObject({ status: 'invalid', errors: { url: 'duplicate' } });
  });
});

describe('書き換えと削除（FR-022・FR-031・FR-033）', () => {
  it('一覧を取る activity は書き換えられず、削除できない', () => {
    expect(editableFieldsOf('zenn_article')).toEqual([]);
    expect(canDelete('zenn_article')).toBe(false);
    expect(editableFieldsOf('x_post')).toEqual(['publishedOn']);
    expect(editableFieldsOf('unlisted')).toEqual(['url', 'title', 'publishedOn']);
    expect(canDelete('x_post')).toBe(true);
  });

  it('一覧を取る activity の書き換えを拒み、何も書かない', async () => {
    const activities = fakeActivities({
      findForEdit: vi.fn(async () => activity({ source: 'zenn_article', externalId: null })),
    });
    const outcome = await editActivity(activities, OWNER, 1, {
      source: 'zenn_article',
      url: 'https://zenn.dev/x',
      title: '書き換えた題',
      publishedOn: '2026-01-01',
    });
    expect(outcome).toMatchObject({ status: 'invalid', errors: { source: 'not-editable' } });
    expect(activities.edit).not.toHaveBeenCalled();
  });

  it('URL を指名した activity は日付だけを書き換え、送られた題と URL を使わない', async () => {
    const current = activity({
      source: 'x_post',
      externalId: '1',
      url: 'https://x.com/a/status/1',
      title: '取得元の題',
    });
    const activities = fakeActivities({ findForEdit: vi.fn(async () => current) });
    await editActivity(activities, OWNER, 1, {
      source: 'x_post',
      url: 'https://x.com/a/status/999',
      title: '送られた題',
      publishedOn: '2026-03-04',
    });
    expect(activities.edit).toHaveBeenCalledWith(1, {
      url: 'https://x.com/a/status/1',
      externalId: '1',
      title: '取得元の題',
      publishedAt: '2026-03-03T15:00:00.000Z',
    });
  });

  it('一覧を取る activity の削除を拒み、URL を指名した・手で入力した activity は消す', async () => {
    const listed = fakeActivities({
      findForEdit: vi.fn(async () => activity({ source: 'github_repository' })),
    });
    expect(await deleteActivity(listed, OWNER, 1)).toEqual({ status: 'not-deletable' });
    expect(listed.delete).not.toHaveBeenCalled();

    const manual = fakeActivities({ findForEdit: vi.fn(async () => activity()) });
    expect(await deleteActivity(manual, OWNER, 1)).toEqual({ status: 'deleted' });
  });

  it('オーナーでなければ、読まずに何も書かない', async () => {
    const activities = fakeActivities();
    expect(await deleteActivity(activities, null, 1)).toEqual({ status: 'forbidden' });
    expect(activities.findForEdit).not.toHaveBeenCalled();
  });
});
