import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="jarvis-warm-bg flex min-h-screen items-center justify-center p-6">
      <div className="jarvis-frost max-w-md w-full p-8 text-center relative overflow-hidden">
        <div className="jarvis-page-orb -top-10 -right-10 h-32 w-32" aria-hidden />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">404</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground">Page not found</h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          ไม่พบหน้าที่คุณต้องการ — อาจถูกย้ายหรือลบออกแล้ว
        </p>
        <Link
          to="/"
          className="jarvis-pill-btn mt-6 inline-flex px-6 py-3 text-sm"
        >
          กลับหน้าหลัก
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
