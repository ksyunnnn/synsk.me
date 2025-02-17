import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { SmileyXEyes } from '@/icon';
import Link from 'next/link';

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <Alert className="fixed top-0 w-full">
        <SmileyXEyes className="h-4 w-4" />
        <AlertTitle className="flex items-center text-slate-600">
          このページはアーカイブ済みです
          {/* <SmileyXEyes className="h-4 w-4" /> */}
        </AlertTitle>
        <AlertDescription className="text-xs">
          情報が古いかも！トップは
          <Link href="/" className="underline">
            こっち！
          </Link>
        </AlertDescription>
      </Alert>
      {children}
    </>
  );
};

export default Layout;
