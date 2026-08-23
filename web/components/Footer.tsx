import Link from 'next/link';

/** Shared footer with legal links — rendered on every page. */
export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-6 py-6 text-xs text-slate-500 sm:flex-row sm:justify-between">
        <p>© {new Date().getFullYear()} FörderFinder — Orientierung, keine Beratung.</p>
        <nav className="flex gap-4">
          <Link href="/impressum" className="hover:text-teal-700">
            Impressum
          </Link>
          <Link href="/datenschutz" className="hover:text-teal-700">
            Datenschutz
          </Link>
          <Link href="/agb" className="hover:text-teal-700">
            AGB
          </Link>
        </nav>
      </div>
    </footer>
  );
}
