import { useEffect, useMemo, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Monitor, Smartphone } from "lucide-react";

import { isStandalonePreviewNavigationUrl } from "../utils/previewLinkUtils";
import LoadingSpinner from "../components/ui/LoadingSpinner";

// Matches the sandbox PreviewPanel applies to standalone page iframes.
const STANDALONE_SANDBOX =
  "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-presentation allow-top-navigation-by-user-activation";

/**
 * Persistent shell for the standalone site preview (browse like a visitor). Owns
 * the toolbar, the device toggle, the iframe stage, and link navigation. Child
 * routes (page / collection item) only resolve which render token to show and
 * report it up via the outlet context's setPreview(). Because the toolbar and
 * stage live here, navigating page<->item never remounts them — no flash, one
 * loader, identical look for both kinds of page.
 */
export default function SitePreviewLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [previewMode, setPreviewMode] = useState(() => localStorage.getItem("editorPreviewMode") || "desktop");
  const [preview, setPreview] = useState({ src: null, loading: true, notFound: false });
  const [resolvedPath, setResolvedPath] = useState(location.pathname);

  // On navigation, drop back to a loading state — done during render (React's
  // "adjust state when a prop changes" pattern) rather than in an effect, so the
  // stage never shows the previous page while the next child resolves its token.
  if (location.pathname !== resolvedPath) {
    setResolvedPath(location.pathname);
    setPreview({ src: null, loading: true, notFound: false });
  }

  // Follow links clicked inside the preview iframe (page<->page, page<->item).
  useEffect(() => {
    const handleMessage = (event) => {
      const targetUrl = event.data?.payload?.url;
      if (event.data?.type === "NAVIGATE_PREVIEW" && isStandalonePreviewNavigationUrl(targetUrl)) {
        navigate(targetUrl);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigate]);

  const chooseMode = (mode) => {
    setPreviewMode(mode);
    localStorage.setItem("editorPreviewMode", mode);
  };

  // Stable context value — setPreview from useState is referentially stable.
  const outletContext = useMemo(() => ({ setPreview }), []);

  const isMobile = previewMode === "mobile";
  const { src, loading, notFound } = preview;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <div className="flex items-center justify-center border-b border-slate-200 bg-white p-2">
        <div className="flex h-9 items-center gap-1 rounded-md bg-slate-200 p-1">
          <button
            onClick={() => chooseMode("desktop")}
            title={t("pageEditor.toolbar.desktopView")}
            className={`rounded p-1.5 ${
              !isMobile ? "bg-white text-pink-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Monitor size={18} />
          </button>
          <button
            onClick={() => chooseMode("mobile")}
            title={t("pageEditor.toolbar.mobileView")}
            className={`rounded p-1.5 ${
              isMobile ? "bg-white text-pink-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Smartphone size={18} />
          </button>
        </div>
      </div>

      <div
        className={`relative min-h-0 flex-1 transition-colors duration-300 ${isMobile ? "bg-slate-200" : "bg-white"}`}
      >
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80">
            <LoadingSpinner message={t("pagePreview.loading")} />
          </div>
        )}
        {!loading && notFound && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-yellow-600">{t("pagePreview.notFound")}</p>
          </div>
        )}
        {src && !notFound && (
          <iframe
            key={src}
            src={src}
            title={t("pageEditor.preview.title")}
            sandbox={STANDALONE_SANDBOX}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            className={`mx-auto h-full w-full border-0 transition-all duration-300 ease-in-out ${
              isMobile ? "shadow-2xl" : ""
            }`}
            style={{ maxWidth: isMobile ? "24rem" : "100%" }}
          />
        )}
      </div>

      <Outlet context={outletContext} />
    </div>
  );
}
