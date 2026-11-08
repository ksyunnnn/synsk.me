import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NoteActionForm } from '@/features/note/components/note-action-form';
import { NoteForm } from '@/features/note/components/note-form';
import {
  CARD_IMAGE_SOURCE_LABELS,
  NOTE_STATUS_LABELS,
  NOTE_UID_FIELD,
  OPENED_REVISION_FIELD,
  toNoteFormValues,
  type NoteDoneKind,
} from '@/features/note/domain/note';
import { NOTE_COMMON_MESSAGES } from '@/features/note/components/note-messages';
import { ImageUploadSection } from '@/shared/components/image-upload-section';
import {
  addNoteImage,
  addSyndication,
  chooseCardImage,
  publishNote,
  refreshLinkPreviews,
  removeSyndication,
  saveNote,
  undeleteNote,
  unpublishNote,
} from '@/features/note/server/actions';
import { getNoteForEdit } from '@/features/note/server/queries';
import { TextLink } from '@/shared/components/text-link';

// 要求時のデータ（オーナーの確認と D1）を `<Suspense>` の外で読み、描画を終えてから
// 応答を返す（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;

export const metadata: Metadata = { title: 'note を編集する | synsk.me' };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const DONE_MESSAGES: Record<NoteDoneKind, string> = {
  created: 'note を作りました。下書きです',
  published: '最新の版を公開しました',
  unpublished: '下書きに戻しました。訪問者には見えません',
  undeleted: '削除を戻しました',
  restored:
    '過去の版に戻し、新しい版として保存しました。公開し直すまで、訪問者には前に公開した版が見えます',
  'image-added': '画像を追加しました',
  'card-image': '代表画像を選びました',
  'syndication-added': '転載先を記録しました',
  'syndication-removed': '転載先の記録を消しました',
  refreshed: '参照先の情報を取り直しました',
};

const SECTION = 'flex flex-col gap-4 border-t border-border pt-6';
const H2 = 'text-xl font-bold';

const Page = async ({ params, searchParams }: Props) => {
  // オーナーでなければ、note を読む前に 403 になる
  const note = await getNoteForEdit((await params).id);
  if (!note) notFound();
  const query = await searchParams;
  const done = first(query.done) as NoteDoneKind | undefined;
  const savedText = first(query.saved);
  const savedRevision = savedText && /^\d+$/.test(savedText) ? Number(savedText) : null;
  const addedImage = first(query.image);
  const refreshedCount = first(query.count);
  const uid = { [NOTE_UID_FIELD]: note.uid };
  const latest = note.latest.number;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <p>
        <TextLink href="/dash/notes">note の一覧へ戻る</TextLink>
      </p>
      <h1 className="text-2xl font-bold break-words">{note.latest.title || '（題なし）'}</h1>
      {savedRevision !== null && <p role="status">保存しました（版 {savedRevision}）</p>}
      {done && DONE_MESSAGES[done] && (
        <p role="status">
          {DONE_MESSAGES[done]}
          {done === 'refreshed' && refreshedCount && `（${refreshedCount} 件取れました）`}
        </p>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">状態</dt>
        <dd>{note.isDeleted ? '削除済み' : NOTE_STATUS_LABELS[note.status]}</dd>
        <dt className="text-muted-foreground">最新の版</dt>
        <dd>版 {latest}</dd>
        <dt className="text-muted-foreground">公開している版</dt>
        <dd>
          {note.status === 'published' && note.publishedRevisionNumber !== null
            ? `版 ${note.publishedRevisionNumber}`
            : 'なし'}
        </dd>
        <dt className="text-muted-foreground">初めて公開した日時</dt>
        <dd>{note.publishedAt ?? 'まだ公開していません'}</dd>
      </dl>

      {note.isDeleted ? (
        <section className={SECTION} aria-labelledby="undelete-heading">
          <h2 id="undelete-heading" className={H2}>
            削除を戻す
          </h2>
          <p>
            この note は削除済みで、訪問者には見えません。戻すと、削除する前の状態と版に戻ります。
          </p>
          <NoteActionForm
            action={undeleteNote}
            hidden={uid}
            submitLabel="削除を戻す"
            messages={{}}
            variant="primary"
          />
        </section>
      ) : (
        <>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li>
              <TextLink href={`/dash/notes/${note.uid}/preview`}>
                公開したときの見た目を見る
              </TextLink>
            </li>
            <li>
              <TextLink href={`/dash/notes/${note.uid}/revisions`}>版の一覧</TextLink>
            </li>
            {note.status === 'published' && (
              <li>
                <TextLink href={`/notes/${note.slug}`}>訪問者に見せるページを開く</TextLink>
              </li>
            )}
          </ul>

          {/* 保存のたびに版の番号が変わる。入力の初めの値を、保存した値で描き直す */}
          <NoteForm
            key={latest}
            action={saveNote}
            initialValues={toNoteFormValues(note)}
            note={{
              uid: note.uid,
              latestRevision: latest,
              slugLocked: note.publishedAt !== null,
              savedRevision: savedRevision ?? (done === 'created' ? latest : null),
            }}
          />

          <section className={SECTION} aria-labelledby="publish-heading">
            <h2 id="publish-heading" className={H2}>
              公開
            </h2>
            {note.status === 'published' && note.publishedRevisionNumber === latest ? (
              <p>最新の版（版 {latest}）を公開しています。</p>
            ) : (
              <>
                <p>
                  保存した最新の版（版 {latest}）を公開します。保存していない入力は公開しません。
                  {note.status === 'published' &&
                    `訪問者には、公開し直すまで版 ${note.publishedRevisionNumber} が見えます。`}
                </p>
                <NoteActionForm
                  action={publishNote}
                  hidden={{ ...uid, [OPENED_REVISION_FIELD]: latest }}
                  submitLabel={note.status === 'published' ? '最新の版を公開し直す' : '公開する'}
                  messages={{
                    'empty-title':
                      '題が空の版は公開できません。題を入れて保存してから公開してください',
                  }}
                  variant="primary"
                />
              </>
            )}
            {note.status === 'published' && (
              <NoteActionForm
                action={unpublishNote}
                hidden={uid}
                submitLabel="下書きに戻す"
                messages={{}}
              />
            )}
          </section>

          <ImageUploadSection
            action={addNoteImage}
            hidden={uid}
            ownerLabel=" note "
            images={note.images.map((image) => image.file)}
            imageUrl={(file) => `/dash/notes/${note.uid}/images/${file}`}
            addedImage={done === 'image-added' ? addedImage : null}
            visibility="本文に貼ると、公開した版の本文にある画像だけが訪問者に見えます。"
            commonMessages={NOTE_COMMON_MESSAGES}
          />

          <section className={SECTION} aria-labelledby="card-image-heading">
            <h2 id="card-image-heading" className={H2}>
              代表画像
            </h2>
            <p className="text-sm text-muted-foreground">
              ページの URL が他のサービスに貼られたときのカードに出す画像です。
            </p>
            <NoteActionForm
              action={chooseCardImage}
              hidden={uid}
              submitLabel="代表画像を選ぶ"
              messages={{
                invalid: '代表画像を選び直してください',
                'not-own-image': 'この note の画像だけを選べます',
              }}
            >
              <fieldset className="flex flex-col gap-2">
                <legend className="sr-only">代表画像の出どころ</legend>
                {(['generated', 'site'] as const).map((source) => (
                  <label key={source} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="cardImage"
                      value={source}
                      defaultChecked={note.cardImage.source === source}
                      className="size-4 accent-primary"
                    />
                    {CARD_IMAGE_SOURCE_LABELS[source]}
                  </label>
                ))}
                {note.images.map((image, index) => (
                  <label key={image.file} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="cardImage"
                      value={`media:${image.file}`}
                      defaultChecked={
                        note.cardImage.source === 'media' && note.cardImage.file === image.file
                      }
                      className="size-4 accent-primary"
                    />
                    この note の画像 {index + 1}
                  </label>
                ))}
              </fieldset>
            </NoteActionForm>
          </section>

          <section className={SECTION} aria-labelledby="link-preview-heading">
            <h2 id="link-preview-heading" className={H2}>
              参照先のカード
            </h2>
            <p className="text-sm text-muted-foreground">
              URL
              だけの段落は、保存したときに参照先の題と画像を取り、カードにします。参照先が変わったときは取り直してください。1
              回に 10 個まで取ります。
            </p>
            <NoteActionForm
              action={refreshLinkPreviews}
              hidden={uid}
              submitLabel="参照先の情報を取り直す"
              messages={{}}
            />
          </section>

          <section className={SECTION} aria-labelledby="syndication-heading">
            <h2 id="syndication-heading" className={H2}>
              転載先
            </h2>
            <p className="text-sm text-muted-foreground">
              この note を複製した外部のサービスの URL を記録します。訪問者には見せません。
            </p>
            {note.syndications.length > 0 && (
              <ul className="flex flex-col gap-3">
                {note.syndications.map((url) => (
                  <li key={url} className="flex flex-col gap-2">
                    <span className="break-all">{url}</span>
                    <NoteActionForm
                      action={removeSyndication}
                      hidden={{ ...uid, syndicationUrl: url }}
                      submitLabel="この記録を消す"
                      messages={{}}
                    />
                  </li>
                ))}
              </ul>
            )}
            <NoteActionForm
              action={addSyndication}
              hidden={uid}
              submitLabel="転載先を記録する"
              label="転載先の記録"
              messages={{
                invalid: '転載先は http か https で始まる URL にしてください',
                'syndication-taken':
                  'この URL は記録済みです。別の note にも同じ URL は記録できません',
              }}
            >
              <label className="flex flex-col gap-1">
                <span className="font-bold">転載先の URL</span>
                <input
                  type="url"
                  name="syndicationUrl"
                  inputMode="url"
                  autoComplete="off"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                />
              </label>
            </NoteActionForm>
          </section>

          <section className={SECTION}>
            <p>
              <TextLink href={`/dash/notes/${note.uid}/delete`}>この note を削除する</TextLink>
            </p>
          </section>
        </>
      )}
    </main>
  );
};

export default Page;
