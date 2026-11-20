import { routes } from '@/shared/routes';
import { selectRowPage } from '../../_select-row';

export default selectRowPage(routes.dash.careers.list);

// 要求時の値を読んでから移る（https://nextjs.org/docs/messages/blocking-prerender-dynamic）
export const instant = false;
