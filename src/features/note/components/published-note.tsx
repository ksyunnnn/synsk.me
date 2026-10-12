import type { PublishedNoteDto } from '@/features/note/domain/note';

/**
 * 訪問者に見せる note。本文は文字列として出し、HTML として解釈しない。
 * 改行は `white-space: pre-wrap` で、作り手が入れた位置のまま改行する
 */
export const PublishedNote = ({ note }: { note: PublishedNoteDto }) => (
  <article>
    <h1>{note.title}</h1>
    <p>
      公開日 <time dateTime={note.publishedOn}>{note.publishedOn}</time>
    </p>
    <div style={{ whiteSpace: 'pre-wrap' }}>{note.body}</div>
  </article>
);
