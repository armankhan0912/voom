import Link from "next/link";
import { SignInButton } from "@/components/sign-in-button";
import { VoomWordmark } from "@/components/voom-logo";

function RecordGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LinkGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13.5a4 4 0 0 0 5.7.3l2.6-2.6a4 4 0 0 0-5.6-5.7l-1.5 1.5" />
      <path d="M14 10.5a4 4 0 0 0-5.7-.3l-2.6 2.6a4 4 0 0 0 5.6 5.7l1.5-1.5" />
    </svg>
  );
}

function SparkGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 4.5 13.6 9l4.4 1.6-4.4 1.6L12 16.7l-1.6-4.5L6 10.6 10.4 9z" />
      <path d="M18.5 16.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: RecordGlyph,
    title: "Lightweight recording",
    body: "Capture your screen, camera, and mic from the Chrome extension. A small floating control handles pause, resume, and stop.",
  },
  {
    icon: LinkGlyph,
    title: "One link to share",
    body: "Every recording lands in private storage and becomes a link. Send it to anyone instead of scheduling another meeting.",
  },
  {
    icon: SparkGlyph,
    title: "AI that watches for you",
    body: "Each Voom gets a transcript, a summary with key points, and chapters. Click any timestamp to jump straight to that moment.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Record",
    body: "Pick your screen, camera, and mic, then hit record.",
  },
  {
    n: "02",
    title: "Share",
    body: "Your Voom uploads and turns into a link automatically.",
  },
  {
    n: "03",
    title: "Understand",
    body: "Read the summary, scan the transcript, jump by chapter.",
  },
];

export function LandingPage() {
  return (
    <div className="min-h-svh bg-voom-paper">
      <header className="sticky top-0 z-10 border-b border-voom-line bg-voom-paper/85 backdrop-blur-sm">
        <div className="mx-auto flex h-[72px] w-full max-w-[1080px] items-center justify-between px-5 lg:px-8">
          <Link href="/" className="inline-flex items-center">
            <VoomWordmark size={30} priority />
          </Link>
          <div className="flex items-center gap-1.5">
            <SignInButton variant="ghost">Sign in</SignInButton>
            <SignInButton>Get Voom free</SignInButton>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1080px] px-5 lg:px-8">
        <section className="relative isolate pt-20 pb-20 text-center lg:pt-28 lg:pb-28">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[380px] bg-[radial-gradient(55%_60%_at_50%_0%,#FFF3E8_0%,transparent_72%)]"
          />
          <span className="inline-flex items-center gap-2 rounded-full border border-voom-line bg-voom-surface px-3.5 py-1.5 text-[13px] font-medium text-voom-muted">
            <span className="size-1.5 rounded-full bg-voom-accent" />
            Screen, camera, and mic
          </span>

          <h1 className="mx-auto mt-7 max-w-[800px] text-[42px] leading-[1.05] font-semibold text-voom-ink sm:text-[56px] lg:text-[64px]">
            Record your screen.{" "}
            <span className="text-voom-accent">Share the understanding.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-[540px] text-[17px] leading-[1.7] text-voom-muted">
            Voom turns every recording into a link with an AI summary,
            transcript, and chapters - so no one has to watch it twice.
          </p>

          <div className="mt-9 flex items-center justify-center gap-3 [&_.voom-btn-primary]:h-12 [&_.voom-btn-primary]:px-6 [&_.voom-btn-secondary]:h-12 [&_.voom-btn-secondary]:px-6">
            <SignInButton>Get Voom free</SignInButton>
            <SignInButton variant="light">Sign in</SignInButton>
          </div>

          <p className="mt-5 text-sm text-voom-muted">
            Free to start · No credit card required
          </p>
        </section>

        <section className="border-t border-voom-line py-16 lg:py-24">
          <h2 className="max-w-[600px] text-3xl leading-[1.15] font-semibold text-voom-ink lg:text-[38px]">
            Everything after the recording, handled.
          </h2>
          <div className="mt-10 grid gap-5 lg:mt-14 lg:grid-cols-3 lg:gap-6">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="rounded-[16px] border border-voom-line bg-voom-surface p-6 lg:p-7"
                >
                  <span className="flex size-10 items-center justify-center rounded-[12px] bg-voom-soft text-voom-accent">
                    <Icon />
                  </span>
                  <h3 className="mt-5 text-[17px] font-semibold text-voom-ink">
                    {feature.title}
                  </h3>
                  <p className="mt-2.5 text-[15px] leading-[1.75] text-voom-muted">
                    {feature.body}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-t border-voom-line py-16 lg:py-24">
          <h2 className="text-3xl leading-[1.15] font-semibold text-voom-ink lg:text-[38px]">
            From recording to understanding.
          </h2>
          <ol className="mt-10 grid gap-8 lg:mt-14 lg:grid-cols-3 lg:gap-10">
            {STEPS.map((step) => (
              <li key={step.n} className="border-t border-voom-line pt-5">
                <p className="text-sm font-semibold tabular-nums text-voom-accent">
                  {step.n}
                </p>
                <h3 className="mt-3 text-[17px] font-semibold text-voom-ink">
                  {step.title}
                </h3>
                <p className="mt-2 text-[15px] leading-[1.75] text-voom-muted">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-voom-line py-16 lg:py-24">
          <div className="rounded-[20px] border border-voom-line bg-voom-soft px-6 py-14 text-center lg:px-10 lg:py-16">
            <h2 className="mx-auto max-w-[500px] text-3xl leading-[1.15] font-semibold text-voom-ink lg:text-[38px]">
              Send your next update as a Voom.
            </h2>
            <p className="mx-auto mt-4 max-w-[420px] text-base leading-[1.7] text-voom-muted">
              Record once, share the link, and let the summary do the rest.
            </p>
            <div className="mt-8 [&_.voom-btn-primary]:h-12 [&_.voom-btn-primary]:px-6">
              <SignInButton>Get Voom free</SignInButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-voom-line">
        <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-3 px-5 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <VoomWordmark size={22} />
          <p className="text-sm text-voom-muted">Record. Share. Understand.</p>
        </div>
      </footer>
    </div>
  );
}
