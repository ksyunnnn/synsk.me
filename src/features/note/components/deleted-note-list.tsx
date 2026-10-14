import Link from 'next/link';
import type { DeletedNoteDto } from '@/features/note/domain/note';

/** 作り手向けの、削除した note の一覧。削除する前の状態を出す */
export const DeletedNoteList = ({ notes }: { notes: DeletedNoteDto[] }) => {
  if (notes.length === 0) return <p>削除した note はありません</p>;

  return (
    <ul aria-label="削除した note の一覧">
      {notes.map((note) => (
        <li key={note.id}>
          <p>{note.title === '' ? '（題なし）' : note.title}</p>
          <p>slug: {note.slug}</p>
          <p>削除する前の状態: {note.status === 'published' ? '公開' : '下書き'}</p>
          <Link href={`/dash/notes/${note.id}/restore`}>この note を戻す</Link>
        </li>
      ))}
    </ul>
  );
};
