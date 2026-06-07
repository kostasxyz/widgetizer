import { useEffect, useMemo } from "react";
import { useParams, useOutletContext } from "react-router-dom";

import { BASE_URL } from "../config";
import useCollections from "../hooks/useCollections";
import { getCollectionItem, previewCollectionItem } from "../queries/collectionManager";

/**
 * Standalone site preview for a collection item page, reached by navigating to a
 * nested item link (e.g. "rooms/suite-caldera.html") while browsing the site
 * preview. A thin child of SitePreviewLayout: it resolves the URL slugPrefix to a
 * collection type via useCollections (only hasItemPages collections qualify),
 * loads the saved item, requests a render token through the existing
 * previewCollectionItem -> /render/:token flow, and reports the iframe src up to
 * the layout. All chrome lives in the layout.
 */
export default function CollectionItemPagePreview() {
  const { prefix, slug } = useParams();
  const { setPreview } = useOutletContext();
  const { schemas, loading: schemasLoading } = useCollections();

  // Resolve the URL slugPrefix (e.g. "rooms") to a collection type (e.g.
  // "accommodation"). Only collections that actually produce item pages qualify.
  const schema = useMemo(
    () => (schemas || []).find((s) => s.slugPrefix === prefix && s.hasItemPages),
    [schemas, prefix],
  );

  useEffect(() => {
    if (schemasLoading) {
      setPreview({ src: null, loading: true, notFound: false });
      return;
    }
    if (!schema) {
      setPreview({ src: null, loading: false, notFound: true });
      return;
    }

    let cancelled = false;
    setPreview({ src: null, loading: true, notFound: false });
    (async () => {
      try {
        const item = await getCollectionItem(schema.type, slug);
        const { token } = await previewCollectionItem({
          collectionType: schema.type,
          slug: item.slug,
          settings: item.settings || {},
        });
        if (!cancelled) setPreview({ src: `${BASE_URL}/render/${token}`, loading: false, notFound: false });
      } catch {
        if (!cancelled) setPreview({ src: null, loading: false, notFound: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [schema, schemasLoading, slug, setPreview]);

  return null;
}
