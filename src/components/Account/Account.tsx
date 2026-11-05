import { useEffect, useRef, useState, type FormEvent } from 'react';
import { authClient } from '../../lib/auth-client';
import './account.css';

type Mode = 'sign-in' | 'sign-up';

function AccountDialog({
  initialMode,
  initialError,
  onClose,
}: {
  initialMode: Mode;
  initialError: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState(initialMode);
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const [google, setGoogle] = useState<boolean | null>(null);
  const [providerError, setProviderError] = useState(false);
  const [providerAttempt, setProviderAttempt] = useState(0);
  const signingUp = mode === 'sign-up';

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element?.showModal();
    return () => {
      element?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setProviderError(false);
    fetch('/api/auth/providers', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Providers unavailable');
        const providers = await response.json();
        if (typeof providers.google !== 'boolean') throw new Error('Invalid providers');
        setGoogle(providers.google);
      })
      .catch(() => {
        if (!controller.signal.aborted) setProviderError(true);
      });
    return () => controller.abort();
  }, [providerAttempt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const email = String(values.get('email')).trim();
    const password = String(values.get('password'));
    const name = String(values.get('name') || '').trim();
    if (signingUp && !name) {
      setError('Please enter your name.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const result = signingUp
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(
          result.error.status === 429
            ? 'Too many attempts. Please wait a minute and try again.'
            : result.error.message || 'Unable to sign in. Please try again.',
        );
      } else {
        await authClient.getSession({ fetchOptions: { throw: true } });
        onClose();
      }
    } catch {
      setError('We could not reach the account service. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setError('');
    setBusy(true);
    try {
      const result = await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/',
        errorCallbackURL: '/?authError=google',
      });
      if (result.error) {
        setError(
          result.error.status === 429
            ? 'Too many attempts. Please wait a minute and try again.'
            : 'Google sign-in is unavailable right now. Please try again.',
        );
        setBusy(false);
      }
    } catch {
      setError('We could not reach Google sign-in. Please try again.');
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="account-dialog"
      aria-labelledby="account-title"
      aria-describedby="account-description"
      onCancel={onClose}
    >
      <button
        className="account-close"
        type="button"
        aria-label="Close account dialog"
        onClick={onClose}
      >
        ×
      </button>
      <p className="eyebrow">Your place in Gallerify</p>
      <h2 id="account-title">{signingUp ? 'Make yourself at home.' : 'Welcome back.'}</h2>
      <p id="account-description" className="account-description">
        {signingUp
          ? 'Create your account with Google or your email.'
          : 'Sign in with Google or your email to continue.'}
      </p>
      <button
        className="account-button google-button"
        type="button"
        disabled={busy || !google}
        onClick={signInWithGoogle}
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.2h6.7c3.9-3.6 6-8.9 6-15.1Z"
          />
          <path
            fill="#34A853"
            d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.2c-1.8 1.2-4.1 2-6.8 2-5.3 0-9.8-3.6-11.4-8.4H5.7v5.4A20.4 20.4 0 0 0 24 44Z"
          />
          <path
            fill="#FBBC05"
            d="M12.6 27.5a12.2 12.2 0 0 1 0-7V15H5.7a20 20 0 0 0 0 18l6.9-5.5Z"
          />
          <path
            fill="#EA4335"
            d="M24 12.1c3 0 5.7 1 7.8 3.1l5.9-5.9A19.7 19.7 0 0 0 24 4 20.4 20.4 0 0 0 5.7 15l6.9 5.5c1.6-4.8 6.1-8.4 11.4-8.4Z"
          />
        </svg>
        Continue with Google
      </button>
      {google === false && (
        <p className="account-hint">
          Google sign-in is not available yet. You can use email below.
        </p>
      )}
      {providerError && (
        <p className="account-hint" role="alert">
          Could not load sign-in options.{' '}
          <button
            className="account-link"
            type="button"
            onClick={() => setProviderAttempt((n) => n + 1)}
          >
            Try again
          </button>
        </p>
      )}
      <div className="account-divider">
        <span>or use your email</span>
      </div>
      <form onSubmit={submit} key={mode} aria-busy={busy}>
        <fieldset disabled={busy}>
          {signingUp && (
            <label htmlFor="account-name">
              Your name
              <input id="account-name" name="name" autoComplete="name" maxLength={100} required />
            </label>
          )}
          <label htmlFor="account-email">
            Email
            <input
              id="account-email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>
          <label htmlFor="account-password">
            Password
            <input
              id="account-password"
              name="password"
              type="password"
              autoComplete={signingUp ? 'new-password' : 'current-password'}
              minLength={signingUp ? 12 : undefined}
              maxLength={128}
              aria-describedby={signingUp ? 'password-hint' : undefined}
              required
            />
          </label>
          {signingUp && (
            <p id="password-hint" className="account-hint">
              Use at least 12 characters.
            </p>
          )}
          {error && (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
          <button className="account-button account-primary" type="submit">
            {busy ? 'Please wait…' : signingUp ? 'Create account' : 'Sign in'}
          </button>
        </fieldset>
      </form>
      <p className="account-switch">
        {signingUp ? 'Already have an account? ' : 'New to Gallerify? '}
        <button
          className="account-link"
          type="button"
          disabled={busy}
          onClick={() => {
            setMode(signingUp ? 'sign-in' : 'sign-up');
            setError('');
          }}
        >
          {signingUp ? 'Sign in' : 'Create an account'}
        </button>
      </p>
    </dialog>
  );
}

export default function Account() {
  const { data: session, isPending, error: sessionError, refetch } = authClient.useSession();
  const [mode, setMode] = useState<Mode | null>(null);
  const [error, setError] = useState('');
  const [oauthError, setOauthError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('authError')) {
      setOauthError('Google sign-in was not completed. Please try again or use your email.');
      setMode('sign-in');
      url.searchParams.delete('authError');
      url.searchParams.delete('error');
      url.searchParams.delete('error_description');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  async function signOut() {
    setSigningOut(true);
    setError('');
    try {
      const result = await authClient.signOut();
      if (result.error) setError('Could not sign out. Please try again.');
    } catch {
      setError('Could not sign out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="account-area">
      {isPending ? (
        <span className="account-hint" role="status">
          Loading account…
        </span>
      ) : sessionError ? (
        <button className="account-link" type="button" onClick={() => refetch()}>
          Retry account connection
        </button>
      ) : session ? (
        <div className="account-actions">
          <span className="account-name" title={session.user.email}>
            {session.user.name}
          </span>
          <button className="account-link" type="button" disabled={signingOut} onClick={signOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      ) : (
        <div className="account-actions">
          <button className="account-link" type="button" onClick={() => setMode('sign-in')}>
            Sign in
          </button>
          <button
            className="account-button account-primary account-create"
            type="button"
            onClick={() => setMode('sign-up')}
          >
            Create account
          </button>
        </div>
      )}
      {error && (
        <p className="account-error" role="alert">
          {error}
        </p>
      )}
      {mode && (
        <AccountDialog
          initialMode={mode}
          initialError={oauthError}
          onClose={() => {
            setMode(null);
            setOauthError('');
          }}
        />
      )}
    </div>
  );
}
