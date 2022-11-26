import { component$ } from '@builder.io/qwik';
import { DocumentHead, Link } from '@builder.io/qwik-city';

export default component$(() => {
  return (
    <main>
      <div class="about">by <Link href="https://twitter.com/ksyunnnn">@ksyunnnn</Link></div>
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
