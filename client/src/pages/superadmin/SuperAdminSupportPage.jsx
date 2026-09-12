import { useState } from 'react';
import { AlertCircle, Check, LifeBuoy, MessageSquare, ShieldAlert, X } from 'lucide-react';

import {
  PlatformBadge,
  PlatformButton,
  PlatformEmpty,
  PlatformHeader,
  PlatformPanel,
} from '@/components/superadmin/PlatformUI';
import { PlatformModal } from '@/components/superadmin/PlatformForm';
import Skeleton from '@/components/ui/Skeleton';

import SupportThread from '@/components/support/SupportThread';
import cn from '@/lib/cn';
import { pressable } from '@/lib/motion';
import { dateTime } from '@/lib/format';
import {
  useImpersonations,
  useSupportThread,
  useSupportThreads,
  useSuperAdminMutations,
} from '@/hooks/useSuperAdmin';

/**
 * Support sessions — who has been inside a tenant's business, and who is inside
 * one right now (SAAS_PLATFORM §4.5, invariant 9).
 *
 * **This screen exists to be read by us, about us.** Every other console screen
 * answers a question about a tenant; this one answers a question about the
 * platform's own conduct, which is why it is a section rather than a tab on the
 * tenant list. An operator who forgets to leave, or who enters a business with
 * a reason nobody would accept, should be visible here without anybody having
 * to go looking.
 *
 * The tenant sees the same facts from the other side, in their own activity
 * log. Neither copy is the authoritative one; they are written together, and
 * the point is that the customer's copy cannot be edited from here.
 */

/** A live grant reads differently from a finished one, so it is sorted first. */
function GrantRow({ grant, onRevoke, isRevoking }) {
  return (
    <li className="flex flex-wrap items-start gap-3 px-3 py-3">
      <ShieldAlert
        className={grant.live ? 'mt-0.5 size-4 shrink-0 text-plat-danger' : 'mt-0.5 size-4 shrink-0 text-plat-dim'}
        strokeWidth={2}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-plat-text">
          {grant.superAdminName || grant.superAdminEmail}
          <span className="font-normal text-plat-dim">in</span>
          {grant.businessName}
          {grant.live && (
            <PlatformBadge tone="danger" size="sm">
              inside now
            </PlatformBadge>
          )}
          {grant.endedReason === 'revoked' && (
            <PlatformBadge tone="warn" size="sm">
              revoked
            </PlatformBadge>
          )}
        </p>

        {/* The reason is the whole justification for the session, so it is shown
            at full weight rather than tucked into a detail expander. */}
        <p className="mt-0.5 text-sm text-plat-muted">{grant.reason}</p>

        <p className="mt-0.5 text-xs text-plat-dim">
          {dateTime(grant.startedAt)}
          {grant.endedAt ? ` — left ${dateTime(grant.endedAt)}` : ` — until ${dateTime(grant.expiresAt)}`}
          {grant.ip ? ` · ${grant.ip}` : ''}
        </p>
      </div>

      {grant.live && (
        <PlatformButton
          variant="ghost"
          size="sm"
          icon={X}
          loading={isRevoking}
          onClick={() => onRevoke(grant)}
        >
          Revoke
        </PlatformButton>
      )}
    </li>
  );
}

/**
 * One tenant's conversation, opened from the list.
 *
 * Fetched only when opened — a list that carried every message of every thread
 * would be most of the collection on one request, and the preview is enough to
 * decide which one to read.
 */
function ThreadPanel({ tenantId, tenantName, onClose }) {
  const { data, isLoading } = useSupportThread(tenantId);
  const { replyToThread, resolveThread } = useSuperAdminMutations();
  const [error, setError] = useState(null);

  if (isLoading) return <Skeleton className="h-64" rounded="lg" />;

  const thread = data?.thread;

  return (
    <div className="flex h-[60vh] flex-col">
      <SupportThread
        thread={thread}
        side="platform"
        surface="platform"
        isSending={replyToThread.isPending}
        error={error}
        placeholder={`Reply to ${tenantName}…`}
        emptyBody="Nothing here yet. A message you send starts the conversation."
        onSend={(body, { onSuccess }) => {
          setError(null);
          replyToThread.mutate(
            { id: tenantId, body },
            { onSuccess, onError: (err) => setError(err.message) },
          );
        }}
      />

      <div className="mt-3 flex justify-end gap-2 border-t border-plat-line-soft pt-3">
        <PlatformButton variant="ghost" onClick={onClose}>
          Close
        </PlatformButton>
        {thread?.status === 'open' && (
          <PlatformButton
            variant="ghost"
            icon={Check}
            loading={resolveThread.isPending}
            onClick={() => resolveThread.mutate({ id: tenantId })}
          >
            Mark resolved
          </PlatformButton>
        )}
      </div>
    </div>
  );
}

export function SuperAdminSupportPage() {
  const { data, isLoading } = useImpersonations();
  const { data: threadData } = useSupportThreads();
  const { revokeImpersonation } = useSuperAdminMutations();
  const [error, setError] = useState(null);
  const [openThread, setOpenThread] = useState(null);

  const threads = threadData?.threads ?? [];

  const grants = data?.grants ?? [];
  const live = grants.filter((grant) => grant.live);
  const past = grants.filter((grant) => !grant.live);

  if (isLoading) {
    return (
      <>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-4 h-40 w-full" />
      </>
    );
  }

  const revoke = (grant) => {
    setError(null);
    revokeImpersonation.mutate(
      { id: grant.id },
      { onError: (err) => setError(err.message) },
    );
  };

  return (
    <>
      <PlatformHeader
        title="Support"
        description="Who has stepped into a tenant's business, why, and when they left."
      />

      {error && (
        <p className="mb-3 flex items-start gap-2 rounded-md bg-plat-danger/10 px-3 py-2.5 text-sm text-plat-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          {error}
        </p>
      )}

      {/* Conversations first: a tenant waiting on a reply is the thing on this
          screen with somebody at the other end of it. */}
      <PlatformPanel
        icon={MessageSquare}
        title="Conversations"
        description="One thread per tenant. They write from inside their own panel."
      >
        {/* A thread exists only once somebody has written, so a tenant we have
            never spoken to has no row here. Starting one from the tenant list is
            the way in — said here rather than left as a dead end. */}
        {!threads.length ? (
          <p className="text-sm text-plat-muted">
            No conversations yet. Open a tenant from the Tenants screen and send them a message to
            start one.
          </p>
        ) : (
          <ul className="divide-y divide-plat-line-soft rounded-md border border-plat-line-soft">
            {threads.map((thread) => (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => setOpenThread(thread)}
                  className={cn(
                    pressable,
                    'flex w-full flex-wrap items-center gap-3 px-3 py-3 text-left',
                    'hover:bg-white/[0.04]',
                  )}
                >
                  <MessageSquare
                    className="size-4 shrink-0 text-plat-dim"
                    strokeWidth={2}
                    aria-hidden="true"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-plat-text">
                      {thread.tenantName}
                      {/* Unread is the whole reason to look at this list, so it
                          is the loudest thing in the row. */}
                      {thread.unread > 0 && (
                        <PlatformBadge tone="danger" size="sm">
                          {thread.unread} new
                        </PlatformBadge>
                      )}
                      {thread.status === 'resolved' && (
                        <PlatformBadge tone="neutral" size="sm">
                          resolved
                        </PlatformBadge>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-plat-dim">
                      {thread.preview || 'No messages yet'}
                    </span>
                  </span>

                  {thread.lastMessageAt && (
                    <span className="shrink-0 text-xs text-plat-dim">
                      {dateTime(thread.lastMessageAt)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </PlatformPanel>

      <div className="mt-3" />

      {/* Open sessions are separated rather than merely sorted: "is anybody
          inside a customer's business right now" is a different question from
          "what happened last week", and a single list answers neither well. */}
      <PlatformPanel
        icon={ShieldAlert}
        title="Inside a business now"
        description={
          live.length
            ? 'These operators currently have access to a tenant’s records.'
            : 'Nobody is inside a tenant’s business.'
        }
      >
        {!live.length ? (
          <p className="text-sm text-plat-muted">
            Nothing open. Access ends on its own when a grant runs out.
          </p>
        ) : (
          <ul className="divide-y divide-plat-line-soft rounded-md border border-plat-line-soft">
            {live.map((grant) => (
              <GrantRow
                key={grant.id}
                grant={grant}
                onRevoke={revoke}
                isRevoking={revokeImpersonation.isPending}
              />
            ))}
          </ul>
        )}
      </PlatformPanel>

      <div className="mt-3">
        <PlatformPanel icon={LifeBuoy} title="Earlier sessions">
          {!past.length ? (
            <PlatformEmpty
              icon={LifeBuoy}
              title="No support sessions yet"
              body="Stepping into a business from the tenant list records it here, and in that business's own activity log."
            />
          ) : (
            <ul className="divide-y divide-plat-line-soft rounded-md border border-plat-line-soft">
              {past.map((grant) => (
                <GrantRow key={grant.id} grant={grant} onRevoke={revoke} isRevoking={false} />
              ))}
            </ul>
          )}
        </PlatformPanel>
      </div>

      <PlatformModal
        open={Boolean(openThread)}
        onClose={() => setOpenThread(null)}
        title={openThread?.tenantName ?? ''}
        size="lg"
        align="top"
      >
        {openThread && (
          <ThreadPanel
            tenantId={openThread.tenant}
            tenantName={openThread.tenantName}
            onClose={() => setOpenThread(null)}
          />
        )}
      </PlatformModal>
    </>
  );
}

export default SuperAdminSupportPage;
