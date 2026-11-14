// delay-visuals の画面の外側も、画面と同じ灰色のざらつきにする。地とその理由は
// src/shared/components/paper-canvas.tsx にある
import type { Viewport } from 'next';
import { PaperCanvas, paperCanvasViewport } from '@/shared/components/paper-canvas';

export const viewport: Viewport = paperCanvasViewport;

const Layout = ({ children }: { children: React.ReactNode }) => (
  <>
    <PaperCanvas />
    {children}
  </>
);

export default Layout;
