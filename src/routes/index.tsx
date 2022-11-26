import { component$, useClientEffect$ } from '@builder.io/qwik';
import { DocumentHead, RequestHandler, useNavigate } from '@builder.io/qwik-city';

export default component$(() => {
  const nav = useNavigate();

  useClientEffect$(()=>{
    nav.path = 'https://syunsukekobashi.co/';
  })

  return (
    <main>
      <div class="greeting">Nice to meet you 👋</div>
    </main>
  );
});

export const head: DocumentHead = {
  title: 'Nice to meet you 👋 | synsk.me',
  meta: [
    {
      name: 'description',
      content: 'synsk.me',
    },
  ],
};

export const onGet: RequestHandler = async ({ response }) => {
  throw response.redirect('https://syunsukekobashi.co/');
};