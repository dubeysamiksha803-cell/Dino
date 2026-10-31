type Profile = {
  id: string;
  name: string;
  handle: string;
  avatarUrl?: string;
  bannerUrl?: string;
  bio?: string;
  location?: string;
  website?: string;
};

import { MapPin, Link as LinkIcon } from "lucide-react";

type Stats = {
  posts?: number;
  followers?: number;
  following?: number;
};

export default function ProfileView({
  profile,
  stats,
  actions,
  children,
}: {
  profile?: Profile | null;
  stats?: Stats | null;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  if (!profile) {
    return null;
  }

  return (
    <section className="mx-auto max-w-3xl">
      {/* Cover Photo - Minimal */}
      <div className="relative">
        <div className="relative h-36 w-full overflow-hidden rounded-xl bg-gradient-to-br from-[#1e3a5f] to-[#0f2744] sm:h-44">
          {profile.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.bannerUrl} alt="banner" className="h-full w-full object-cover opacity-80" />
          ) : null}

          {/* Actions */}
          {actions && (
            <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="absolute -bottom-12 left-6">
          <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-black bg-[#0a0a0a] shadow-xl">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt={profile.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#1e3a5f] text-3xl font-bold text-white/80">
                {profile.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile Info */}
      <div className="mt-16 px-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{profile.name}</h1>
            <p className="mt-0.5 text-slate-500">@{profile.handle}</p>
          </div>

          {/* Stats */}
          {stats && (
            <div className="flex gap-6">
              {typeof stats.posts === 'number' && (
                <div className="text-center">
                  <div className="text-xl font-bold text-white">{stats.posts}</div>
                  <div className="text-xs text-slate-500">Posts</div>
                </div>
              )}
              {typeof stats.followers === 'number' && (
                <div className="text-center">
                  <div className="text-xl font-bold text-white">{stats.followers}</div>
                  <div className="text-xs text-slate-500">Followers</div>
                </div>
              )}
              {typeof stats.following === 'number' && (
                <div className="text-center">
                  <div className="text-xl font-bold text-white">{stats.following}</div>
                  <div className="text-xs text-slate-500">Following</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="mt-4 text-[15px] leading-relaxed text-slate-300">
            {profile.bio}
          </p>
        )}

        {/* Location & Website */}
        {(profile.location || profile.website) && (
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500">
            {profile.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                <span>{profile.location}</span>
              </div>
            )}
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-sky-400 hover:underline"
              >
                <LinkIcon className="h-4 w-4" />
                <span>{profile.website.replace(/^https?:\/\//, '')}</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Content (Tabs and Posts) */}
      {children && (
        <div className="mt-8 px-6">
          {children}
        </div>
      )}
    </section>
  );
}
