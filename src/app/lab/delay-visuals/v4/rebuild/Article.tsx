// 記事ページのモック。timeline の「サイトを作り直すことにした」の行から飛ぶ先。本文は作り物
import { Noto_Sans_JP, Source_Sans_3 } from 'next/font/google';

const sourceSans = Source_Sans_3({ subsets: ['latin'], weight: ['300', '400', '600'] });
const notoSansJp = Noto_Sans_JP({ weight: ['300', '400', '600'], preload: false });

const PARAGRAPHS = [
  'このサイトを、一から作り直すことにした。いまの形を少しずつ直すのではなく、何を載せるか、どう見せるかを最初から考え直す。',
  'きっかけは、自分のしてきたことを人に伝えようとしたときに、このサイトを開いても伝わらないと気づいたことだった。書いた記事、作ったもの、関わった仕事が、それぞれ別の場所に散らばっていて、ひとつの流れとして読めない。',
  'そこで、新しいトップには timeline を置く。記事も、作ったものも、仕事も、日付の順にひとつの列に並べる。読む人が上から下へたどるだけで、何をしてきた人なのかがおおよそ分かる形を目指す。',
  '見た目も変える。情報を詰め込むより、ひとつずつの出来事が落ち着いて読めることを大事にしたい。文字は大きめに、余白は広めに取る。',
  '作り直しの途中で試したことは、lab という場所に残していく。うまくいかなかったものも消さずに置いておけば、あとから考えをたどり直せる。',
  'すべてが一度に変わるわけではない。決めたところから順に、少しずつ公開していく。',
];

export const Article = () => (
  <div
    className={`${sourceSans.className} bg-background text-foreground`}
    style={{
      fontFamily: `${sourceSans.style.fontFamily}, ${notoSansJp.style.fontFamily}, sans-serif`,
    }}
  >
    <article className="mx-auto grid max-w-[560px] gap-8 px-6 pt-8 pb-24 font-light">
      <header className="grid gap-3">
        <p className="text-sm text-muted-foreground tabular-nums">2026-10-20</p>
        <h1 className="text-2xl leading-snug font-semibold">サイトを作り直すことにした</h1>
      </header>
      <div className="grid gap-6 text-lg leading-loose">
        {PARAGRAPHS.map((paragraph) => (
          <p key={paragraph.slice(0, 12)}>{paragraph}</p>
        ))}
      </div>
    </article>
  </div>
);
