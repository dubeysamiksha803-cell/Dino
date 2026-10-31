"use client";

type Member = {
    userId: string;
    role: string;
    status: string;
    joinedAt: string | null;
    user: { id: string; username: string | null; avatar_url: string | null } | null;
};

export default function CommunityMembersRail({
    members,
    membersCount,
    communityName,
}: {
    members: Member[];
    membersCount: number | null;
    communityName: string;
}) {
    return (
        <aside className="sticky top-6 hidden h-fit w-72 shrink-0 xl:block">
            <div className="rounded-xl border border-zinc-800/50 bg-zinc-950 p-4">
                {/* Header */}
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-100">Members</h3>
                    <span className="text-xs text-zinc-500">
                        {membersCount !== null ? membersCount.toLocaleString() : members.length}
                    </span>
                </div>

                {/* Members List */}
                {members.length === 0 ? (
                    <div className="py-6 text-center text-xs text-zinc-500">
                        No members yet
                    </div>
                ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-track]:bg-transparent">
                        {members.slice(0, 20).map((m) => {
                            const name = m.user?.username ?? "Unknown";
                            const initial = (name[0] ?? "U").toUpperCase();
                            const isAdmin = m.role === "admin" || m.role === "owner";

                            return (
                                <a
                                    key={m.userId}
                                    href={m.user?.username ? `/u/${m.user.username}` : "#"}
                                    className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-800/50"
                                >
                                    {/* Avatar */}
                                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-zinc-700/50 bg-zinc-800">
                                        {m.user?.avatar_url ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={m.user.avatar_url}
                                                alt={name}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-zinc-400">
                                                {initial}
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="truncate text-sm font-medium text-zinc-200 group-hover:text-white">
                                                {name}
                                            </span>
                                            {isAdmin && (
                                                <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                                                    {m.role}
                                                </span>
                                            )}
                                        </div>
                                        {m.user?.username && (
                                            <div className="truncate text-xs text-zinc-500">
                                                @{m.user.username}
                                            </div>
                                        )}
                                    </div>
                                </a>
                            );
                        })}

                        {members.length > 20 && (
                            <div className="pt-2 text-center text-xs text-zinc-500">
                                +{members.length - 20} more members
                            </div>
                        )}
                    </div>
                )}

                {/* About Section */}
                <div className="mt-4 border-t border-zinc-800/50 pt-4">
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        About
                    </h4>
                    <p className="text-xs leading-relaxed text-zinc-400">
                        {communityName} community members and contributors.
                    </p>
                </div>
            </div>
        </aside>
    );
}
