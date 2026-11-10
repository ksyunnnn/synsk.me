import { describe, expect, it, vi } from 'vitest';
import { deleteLifeEvent } from '@/features/activity/application/delete-life-event';
import {
  registerLifeEventImage,
  removeLifeEventImage,
} from '@/features/activity/application/life-event-image';
import type { LifeEventRepository } from '@/features/activity/domain/life-event-repository';
import type { Author } from '@/shared/domain/author';
import type { MediaStorage } from '@/shared/domain/media';

/**
 * life event の代表画像のユースケース（specs/004-external-activity/spec.md の FR-027〜FR-029・FR-031、
 * research.md の R12）。Repository と置き場は作り物。置き場のキーは作り物の UUID
 */

const OWNER: Author = { email: 'owner@synsk.test' };
const NEW_KEY = '11111111-1111-4111-8111-111111111111';
const OLD_KEY = '22222222-2222-4222-8222-222222222222';
const FILE = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' });

const fakeStorage = (
  save: MediaStorage['save'] = async () => ({
    ok: true,
    media: { storageKey: NEW_KEY, type: 'image/jpeg', size: 4 },
  }),
) => ({
  save: vi.fn(save),
  read: vi.fn<MediaStorage['read']>(),
  remove: vi.fn<MediaStorage['remove']>(async () => {}),
});

const fakeLifeEvents = (found = true) =>
  ({
    replaceCardImage: vi.fn<LifeEventRepository['replaceCardImage']>(async () =>
      found ? { ok: true, removedKeys: [OLD_KEY] } : { ok: false },
    ),
    removeCardImage: vi.fn<LifeEventRepository['removeCardImage']>(async () =>
      found ? { ok: true, removedKeys: [OLD_KEY] } : { ok: false },
    ),
    delete: vi.fn<LifeEventRepository['delete']>(async () =>
      found ? { ok: true, removedKeys: [OLD_KEY] } : { ok: false },
    ),
  }) as unknown as LifeEventRepository & {
    replaceCardImage: ReturnType<typeof vi.fn>;
    removeCardImage: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

describe('registerLifeEventImage', () => {
  it('置き場に置いて代表画像にし、前の画像を置き場から消す（Acceptance 4）', async () => {
    const storage = fakeStorage();
    const lifeEvents = fakeLifeEvents();

    expect(await registerLifeEventImage(lifeEvents, storage, OWNER, 1, FILE)).toEqual({
      status: 'saved',
    });
    expect(lifeEvents.replaceCardImage).toHaveBeenCalledWith(1, NEW_KEY, 4);
    expect(storage.remove).toHaveBeenCalledWith([OLD_KEY]);
  });

  it.each(['too-large', 'unsupported-type', 'empty'] as const)(
    '置き場が %s で拒んだら、D1 を書かずに理由を返す（Acceptance 5）',
    async (reason) => {
      const storage = fakeStorage(async () => ({ ok: false, reason }));
      const lifeEvents = fakeLifeEvents();

      expect(await registerLifeEventImage(lifeEvents, storage, OWNER, 1, FILE)).toEqual({
        status: 'rejected',
        reason,
      });
      expect(lifeEvents.replaceCardImage).not.toHaveBeenCalled();
    },
  );

  it('life event が無ければ、置いた画像を置き場から消す', async () => {
    const storage = fakeStorage();

    expect(await registerLifeEventImage(fakeLifeEvents(false), storage, OWNER, 9, FILE)).toEqual({
      status: 'not-found',
    });
    expect(storage.remove).toHaveBeenCalledWith([NEW_KEY]);
  });

  it('オーナーでなければ、置き場にも D1 にも書かない（FR-031）', async () => {
    const storage = fakeStorage();
    const lifeEvents = fakeLifeEvents();

    expect(await registerLifeEventImage(lifeEvents, storage, null, 1, FILE)).toEqual({
      status: 'forbidden',
    });
    expect(storage.save).not.toHaveBeenCalled();
    expect(lifeEvents.replaceCardImage).not.toHaveBeenCalled();
  });
});

describe('removeLifeEventImage', () => {
  it('代表画像を外し、置き場から消す', async () => {
    const storage = fakeStorage();

    expect(await removeLifeEventImage(fakeLifeEvents(), storage, OWNER, 1)).toEqual({
      status: 'saved',
    });
    expect(storage.remove).toHaveBeenCalledWith([OLD_KEY]);
  });

  it('オーナーでなければ何もしない', async () => {
    const storage = fakeStorage();
    const lifeEvents = fakeLifeEvents();

    expect(await removeLifeEventImage(lifeEvents, storage, null, 1)).toEqual({
      status: 'forbidden',
    });
    expect(lifeEvents.removeCardImage).not.toHaveBeenCalled();
  });
});

describe('deleteLifeEvent の画像', () => {
  it('life event を消すと、その画像を置き場から消す（FR-027、Acceptance 6）', async () => {
    const storage = fakeStorage();

    expect(await deleteLifeEvent(fakeLifeEvents(), storage, OWNER, 1)).toEqual({
      status: 'deleted',
    });
    expect(storage.remove).toHaveBeenCalledWith([OLD_KEY]);
  });

  it('置き場から消すのに失敗しても、消したことを返す。D1 から辿れる行は残らない（R12）', async () => {
    const storage = fakeStorage();
    storage.remove.mockRejectedValueOnce(new Error('作り物の R2 の失敗'));

    expect(await deleteLifeEvent(fakeLifeEvents(), storage, OWNER, 1)).toEqual({
      status: 'deleted',
    });
  });
});
