const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <div className="text-sm">アーカイブ済みのページです。情報古いよー</div>
      {children}
    </>
  );
};

export default Layout;
