type Featured = { title: string; subtitle?: string; description?: string; ctaLabel?: string };
type Tag = string;
type MosaicItem = { src: string; alt?: string };
type Community = { name: string; actionLabel?: string };
type Creator = { handle: string; description?: string; avatarUrl?: string };
type QuickLink = { label: string; href: string };

export default function BentoGrid({
  featured,
  trending,
  mosaic,
  communities,
  creator,
  links,
}: {
  featured?: Featured | null;
  trending?: Tag[] | null;
  mosaic?: MosaicItem[] | null;
  communities?: Community[] | null;
  creator?: Creator | null;
  links?: QuickLink[] | null;
}) {
  const hasAny = Boolean((featured) || (trending && trending.length) || (mosaic && mosaic.length) || (communities && communities.length) || (creator) || (links && links.length));
  if (!hasAny) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="mb-6 text-xl font-semibold text-zinc-100">Explore</h1>
      <div className="grid auto-rows-[140px] md:auto-rows-[170px] lg:auto-rows-[190px] grid-cols-12 gap-4">
        {featured && (
          <div className="group col-span-12 row-span-2 h-full overflow-hidden rounded-2xl border border-zinc-800/60 bg-gradient-to-br from-indigo-600/20 via-purple-600/10 to-transparent p-6 transition-transform transition-colors transition-shadow duration-200 hover:-translate-y-0.5 hover:border-indigo-400/50 hover:bg-gradient-to-br hover:from-indigo-600/30 hover:via-purple-600/20 hover:to-zinc-900/80 hover:shadow-[0_18px_45px_rgba(15,23,42,0.75)]">
            <div className="flex h-full items-end justify-between">
              <div>
                {featured.subtitle && <div className="text-sm font-medium text-zinc-300">{featured.subtitle}</div>}
                <div className="mt-1 text-2xl font-semibold text-zinc-100">{featured.title}</div>
                {featured.description && <p className="mt-2 max-w-xl text-sm text-zinc-400">{featured.description}</p>}
              </div>
              {featured.ctaLabel && <button className="h-fit rounded-full bg-zinc-200/90 px-4 py-2 text-xs font-medium text-zinc-900 hover:bg-white">{featured.ctaLabel}</button>}
            </div>
          </div>
        )}

        {trending && trending.length > 0 && (
          <div className="group col-span-4 row-span-2 h-full overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900/60 p-4 transition-transform transition-colors transition-shadow duration-200 hover:-translate-y-0.5 hover:border-zinc-600 hover:bg-zinc-900/80 hover:shadow-[0_16px_40px_rgba(0,0,0,0.7)] lg:col-span-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Trending</div>
            <ul className="space-y-2 text-sm text-zinc-200">
              {trending.map((t) => (
                <li key={t} className="rounded-lg bg-zinc-950/40 px-3 py-2">{t}</li>
              ))}
            </ul>
          </div>
        )}

        {mosaic && mosaic.length > 0 && (
          <div className="group col-span-8 row-span-4 h-full overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900/60 p-3 transition-transform transition-colors transition-shadow duration-200 hover:-translate-y-0.5 hover:border-zinc-600 hover:bg-zinc-900/80 hover:shadow-[0_18px_45px_rgba(0,0,0,0.75)] lg:col-span-6">
            <div className="grid h-full grid-cols-6 grid-rows-6 gap-2">
              {mosaic.slice(0, 1).map((m, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={`hero-${i}`} src={m.src} alt={m.alt ?? ''} className="col-span-4 row-span-6 h-full w-full rounded-lg object-cover transition-transform duration-200 group-hover:scale-[1.02]" />
              ))}
              {mosaic.slice(1, 3).map((m, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={`side-${i}`} src={m.src} alt={m.alt ?? ''} className="col-span-2 row-span-3 h-full w-full rounded-lg object-cover transition-transform duration-200 group-hover:scale-[1.02]" />
              ))}
            </div>
          </div>
        )}

        {communities && communities.length > 0 && (
          <div className="group col-span-12 row-span-2 h-full overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900/60 p-4 transition-transform transition-colors transition-shadow duration-200 hover:-translate-y-0.5 hover:border-zinc-600 hover:bg-zinc-900/80 hover:shadow-[0_16px_40px_rgba(0,0,0,0.75)] lg:col-span-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Suggested Communities</div>
            <ul className="space-y-2 text-sm">
              {communities.map((c) => (
                <li key={c.name} className="flex items-center justify-between rounded-lg bg-zinc-950/40 px-3 py-2 text-zinc-200">
                  <span>{c.name}</span>
                  {c.actionLabel && <button className="rounded-md bg-zinc-200 px-2 py-1 text-xs font-medium text-zinc-900 hover:bg-white">{c.actionLabel}</button>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {creator && (
          <div className="group col-span-12 row-span-2 h-full overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900/60 p-4 transition-transform transition-colors transition-shadow duration-200 hover:-translate-y-0.5 hover:border-zinc-600 hover:bg-zinc-900/80 hover:shadow-[0_18px_45px_rgba(0,0,0,0.8)] lg:col-span-6">
            <div className="flex h-full items-center gap-4">
              <div className="h-16 w-16 flex-none overflow-hidden rounded-full bg-zinc-800">
                {creator.avatarUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={creator.avatarUrl} alt={creator.handle} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-100">{creator.handle}</div>
                {creator.description && <div className="text-xs text-zinc-400">{creator.description}</div>}
              </div>
            </div>
          </div>
        )}

        {links && links.length > 0 && (
          <div className="group col-span-12 row-span-2 h-full overflow-hidden rounded-2xl border border-zinc-800/60 bg-zinc-900/60 p-4 transition-transform transition-colors transition-shadow duration-200 hover:-translate-y-0.5 hover:border-zinc-600 hover:bg-zinc-900/80 hover:shadow-[0_16px_40px_rgba(0,0,0,0.75)] lg:col-span-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Quick Links</div>
            <div className="grid grid-cols-2 gap-2 text-sm text-zinc-200">
              {links.map((l) => (
                <a key={l.href + l.label} className="rounded-lg bg-zinc-950/40 px-3 py-2 hover:bg-zinc-950/60" href={l.href}>{l.label}</a>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
