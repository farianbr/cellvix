import { createContext, useContext, useEffect, useState } from 'react';

/**
 * The name of the record a detail page is showing, so the breadcrumb can print
 * `⌂ > Sales > Orders > CVX-2026-00042` rather than `… > Order` (§4b.6).
 *
 * The shell renders one `Breadcrumbs` for every screen, so the label cannot be
 * passed down as a prop — the detail page is a sibling of the trail, not a
 * parent. A one-value context is the smallest thing that lets the page tell the
 * shell what it is looking at.
 *
 * It clears on unmount, so a stale record name can never survive onto the next
 * screen.
 */
const RecordLabelContext = createContext({ label: null, setLabel: () => {} });

export function RecordLabelProvider({ children }) {
  const [label, setLabel] = useState(null);
  return (
    <RecordLabelContext.Provider value={{ label, setLabel }}>{children}</RecordLabelContext.Provider>
  );
}

/** Read by `Breadcrumbs`. */
export function useRecordLabel() {
  return useContext(RecordLabelContext).label;
}

/** Called by a detail page with the record's name, or `null` while it loads. */
export function useSetRecordLabel(value) {
  const { setLabel } = useContext(RecordLabelContext);

  useEffect(() => {
    setLabel(value ?? null);
    return () => setLabel(null);
  }, [value, setLabel]);
}
