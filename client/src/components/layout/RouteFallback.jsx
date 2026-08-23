import Skeleton from '@/components/ui/Skeleton';

/**
 * Shown while a lazily-loaded route chunk downloads.
 *
 * Deliberately a skeleton with roughly page-shaped blocks rather than a centred
 * spinner: on a fast connection it flashes for a frame or two, and a spinner
 * flashing in the middle of an empty page reads as a fault.
 */
export function RouteFallback() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 lg:px-6" role="status" aria-label="Loading">
      <Skeleton className="mb-5 h-9 w-56" />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
        <div className="space-y-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="mt-3 h-56 lg:mt-0" />
      </div>
    </div>
  );
}

export default RouteFallback;
