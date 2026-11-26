import Link from 'next/link';

export default function NotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-screen bg-[#09090b] text-[#f4f4f5] flex flex-col items-center justify-center px-6 py-16 text-center"
    >
      <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3">404</p>
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
        Page Not Found
      </h1>
      <p className="text-sm text-[#a1a1aa] max-w-md mb-8">
        The page or escrow record you requested could not be found.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
        >
          Back to Home
        </Link>
        <Link
          href="/projects"
          className="px-5 py-2.5 rounded-xl bg-[#18181b] hover:bg-[#27272a] text-white text-sm font-semibold border border-[#27272a] transition-colors"
        >
          Go to Projects
        </Link>
      </div>
    </main>
  );
}
