import { useEffect } from "react";
import { useParams, useOutletContext } from "react-router-dom";

import { BASE_URL } from "../config";
import usePageStore from "../stores/pageStore";
import useThemeStore from "../stores/themeStore";
import useProjectStore from "../stores/projectStore";
import { fetchPreviewToken } from "../queries/previewManager";

/**
 * Standalone site preview for a normal page. A thin child of SitePreviewLayout:
 * it loads the page (plus its global widgets and theme settings) into the page
 * store, requests a standalone render token, and reports the resulting iframe src
 * up to the layout. All chrome (toolbar, loader, iframe) lives in the layout.
 */
export default function PagePreview() {
  const { pageId } = useParams();
  const { setPreview } = useOutletContext();
  const activeProjectId = useProjectStore((state) => state.activeProject?.id);
  const loadPage = usePageStore((state) => state.loadPage);
  const loading = usePageStore((state) => state.loading);
  const error = usePageStore((state) => state.error);
  const page = usePageStore((state) => state.page);

  useEffect(() => {
    loadPage(pageId);
  }, [pageId, activeProjectId, loadPage]);

  useEffect(() => {
    if (loading) {
      setPreview({ src: null, loading: true, notFound: false });
      return;
    }
    if (error || !page) {
      setPreview({ src: null, loading: false, notFound: true });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { globalWidgets } = usePageStore.getState();
        const themeSettings = useThemeStore.getState().settings;
        const { token } = await fetchPreviewToken({ ...page, globalWidgets }, themeSettings, "standalone");
        if (!cancelled) setPreview({ src: `${BASE_URL}/render/${token}`, loading: false, notFound: false });
      } catch {
        if (!cancelled) setPreview({ src: null, loading: false, notFound: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, error, page, setPreview]);

  return null;
}
