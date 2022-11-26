import { component$ } from '@builder.io/qwik';
import { DocumentHead, Link } from '@builder.io/qwik-city';

export default component$(() => {
  return (
    <main>
      <div class="about">
        <p>Nice to meet you 👋</p>
        {"by "}
      <Link href="https://twitter.com/ksyunnnn">@ksyunnnn</Link>

      <p>see <Link href='https://github.com/ksyunnnn/synsk.me'>Github</Link></p>
      </div>
    </main>
  );
});

export const head: DocumentHead = {
  title: 'About | synsk.me',
  meta: [
    {
      name: 'description',
      content: 'synsk.me',
    },
  ],
};
