import { Logo } from "@/components/shared/logo";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo className="mb-3 size-14" />
          <h1 className="text-xl font-semibold tracking-tight">
            East Anglia AI Services
          </h1>
          <p className="text-muted-foreground text-sm">CRM</p>
        </div>
        {children}
      </div>
    </div>
  );
}
