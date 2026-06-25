import { createClient } from "@/lib/supabase";

const subjectStyles: Record<string, string> = {
  Physics: "bg-blue-600 text-blue-50",
  Biology: "bg-emerald-600 text-emerald-50",
  Mathematics: "bg-violet-600 text-violet-50",
  "Computer Science": "bg-orange-600 text-orange-50",
  Chemistry: "bg-red-600 text-red-50",
};

const masteryScores: Record<string, number> = {
  Strong: 4,
  Proficient: 3,
  Developing: 2,
  Introduced: 1,
  "In Progress": 0,
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getMasteryLabel(value?: string | null) {
  return value && masteryScores[value] !== undefined ? value : "In Progress";
}

function getMasteryPercentage(value?: string | null) {
  const score = value && masteryScores[value] !== undefined ? masteryScores[value] : 0;
  return Math.round((score / 4) * 100);
}

function getProgressBarWidth(value?: string | null) {
  return `${getMasteryPercentage(value)}%`;
}

export default async function DashboardPage() {
  const supabase = createClient();
  const { data, error } = await supabase.from("concepts").select("*").order("last_updated", { ascending: false });

  const concepts = Array.isArray(data) ? data : [];
  const totalConcepts = concepts.length;
  const uniqueSubjects = new Set(concepts.map((concept) => concept.subject?.trim()).filter(Boolean)).size;

  const totalScore = concepts.reduce((sum, concept) => {
    const mastery = getMasteryLabel(concept.mastery_level);
    return sum + (masteryScores[mastery] ?? 0);
  }, 0);
  const averageMastery = totalConcepts > 0 ? totalScore / totalConcepts : 0;
  const averageMasteryPercent = Math.round((averageMastery / 4) * 100);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
      <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-950/20">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Dashboard</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-100">Study progress overview</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Review saved concepts, mastery progress, and review next steps across your study topics.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
              <p className="text-sm text-slate-400">Concepts studied</p>
              <p className="mt-3 text-3xl font-semibold text-white">{totalConcepts}</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
              <p className="text-sm text-slate-400">Unique subjects</p>
              <p className="mt-3 text-3xl font-semibold text-white">{uniqueSubjects}</p>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
              <p className="text-sm text-slate-400">Average mastery</p>
              <p className="mt-3 text-3xl font-semibold text-white">{averageMasteryPercent}%</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6">
        {error ? (
          <div className="rounded-3xl border border-rose-500/30 bg-rose-500/5 p-6 text-rose-200">
            <p className="text-sm font-medium">Unable to load concepts.</p>
            <p className="mt-2 text-sm text-slate-400">{error.message ?? "Please check your Supabase configuration."}</p>
          </div>
        ) : concepts.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 text-slate-500">
            No saved concepts found yet.
          </div>
        ) : (
          concepts.map((concept) => {
            const subject = concept.subject ?? "Unknown";
            const mastery = getMasteryLabel(concept.mastery_level);
            const pillClass = subjectStyles[subject] ?? "bg-slate-700 text-slate-100";

            return (
              <details
                key={`${subject}-${concept.concept}`}
                className="group overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-sm shadow-slate-950/20"
              >
                <summary className="flex cursor-pointer flex-col gap-4 p-6 transition hover:bg-slate-900/90 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${pillClass}`}>
                        {subject}
                      </span>
                      <span className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1 text-xs font-semibold text-slate-200">
                        {formatDate(concept.last_updated)}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-slate-100">{concept.concept}</h3>
                      <p className="mt-1 text-sm text-slate-400">{concept.overview_gist ?? "No overview available."}</p>
                    </div>
                  </div>
                  <div className="flex min-w-[220px] flex-col gap-3 sm:items-end">
                    <span className="inline-flex rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                      {mastery}
                    </span>
                    <div className="w-full overflow-hidden rounded-full bg-slate-800/80 text-slate-500">
                      <div
                        className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                        style={{ width: getProgressBarWidth(concept.mastery_level) }}
                      />
                    </div>
                  </div>
                </summary>
                <div className="border-t border-slate-800 bg-slate-950/90 px-6 py-6 text-sm text-slate-300">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Strong areas</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                          {Array.isArray(concept.strong_areas) && concept.strong_areas.length > 0 ? (
                            concept.strong_areas.map((area: string) => (
                              <span key={area} className="rounded-full bg-emerald-600/20 px-3 py-1 text-emerald-200">
                                {area}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500">None listed</span>
                          )}
                        </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Weak areas</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {Array.isArray(concept.weak_areas) && concept.weak_areas.length > 0 ? (
                            concept.weak_areas.map((area: string) => (
                              <span key={area} className="rounded-full bg-rose-600/20 px-3 py-1 text-rose-200">
                                {area}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500">None listed</span>
                          )}
                        </div>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Next steps</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {Array.isArray(concept.next_steps) && concept.next_steps.length > 0 ? (
                            concept.next_steps.map((step: string) => (
                              <span key={step} className="rounded-full bg-sky-600/20 px-3 py-1 text-sky-200">
                                {step}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500">None listed</span>
                          )}
                        </div>
                    </div>
                  </div>
                </div>
              </details>
            );
          })
        )}
      </section>
    </main>
  );
}
