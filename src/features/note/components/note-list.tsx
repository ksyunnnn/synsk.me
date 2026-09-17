import Link from 'next/link';
import type { NoteSummaryDto } from '@/features/note/domain/note';

/** 作り手向けの note の一覧。下書きか公開か、公開し直していない書き換えがあるかを出す */
export const NoteList = ({ notes }: { notes: NoteSummaryDto[] }) => {
  if (notes.length === 0) return <p>note がありません</p>;

  return (
    <ul>
      {notes.map((note) => (
        <li key={note.id}>
          <Link href={`/dash/notes/${note.id}`}>
            {note.title === '' ? '（題なし）' : note.title}
          </Link>
          <p>slug: {note.slug}</p>
          <p>状態: {note.status === 'published' ? '公開' : '下書き'}</p>
          {note.hasUnpublishedChanges && <p>公開し直していない書き換えがあります</p>}
        </li>
      ))}
    </ul>
  );
};
