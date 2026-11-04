"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { API_MODE } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { Button, TextInput } from "@/components/ui/primitives";
import { EnvTag, Wordmark } from "@/components/shell/top-bar";
import { errorMessage } from "@/components/guard/request-parts";

function LoginForm() {
  const api = useApi();
  const router = useRouter();
  const next = useSearchParams().get("next") || "/requests";
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.signIn(passcode);
      router.replace(next.startsWith("/") ? next : "/requests");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col justify-center gutter">
      <div className="flex items-center justify-between">
        <Link href="/"><Wordmark /></Link>
        <EnvTag />
      </div>
      <h1 className="mt-10 t-display-m">Operator sign-in</h1>
      <form onSubmit={submit} className="mt-6 space-y-5">
        <TextInput label="Passcode" type="password" autoComplete="current-password" required value={passcode} onChange={(e) => setPasscode(e.target.value)} error={error} autoFocus />
        <Button variant="primary" type="submit" loading={busy} className="w-full">Sign in</Button>
      </form>
      <p className="mt-6 t-small text-muted">
        {API_MODE === "mock" ? <>Mock passcodes: <span className="font-mono text-ink-2">reviewer</span> or <span className="font-mono text-ink-2">operator</span>.</> : "Demo passcodes are in the README."}
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
