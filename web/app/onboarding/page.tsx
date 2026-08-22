'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { UserProfile } from '../../lib/types';
import type { DecisionSnapshot } from '../../lib/types';

interface StoredCheck {
  profile: UserProfile;
  decisions: DecisionSnapshot[];
  created_at: string;
}

const EMPTY: Partial<UserProfile> = {
  age: undefined,
  employment_status: undefined,
  monthly_income: undefined,
  assets_total: undefined,
  has_car: false,
  has_property: false,
  children: undefined,
  insurance_months: undefined,
  single_parent: false,
  student: false,
  in_vocational_training: false,
  receives_buergergeld: false,
  receives_alg1: false,
  starting_self_employment: false,
  business_registered: false,
  business_plan: false,
  newborn_child: false,
  pflegegrad: undefined,
  working_hours_reduced: false,
  employer_insolvent: false,
  heating_cost_high: false,
};

const STATUS_LABEL: Record<DecisionSnapshot['status'], string> = {
  eligible: 'kommt grundsätzlich in Betracht',
  not_eligible: 'nach bekannten Voraussetzungen nicht in Betracht kommend',
  unclear: 'nicht abschließend beurteilbar',
};

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState<Partial<UserProfile>>(EMPTY);
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optional account creation (only when Supabase is configured)
  const [config, setConfig] = useState<{ supabaseConfigured: boolean } | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [authOk, setAuthOk] = useState(false);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((c) => setConfig(c))
      .catch(() => setConfig({ supabaseConfigured: false }));
  }, []);

  const set = (key: keyof UserProfile, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function createAccount(e: React.FormEvent) {
    e.preventDefault();
    setAuthMsg(null);
    setAuthOk(false);
    if (!terms) {
      setAuthMsg('Bitte akzeptieren Sie zuerst die Hinweise zur Beratung (Checkbox unten).');
      return;
    }
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword, accepted_terms: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Registrierung fehlgeschlagen');
      localStorage.setItem('foerderfinder.user_id', data.user_id);
      setAuthOk(true);
      setAuthMsg(`Konto für ${data.email} angelegt.`);
    } catch (err) {
      setAuthMsg(err instanceof Error ? err.message : 'Unbekannter Fehler');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!terms) {
      setError('Bitte akzeptieren Sie den Hinweis zur Beratung, um fortzufahren.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/decisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: form,
          user_id: localStorage.getItem('foerderfinder.user_id') ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Fehler bei der Prüfung');
      const stored: StoredCheck = {
        profile: form as UserProfile,
        decisions: data.decisions,
        created_at: new Date().toISOString(),
      };
      localStorage.setItem('foerderfinder.check', JSON.stringify(stored));
      router.push('/results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold">Ihre Situation</h1>
      <p className="mt-1 text-sm text-slate-500">
        Beantworten Sie die Fragen so genau wie möglich. Alle Angaben werden nur
        für die Prüfung verwendet und dienen keiner Entscheidung.
      </p>

      {config?.supabaseConfigured && (
        <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-4">
          <h2 className="text-sm font-semibold text-teal-900">
            Optional: Konto erstellen (empfohlen)
          </h2>
          <p className="mt-1 text-xs text-teal-800">
            Mit einem Konto werden Ihre Prüfungsergebnisse gespeichert und Sie
            können die Beratung später fortsetzen. Die Registrierung erfordert
            Ihre Zustimmung zu den Hinweisen unten.
          </p>
          <form onSubmit={createAccount} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block flex-1">
              <span className="text-xs font-medium">E-Mail</span>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-teal-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block flex-1">
              <span className="text-xs font-medium">Passwort (min. 8 Zeichen)</span>
              <input
                type="password"
                required
                minLength={8}
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-teal-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Konto erstellen
            </button>
          </form>
          {authMsg && (
            <p className={`mt-2 text-xs ${authOk ? 'text-teal-800' : 'text-rose-700'}`}>
              {authMsg}
            </p>
          )}
        </div>
      )}

      <form onSubmit={submit} className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Alter</span>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={form.age ?? ''}
            onChange={(e) => set('age', e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Beschäftigungsstatus</span>
          <select
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={form.employment_status ?? ''}
            onChange={(e) => set('employment_status', e.target.value || undefined)}
          >
            <option value="">– bitte wählen –</option>
            <option value="employed">angestellt</option>
            <option value="self_employed">selbstständig</option>
            <option value="freelancer">freiberuflich</option>
            <option value="unemployed">arbeitslos</option>
            <option value="student">Student/in</option>
            <option value="retired">in Rente</option>
            <option value="other">sonstiges</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium">Monatliches Nettoeinkommen (€)</span>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={form.monthly_income ?? ''}
            onChange={(e) =>
              set('monthly_income', e.target.value === '' ? undefined : Number(e.target.value))
            }
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Vermögen gesamt (€)</span>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={form.assets_total ?? ''}
            onChange={(e) =>
              set('assets_total', e.target.value === '' ? undefined : Number(e.target.value))
            }
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">
            Pflichtversicherungsmonate (letzte 30 Monate)
          </span>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={form.insurance_months ?? ''}
            onChange={(e) =>
              set('insurance_months', e.target.value === '' ? undefined : Number(e.target.value))
            }
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Kinder</span>
          <input
            type="number"
            min={0}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={form.children ?? ''}
            onChange={(e) =>
              set('children', e.target.value === '' ? undefined : Number(e.target.value))
            }
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Pflegegrad (falls vorhanden)</span>
          <input
            type="number"
            min={0}
            max={5}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={form.pflegegrad ?? ''}
            onChange={(e) =>
              set('pflegegrad', e.target.value === '' ? undefined : Number(e.target.value))
            }
          />
        </label>

        <div className="flex flex-col gap-2 text-sm sm:col-span-2">
          {(
            [
              ['has_car', 'Ich besitze ein Auto'],
              ['has_property', 'Ich besitze Wohneigentum'],
              ['single_parent', 'Ich bin alleinerziehend'],
              ['student', 'Ich bin Student/in'],
              ['in_vocational_training', 'Ich bin in beruflicher Ausbildung'],
              ['receives_buergergeld', 'Ich erhalte bereits Bürgergeld'],
              ['receives_alg1', 'Ich erhalte bereits Arbeitslosengeld I'],
              ['starting_self_employment', 'Ich plane eine Selbstständigkeit'],
              ['business_registered', 'Mein Unternehmen ist angemeldet'],
              ['business_plan', 'Ich habe einen Businessplan'],
              ['newborn_child', 'Ich habe ein neugeborenes Kind'],
              ['working_hours_reduced', 'Meine Arbeitszeit ist reduziert (Kurzarbeit)'],
              ['employer_insolvent', 'Mein Arbeitgeber ist insolvent'],
              ['heating_cost_high', 'Meine Heizkosten sind sehr hoch'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(form[key])}
                onChange={(e) => set(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:col-span-2">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="mt-1"
            />
            <span>
              Ich verstehe, dass dies <strong>keine Rechts- oder Förderberatung</strong>{' '}
              ist und <strong>keine Garantie</strong> auf eine Förderung besteht. Die
              Entscheidung trifft ausschließlich die zuständige Stelle.
            </span>
          </label>
        </div>

        {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-teal-700 px-6 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:opacity-50 sm:col-span-2"
        >
          {loading ? 'Wird geprüft…' : 'Prüfung starten'}
        </button>
      </form>

      {loading && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <p className="font-semibold">{STATUS_LABEL.eligible}</p>
          <p className="mt-1">
            Die Prüfung läuft über die hinterlegten Regeln. Die künstliche Intelligenz
            ist bei der Prüfung nicht beteiligt.
          </p>
        </div>
      )}
    </main>
  );
}
