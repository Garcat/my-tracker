'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, LockKeyhole } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { checkSession, login } from '@/lib/auth-api';

type GateStatus = 'checking' | 'locked' | 'unlocked';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<GateStatus>('checking');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    checkSession().then(valid => {
      if (!cancelled) setStatus(valid ? 'unlocked' : 'locked');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status === 'locked') inputRef.current?.focus();
  }, [status]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password || submitting) return;

    setSubmitting(true);
    setError(null);
    const result = await login(password);
    setSubmitting(false);

    if (result.ok) {
      setPassword('');
      setStatus('unlocked');
      return;
    }

    if (result.status === 401) {
      setError('密码不正确，请重试');
      setPassword('');
      inputRef.current?.focus();
    } else if (result.status === 429) {
      setError('尝试次数过多，请稍后再试');
    } else {
      setError('验证失败，请稍后重试');
    }
  };

  if (status === 'unlocked') return <>{children}</>;

  if (status === 'checking') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          正在验证访问权限…
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            <LockKeyhole className="h-5 w-5 text-muted-foreground" aria-hidden />
          </div>
          <div className="space-y-1.5">
            <CardTitle>运单追踪</CardTitle>
            <CardDescription>请输入访问密码后查看运单列表</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="access-password" className="text-sm font-medium">
                访问密码
              </label>
              <input
                id="access-password"
                ref={inputRef}
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                className="site-motion h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'access-password-error' : undefined}
              />
              {error ? (
                <p id="access-password-error" className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
            <Button
              type="submit"
              disabled={!password || submitting}
              className="w-full bg-[var(--site-accent)] text-[var(--site-on-accent)] hover:brightness-110"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  正在验证
                </>
              ) : (
                '进入'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
