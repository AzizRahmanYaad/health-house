'use client';

import { useActionState } from 'react';
import Icon from '@/components/Icon';
import { AlertBox } from '@/components/ui';
import { loginAction, type LoginState } from './actions';

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { error: '', email: '' });

  return (
    <>
      {state.error ? <AlertBox type="error">{state.error}</AlertBox> : null}

      <form action={action} noValidate>
        <input type="hidden" name="next" value={next} />

        <div className="field">
          <label htmlFor="email">Email address</label>
          <div className="input-icon">
            <Icon name="mail" />
            <input className="input" type="email" id="email" name="email" defaultValue={state.email}
                   placeholder="you@example.com" autoComplete="username" required autoFocus />
          </div>
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="input-icon">
            <Icon name="lock" />
            <input className="input" type="password" id="password" name="password"
                   placeholder="••••••••" autoComplete="current-password" required />
          </div>
        </div>

        <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={pending}>
          <Icon name="arrow-right" /> {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </>
  );
}
