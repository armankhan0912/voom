import { SignInButton } from "@/components/sign-in-button";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-voom-paper">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <a href="#top" className="text-lg font-semibold">
          Voom
        </a>
        <nav className="hidden items-center gap-8 text-sm text-voom-muted md:flex">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
        </nav>
        <div className="flex items-center gap-4">
          <SignInButton variant="ghost">Sign in</SignInButton>
          <SignInButton>Get started</SignInButton>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-6xl px-6 pb-20">
        <section className="grid items-center gap-12 py-12 md:grid-cols-2 md:py-20">
          <div>
            <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">
              Record. Explain. Share.
            </h1>
            <p className="mt-5 max-w-md text-voom-muted">
              Capture your screen, keep a camera bubble on the page, and send a
              link in seconds.
            </p>
            <div className="mt-8">
              <SignInButton>Start recording</SignInButton>
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-3xl bg-voom-surface p-4">
              <div className="relative aspect-video overflow-hidden rounded-2xl bg-voom-ink">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-voom-ink">
                    <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6 fill-current" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 h-16 w-16 overflow-hidden rounded-full border-2 border-white bg-stone-400" />
              </div>
            </div>
            <p className="mt-4 text-sm text-voom-muted">
              Share your knowledge in seconds.
            </p>
          </div>
        </section>

        <section
          id="features"
          className="grid gap-8 rounded-3xl bg-voom-surface px-8 py-10 sm:grid-cols-2 lg:grid-cols-4"
        >
          {[
            { title: "Record anything", body: "Screen, tab, or window with optional mic." },
            { title: "Share instantly", body: "A public /voom link anyone can open." },
            { title: "Work together", body: "Walk through bugs, PRs, and product decisions." },
            { title: "Save time", body: "Skip the meeting. Send a Voom instead." },
          ].map((item) => (
            <div key={item.title}>
              <h2 className="font-medium">{item.title}</h2>
              <p className="mt-2 text-sm text-voom-muted">{item.body}</p>
            </div>
          ))}
        </section>

        <section id="how" className="mt-16 max-w-2xl">
          <h2 className="text-2xl font-semibold">How it works</h2>
          <ol className="mt-6 space-y-4 text-voom-muted">
            <li>1. Sign in and start a recording from Home or the Chrome extension.</li>
            <li>2. Pause or stop with the overlay on the tab you are presenting. Camera stays out of the file.</li>
            <li>3. Share the Voom link. Anyone with it can watch.</li>
          </ol>
        </section>
      </main>
    </div>
  );
}
