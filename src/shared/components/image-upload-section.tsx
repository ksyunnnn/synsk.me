import { OperationForm, type OperationResult } from '@/shared/components/operation-form';
import {
  IMAGE_ACCEPT,
  IMAGE_MAX_BYTES,
  IMAGE_MAX_COUNT,
  isImageFile,
  toMarkdownImage,
} from '@/shared/domain/media-image';

/**
 * 管理画面の「画像」の区画（specs/001-career-and-project/spec.md の FR-027、
 * specs/003-note/spec.md の FR-023）。画像を足すフォームと、足した画像の一覧と本文に貼る書き方を出す。
 * Server Component。Server Action と画像の URL は使い手の画面が渡す
 */

type Props = {
  action: (state: OperationResult | null, formData: FormData) => Promise<OperationResult>;
  hidden: Record<string, string | number>;
  /** 持ち主の呼び名。「1 つの実績に」のように文言に入れる。英字の名前は前後に空白を付けて渡す */
  ownerLabel: string;
  /** 足した画像のファイル名。追加した順 */
  images: string[];
  /** オーナーが見る画像の URL */
  imageUrl: (file: string) => string;
  /** この画面へ移る前に足した画像のファイル名。本文に貼る書き方を知らせる */
  addedImage?: string | null;
  /** 訪問者にどう見えるかの説明 */
  visibility: string;
  /** 持ち主に共通の、止めた理由の文言 */
  commonMessages?: Record<string, string>;
};

const MB = IMAGE_MAX_BYTES / 1024 / 1024;

export const ImageUploadSection = ({
  action,
  hidden,
  ownerLabel,
  images,
  imageUrl,
  addedImage,
  visibility,
  commonMessages,
}: Props) => (
  <section
    className="flex flex-col gap-4 border-t border-border pt-6"
    aria-labelledby="images-heading"
  >
    <h2 id="images-heading" className="text-xl font-bold">
      画像
    </h2>
    <p className="text-sm text-muted-foreground">
      JPEG・PNG・WebP・GIF を 1 枚 {MB} MB まで、1 つの{ownerLabel}に {IMAGE_MAX_COUNT}{' '}
      枚まで追加できます。{visibility}
    </p>
    {addedImage && isImageFile(addedImage) && (
      <p role="status">
        本文に貼る書き方: <code className="font-mono break-all">{toMarkdownImage(addedImage)}</code>
      </p>
    )}
    <OperationForm
      action={action}
      hidden={hidden}
      submitLabel="画像を追加する"
      label="画像の追加"
      commonMessages={commonMessages}
      messages={{
        missing: '画像のファイルを選んでください',
        'too-large': `画像は 1 枚 ${MB} MB までです`,
        unsupported: '画像は JPEG・PNG・WebP・GIF のどれかにしてください',
        'too-many-images': `1 つの${ownerLabel}に追加できる画像は ${IMAGE_MAX_COUNT} 枚までです`,
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="font-bold">画像のファイル</span>
        <input
          type="file"
          name="image"
          accept={IMAGE_ACCEPT}
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
      </label>
    </OperationForm>
    {images.length > 0 && (
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {images.map((file, index) => (
          <li key={file} className="flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl(file)}
              alt={`${ownerLabel.trim()}の画像 ${index + 1}`}
              className="h-24 w-full rounded-md object-cover"
            />
            <code className="font-mono text-xs break-all">{toMarkdownImage(file)}</code>
          </li>
        ))}
      </ul>
    )}
  </section>
);
