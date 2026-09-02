import { useState } from 'react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useAuth, useConfirmedSignOut } from '@/hooks/useAuth';
import useUiStore from '@/store/uiStore';

/**
 * The one confirmation in front of every Sign out button.
 *
 * Mounted once at the app root. The four buttons that offer sign out (account
 * menu, account layout, mobile drawer, admin sidebar) all call `useSignOut`,
 * which raises a flag on the UI store; this reads it. A confirmation each
 * button had to remember for itself is one the fifth button would forget.
 *
 * `info` rather than `danger`: signing out costs the session and whatever is
 * half-filled on the page, and it is undone by signing back in. It is not a
 * destroyed record, and dressing it in the red used for deletions would spend
 * the alarm this app keeps for things that really cannot be taken back.
 */
export function SignOutConfirm() {
  const open = useUiStore((s) => s.signOutConfirmOpen);
  const close = useUiStore((s) => s.closeSignOutConfirm);
  const signOut = useConfirmedSignOut();
  const { user } = useAuth();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);

    try {
      await signOut();
      close();
    } catch (caught) {
      // The session may well be gone server-side even on a failure, but saying
      // so would be a guess. Report what happened and leave the dialog open so
      // the choice is still the viewer's.
      setError(caught?.message ?? 'Could not sign out. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onClose={busy ? () => {} : close}
      onConfirm={handleConfirm}
      title="Sign out?"
      body={
        user?.displayName
          ? `You are signed in as ${user.displayName}. You will need your email and password to sign back in.`
          : 'You will need your email and password to sign back in.'
      }
      // The cart is the thing a buyer would most fear losing here, and it is
      // exactly the thing that survives — worth saying, because otherwise the
      // safe choice looks like staying signed in.
      consequence="Your cart is saved to your account and will still be there next time."
      confirmLabel="Sign out"
      cancelLabel="Stay signed in"
      tone="info"
      loading={busy}
      error={error}
    />
  );
}

export default SignOutConfirm;
