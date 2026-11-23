'use client';

import { Tabs } from '@base-ui/react/tabs';
import { useRouter } from 'next/navigation';
import {
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';
import { CONTROL, FOCUS_VISIBLE } from '@/shared/components/field';
import { FORBIDDEN_MESSAGE } from '@/shared/components/form-alert';
import { MarkdownBody } from '@/shared/components/markdown-body';
import { MEDIA_ERROR_MESSAGES } from '@/shared/components/media-upload-form';
import { TypedTextarea } from '@/shared/components/typed-textarea';
import { mediaMarkOf } from '@/shared/domain/markdown';
import {
  MEDIA_FILE_FIELD,
  MEDIA_TYPES,
  type MediaFormResult,
  type MediaStorageKey,
} from '@/shared/domain/media';

/**
 * 本文の入力。「書く」と「プレビュー」のタブを持つ（GitHub のコメントの入力の書き方、
 * https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/about-writing-and-formatting-on-github ）。
 *
 * 画像を落とす・貼る・選ぶと、すぐ置き場に置き、カーソルの位置に画像の印を入れる
 * （https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files ）。
 * 置いている間は、置く画像の名前を持つ仮の印を入れる（HIG Drag and drop の「show a placeholder」）。
 * 入れた印は入力の値で、保存するまで本文に書かない。値を書き換えた後に input のイベントを出し、
 * フォームの直しかけの読み取り（`useDraft` の `bind`）に知らせる。1 回の送信で 1 枚
 * （specs/003-note/research.md の R12）。
 *
 * プレビューは、保存していない入力中の本文を、訪問者のページと同じ `MarkdownBody` で描く。
 * 「書く」の入力はプレビューの間も残し、フォームの送信に入れる。使い手は実績の本文
 */

type Attach = (
  formData: FormData,
) => Promise<{ status: 'added'; storageKey: string } | MediaFormResult>;

type Props = {
  name: string;
  label: string;
  rows?: number;
  defaultValue: string;
  error?: string;
  attach: {
    action: Attach;
    /** 持ち主を指す、送る値（例: `projectUid` とその uid） */
    owner: { field: string; uid: string };
  };
  /** プレビューの画像の `src`。出さない画像は null */
  mediaSrc: (storageKey: MediaStorageKey) => string | null;
  /** プレビューの中身を描く。渡さなければ `MarkdownBody` だけで描く */
  renderPreview?: (body: string) => ReactNode;
};

const isImage = (file: File) => (MEDIA_TYPES as readonly string[]).includes(file.type);

/** 画像の印を、前後を空行で区切った 1 つの段落として、選んだ範囲に入れる */
const insertParagraph = (element: HTMLTextAreaElement, text: string) => {
  const { selectionStart: start, selectionEnd: end, value } = element;
  const before = value.slice(0, start);
  const after = value.slice(end);
  const lead =
    before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const trail =
    after === '' || after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  element.setRangeText(`${lead}${text}${trail}`, start, end, 'end');
  element.dispatchEvent(new Event('input', { bubbles: true }));
};

/** 仮の印を置き換える。消されていたら何もしない */
const replaceText = (element: HTMLTextAreaElement, from: string, to: string) => {
  const index = element.value.indexOf(from);
  if (index === -1) return;
  element.setRangeText(to, index, index + from.length, 'preserve');
  element.dispatchEvent(new Event('input', { bubbles: true }));
};

const messageOf = (result: Exclude<Awaited<ReturnType<Attach>>, { status: 'added' }>) => {
  if (result.status === 'forbidden') return FORBIDDEN_MESSAGE;
  const reason = result.status === 'invalid' ? result.errors[MEDIA_FILE_FIELD] : undefined;
  return reason ? MEDIA_ERROR_MESSAGES[reason] : MEDIA_ERROR_MESSAGES.empty;
};

const TAB = cn(
  'rounded-full px-3 py-1 font-medium text-muted-foreground data-[active]:bg-foreground/6 data-[active]:text-foreground',
  FOCUS_VISIBLE,
);

export const MediaAttachTextareaField = ({
  name,
  label,
  rows,
  defaultValue,
  error,
  attach,
  mediaSrc,
  renderPreview,
}: Props) => {
  const router = useRouter();
  const id = `${useId()}-${name}`;
  const textareaRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [previewBody, setPreviewBody] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const textarea = () => textareaRef.current?.querySelector('textarea') ?? null;

  const upload = async (files: File[]) => {
    const element = textarea();
    if (!element || files.length === 0) return;
    setUploadError(null);
    for (const file of files) {
      const placeholder = `![アップロード中: ${file.name}…]()`;
      insertParagraph(element, placeholder);
      setUploading((n) => n + 1);
      const formData = new FormData();
      formData.set(attach.owner.field, attach.owner.uid);
      formData.set(MEDIA_FILE_FIELD, file);
      try {
        const result = await attach.action(formData);
        if (result.status === 'added') {
          replaceText(element, placeholder, mediaMarkOf(result.storageKey));
        } else {
          replaceText(element, placeholder, '');
          setUploadError(messageOf(result));
        }
      } catch {
        replaceText(element, placeholder, '');
        setUploadError('画像を足せませんでした。もう一度試してください');
      } finally {
        setUploading((n) => n - 1);
      }
    }
    // 画像の一覧とプレビューに、足した画像を出す。本文の直しかけは残る
    router.refresh();
  };

  const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes('Files');
  const errorId = `${id}-error`;

  return (
    <Tabs.Root
      value={tab}
      onValueChange={(value) => {
        if (value === 'preview') setPreviewBody(textarea()?.value ?? '');
        setTab(value === 'preview' ? 'preview' : 'write');
      }}
      className="flex flex-col gap-1"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-small font-medium">
          {label}
        </label>
        <Tabs.List aria-label={`${label}の表示`} className="flex gap-1 text-small">
          <Tabs.Tab value="write" className={TAB}>
            書く
          </Tabs.Tab>
          <Tabs.Tab value="preview" className={TAB}>
            プレビュー
          </Tabs.Tab>
        </Tabs.List>
      </div>
      <Tabs.Panel value="write" keepMounted className="flex flex-col gap-2">
        <div ref={textareaRef}>
          <TypedTextarea
            id={id}
            name={name}
            rows={rows}
            defaultValue={defaultValue}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={cn(CONTROL, FOCUS_VISIBLE, dragging && 'border-tint bg-tint/5')}
            onDragOver={(event) => {
              if (!hasFiles(event)) return;
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event: DragEvent<HTMLTextAreaElement>) => {
              if (!hasFiles(event)) return;
              event.preventDefault();
              setDragging(false);
              void upload(Array.from(event.dataTransfer.files));
            }}
            onPaste={(event: ClipboardEvent<HTMLTextAreaElement>) => {
              const files = Array.from(event.clipboardData.files).filter(isImage);
              // 文字を含む貼り付け（表計算の表など）は、文字として貼る
              if (files.length === 0 || event.clipboardData.types.includes('text/plain')) return;
              event.preventDefault();
              void upload(files);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
          <button
            type="button"
            onClick={() => pickerRef.current?.click()}
            className={cn(
              'rounded-full px-3 py-1 font-medium text-foreground ring-1 ring-border hover:bg-foreground/5',
              FOCUS_VISIBLE,
            )}
          >
            画像を選ぶ
          </button>
          <span>ドラッグ＆ドロップか貼り付けでも、カーソルの位置に画像を入れられます</span>
          <input
            ref={pickerRef}
            type="file"
            accept={MEDIA_TYPES.join(',')}
            multiple
            hidden
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              event.currentTarget.value = '';
              void upload(files);
            }}
          />
        </div>
      </Tabs.Panel>
      <Tabs.Panel
        value="preview"
        className={
          renderPreview
            ? 'flex flex-col gap-3'
            : 'flex min-h-40 flex-col gap-2 rounded-xl border border-border px-3 py-2'
        }
      >
        {previewBody.trim() === '' ? (
          <p className="text-muted-foreground">本文はありません</p>
        ) : renderPreview ? (
          renderPreview(previewBody)
        ) : (
          <MarkdownBody body={previewBody} mediaSrc={mediaSrc} />
        )}
      </Tabs.Panel>
      <p aria-live="polite" className="text-caption text-muted-foreground empty:hidden">
        {uploading > 0 ? `画像を置いています（${uploading} 枚）` : ''}
      </p>
      {uploadError && (
        <p role="alert" className="text-sm text-destructive">
          {uploadError}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </Tabs.Root>
  );
};
