import Link from "next/link";
import { SignInButton } from "@/components/sign-in-button";
import { VoomWordmark } from "@/components/voom-logo";

const FEATURES = [
  {
    title: "Lightweight recording",
    body: "Capture your screen, camera, and mic from the Chrome extension. A small floating control handles pause, resume, and stop.",
  },
  {
    title: "One link to share",
    body: "Every recording lands in private storage and becomes a link. Send it to anyone instead of scheduling another meeting.",
  },
  {
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

const TRANSCRIPT_ROWS = [
  { time: "00:02", text: "Walking through the new onboarding flow." },
  { time: "00:14", text: "Here's the part that keeps confusing people." },
  { time: "00:31", text: "Two options — I'd pick the second one." },
];

function ProductPreview() {
  return (
    <div className="voom-card mx-auto w-full max-w-[1040px] p-3 sm:p-4">
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.72fr)]">
        <div className="relative aspect-video overflow-hidden rounded-[14px] bg-[#241b14]">
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-voom-surface/95">
              <svg
                viewBox="0 0 24 24"
                className="ml-0.5 size-5 fill-voom-accent"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7L8 5Z" />
              </svg>
            </span>
          </div>
          <div className="absolute inset-x-4 bottom-4 flex items-center gap-3">
            <span className="text-xs font-medium tabular-nums text-white/80">
              00:31
            </span>
            <span className="relative h-1 flex-1 rounded-full bg-white/25">
              <span className="absolute inset-y-0 left-0 w-[38%] rounded-full bg-white" />
            </span>
            <span className="text-xs font-medium tabular-nums text-white/60">
              01:22
            </span>
          </div>
        </div>

        <div className="rounded-[14px] border border-voom-line bg-voom-paper/50 p-4">
          <div className="flex gap-5 border-b border-voom-line pb-2.5 text-sm">
            <span className="-mb-[11px] border-b-2 border-voom-accent pb-2.5 font-medium text-voom-ink">
              Summary
            </span>
            <span className="text-voom-muted">Transcript</span>
            <span className="text-voom-muted">Chapters</span>
          </div>

          <p className="mt-4 rounded-[10px] bg-voom-soft px-3 py-3 text-sm leading-6 text-voom-ink">
            A walkthrough of the new onboarding flow, the step where users drop
            off, and the fix worth shipping first.
          </p>

          <p className="mt-4 text-[11px] font-semibold tracking-[0.14em] text-voom-muted uppercase">
            Transcript
          </p>
          <ul className="mt-2 space-y-2.5">
            {TRANSCRIPT_ROWS.map((row) => (
              <li key={row.time} className="flex gap-3 text-sm">
                <span className="shrink-0 font-semibold tabular-nums text-voom-accent">
                  {row.time}
                </span>
                <span className="leading-6 text-voom-muted">{row.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-svh bg-voom-paper">
      <header className="sticky top-0 z-10 border-b border-voom-line/70 bg-voom-paper/85 backdrop-blur-sm">
        <div className="mx-auto flex h-[72px] w-full max-w-[1120px] items-center justify-between px-5 lg:px-8">
          <Link href="/" className="inline-flex items-center">
            <VoomWordmark size={30} priority />
          </Link>
          <div className="flex items-center gap-1.5">
            <SignInButton variant="ghost">Sign in</SignInButton>
            <SignInButton>Get Voom free</SignInButton>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1120px] px-5 lg:px-8">
        <section className="pt-16 pb-14 text-center lg:pt-24 lg:pb-20">
          <h1 className="mx-auto max-w-[860px] text-[40px] leading-[1.06] font-bold tracking-[-0.04em] text-voom-ink sm:text-[56px] lg:text-[68px]">
            Record your screen.
            <br className="hidden sm:block" />{" "}
            <span className="text-voom-accent">Share the understanding.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[560px] text-lg leading-8 text-voom-muted">
            Voom turns every recording into a link with an AI summary,
            transcript, and chapters — so no one has to watch it twice.
          </p>
          <div className="mt-9 flex items-center justify-center gap-3 [&_.voom-btn-primary]:h-12 [&_.voom-btn-primary]:px-6 [&_.voom-btn-secondary]:h-12 [&_.voom-btn-secondary]:px-6">
            <SignInButton>Get Voom free</SignInButton>
            <SignInButton variant="light">Sign in</SignInButton>
          </div>
          <p className="mt-4 text-sm text-voom-muted">
            Free to start · Screen, camera, and mic
          </p>
        </section>

        <section className="pb-16 lg:pb-24">
          <ProductPreview />
        </section>

        <section className="border-t border-voom-line py-16 lg:py-20">
          <h2 className="max-w-[620px] text-3xl font-bold tracking-tight text-voom-ink lg:text-[40px] lg:leading-[1.15]">
            Everything after the recording, handled.
          </h2>
          <div className="mt-10 grid gap-6 lg:mt-12 lg:grid-cols-3 lg:gap-8">
            {FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="rounded-[18px] border border-voom-line bg-voom-surface p-6 lg:p-7"
              >
                <span className="block h-1 w-8 rounded-full bg-voom-accent" />
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-voom-ink">
                  {feature.title}
                </h3>
                <p className="mt-2.5 text-[15px] leading-7 text-voom-muted">
                  {feature.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-voom-line py-16 lg:py-20">
          <h2 className="text-3xl font-bold tracking-tight text-voom-ink lg:text-[40px] lg:leading-[1.15]">
            From recording to understanding.
          </h2>
          <ol className="mt-10 grid gap-8 lg:mt-12 lg:grid-cols-3 lg:gap-12">
            {STEPS.map((step) => (
              <li key={step.n} className="border-t border-voom-line pt-5">
                <p className="text-sm font-semibold tabular-nums text-voom-accent">
                  {step.n}
                </p>
                <h3 className="mt-3 text-lg font-semibold tracking-tight text-voom-ink">
                  {step.title}
                </h3>
                <p className="mt-2 text-[15px] leading-7 text-voom-muted">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-voom-line py-16 lg:py-20">
          <div className="rounded-[22px] border border-voom-line bg-voom-surface px-6 py-12 text-center lg:px-10 lg:py-16">
            <h2 className="mx-auto max-w-[520px] text-3xl font-bold tracking-tight text-voom-ink lg:text-[40px] lg:leading-[1.15]">
              Send your next update as a Voom.
            </h2>
            <p className="mx-auto mt-4 max-w-[440px] text-base leading-7 text-voom-muted">
              Record once, share the link, and let the summary do the rest.
            </p>
            <div className="mt-8 [&_.voom-btn-primary]:h-12 [&_.voom-btn-primary]:px-6">
              <SignInButton>Get Voom free</SignInButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-voom-line">
        <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 px-5 py-8 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <VoomWordmark size={22} />
          <p className="text-sm text-voom-muted">Record. Share. Understand.</p>
        </div>
      </footer>
    </div>
  );
}
