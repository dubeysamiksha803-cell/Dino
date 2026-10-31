"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import Topbar from "@/components/dashboard/Topbar";
import Sidebar from "@/components/dashboard/Sidebar";
import { supabase } from "@/lib/supabaseClient";

type SettingsSection = "account" | "privacy" | "notifications" | "appearance";

export default function SettingsPage() {
    const router = useRouter();
    const [email, setEmail] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeSection, setActiveSection] = useState<SettingsSection>("account");
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Settings state
    const [settings, setSettings] = useState({
        // Account
        emailNotifications: true,
        twoFactorEnabled: false,
        // Privacy
        profileVisibility: "public" as "public" | "friends" | "private",
        showOnlineStatus: true,
        allowMessagesFrom: "everyone" as "everyone" | "friends" | "none",
        showActivityStatus: true,
        // Notifications
        pushNotifications: true,
        messageNotifications: true,
        mentionNotifications: true,
        followNotifications: true,
        likeNotifications: false,
        commentNotifications: true,
        // Appearance
        theme: "dark" as "light" | "dark" | "system",
        fontSize: "medium" as "small" | "medium" | "large",
        reducedMotion: false,
        autoDownloadMedia: true,
    });

    useEffect(() => {
        let mounted = true;
        (async () => {
            const { data } = await supabase.auth.getSession();
            const session = data.session;
            if (!session) {
                router.replace("/login");
                return;
            }
            if (mounted) {
                setEmail(session.user.email ?? null);
            }

            const uid = session.user.id;

            // Fetch all user settings from database
            const { data: userSettings } = await supabase
                .from("user_settings")
                .select(`
                    notifications_enabled,
                    push_notifications,
                    message_notifications,
                    mention_notifications,
                    follow_notifications,
                    like_notifications,
                    comment_notifications,
                    email_notifications,
                    profile_visibility,
                    show_online_status,
                    allow_messages_from,
                    show_activity_status,
                    dark_mode,
                    theme,
                    font_size,
                    reduced_motion,
                    auto_download_media,
                    two_factor_enabled
                `)
                .eq("user_id", uid)
                .maybeSingle();

            if (mounted) {
                if (userSettings) {
                    setSettings({
                        // Account
                        emailNotifications: userSettings.email_notifications ?? true,
                        twoFactorEnabled: userSettings.two_factor_enabled ?? false,
                        // Privacy
                        profileVisibility: (userSettings.profile_visibility as "public" | "friends" | "private") ?? "public",
                        showOnlineStatus: userSettings.show_online_status ?? true,
                        allowMessagesFrom: (userSettings.allow_messages_from as "everyone" | "friends" | "none") ?? "everyone",
                        showActivityStatus: userSettings.show_activity_status ?? true,
                        // Notifications
                        pushNotifications: userSettings.push_notifications ?? userSettings.notifications_enabled ?? true,
                        messageNotifications: userSettings.message_notifications ?? true,
                        mentionNotifications: userSettings.mention_notifications ?? true,
                        followNotifications: userSettings.follow_notifications ?? true,
                        likeNotifications: userSettings.like_notifications ?? false,
                        commentNotifications: userSettings.comment_notifications ?? true,
                        // Appearance
                        theme: (userSettings.theme as "light" | "dark" | "system") ?? (userSettings.dark_mode ? "dark" : "light"),
                        fontSize: (userSettings.font_size as "small" | "medium" | "large") ?? "medium",
                        reducedMotion: userSettings.reduced_motion ?? false,
                        autoDownloadMedia: userSettings.auto_download_media ?? true,
                    });
                }
                setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [router]);

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const { data } = await supabase.auth.getSession();
            const session = data.session;
            const uid = session?.user?.id;
            if (!uid) throw new Error("Not authenticated");

            // Save all settings to database using upsert
            const { error: saveError } = await supabase
                .from("user_settings")
                .upsert({
                    user_id: uid,
                    // Notifications
                    notifications_enabled: settings.pushNotifications,
                    push_notifications: settings.pushNotifications,
                    message_notifications: settings.messageNotifications,
                    mention_notifications: settings.mentionNotifications,
                    follow_notifications: settings.followNotifications,
                    like_notifications: settings.likeNotifications,
                    comment_notifications: settings.commentNotifications,
                    email_notifications: settings.emailNotifications,
                    // Privacy
                    profile_visibility: settings.profileVisibility,
                    show_online_status: settings.showOnlineStatus,
                    allow_messages_from: settings.allowMessagesFrom,
                    show_activity_status: settings.showActivityStatus,
                    // Appearance
                    dark_mode: settings.theme === "dark" || settings.theme === "system",
                    theme: settings.theme,
                    font_size: settings.fontSize,
                    reduced_motion: settings.reducedMotion,
                    auto_download_media: settings.autoDownloadMedia,
                    // Account
                    two_factor_enabled: settings.twoFactorEnabled,
                });

            if (saveError) throw saveError;

            setMessage({ type: "success", text: "Settings saved successfully!" });
            setTimeout(() => setMessage(null), 3000);
        } catch (err) {
            console.error("Save error:", err);
            setMessage({ type: "error", text: "Failed to save settings" });
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.replace("/login");
    };

    const sections: { id: SettingsSection; label: string; icon: ReactNode }[] = [
        {
            id: "account",
            label: "Account",
            icon: (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            ),
        },
        {
            id: "privacy",
            label: "Privacy",
            icon: (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
            ),
        },
        {
            id: "notifications",
            label: "Notifications",
            icon: (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
            ),
        },
        {
            id: "appearance",
            label: "Appearance",
            icon: (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
            ),
        },
    ];

    const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: (val: boolean) => void }) => (
        <button
            type="button"
            onClick={() => onChange(!enabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? "bg-indigo-600" : "bg-zinc-700"
                }`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"
                    }`}
            />
        </button>
    );

    const Select = ({
        value,
        options,
        onChange,
    }: {
        value: string;
        options: { value: string; label: string }[];
        onChange: (val: string) => void;
    }) => (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
        >
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0b0c10] via-[#0c1020] to-[#0a0a14] text-zinc-50">
            <Topbar email={email} />
            <main className="mx-auto max-w-none px-6 py-6">
                <div className="flex gap-6">
                    <Sidebar />
                    <div className="min-w-0 flex-1 lg:ml-[296px]">
                        {loading ? (
                            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/60 p-6 text-zinc-400">Loading settings…</div>
                        ) : (
                            <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/70">
                                {/* Header */}
                                <div className="border-b border-zinc-800/60 px-6 py-4">
                                    <h1 className="text-xl font-semibold text-zinc-50">Settings</h1>
                                    <p className="mt-1 text-sm text-zinc-500">Manage your account settings and preferences</p>
                                </div>

                                {/* Mobile: Horizontal tabs */}
                                <div className="block border-b border-zinc-800/60 md:hidden">
                                    <div className="flex overflow-x-auto px-2 py-2 gap-1 [&::-webkit-scrollbar]:hidden">
                                        {sections.map((section) => (
                                            <button
                                                key={section.id}
                                                onClick={() => setActiveSection(section.id)}
                                                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${activeSection === section.id
                                                    ? "bg-indigo-600/20 text-indigo-400"
                                                    : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                                                    }`}
                                            >
                                                {section.icon}
                                                <span className="whitespace-nowrap">{section.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex">
                                    {/* Desktop: Sidebar Navigation */}
                                    <nav className="hidden w-56 shrink-0 border-r border-zinc-800/60 p-4 md:block">
                                        <ul className="space-y-1">
                                            {sections.map((section) => (
                                                <li key={section.id}>
                                                    <button
                                                        onClick={() => setActiveSection(section.id)}
                                                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${activeSection === section.id
                                                            ? "bg-indigo-600/20 text-indigo-400"
                                                            : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                                                            }`}
                                                    >
                                                        {section.icon}
                                                        {section.label}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>

                                        {/* Logout Button */}
                                        <div className="mt-6 border-t border-zinc-800/60 pt-4">
                                            <button
                                                onClick={handleLogout}
                                                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-600/10"
                                            >
                                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                </svg>
                                                Log Out
                                            </button>
                                        </div>
                                    </nav>

                                    {/* Content Area */}
                                    <div className="flex-1 p-6">
                                        {/* Success/Error Message */}
                                        {message && (
                                            <div
                                                className={`mb-4 rounded-lg px-4 py-3 text-sm ${message.type === "success"
                                                    ? "bg-emerald-600/20 text-emerald-400"
                                                    : "bg-red-600/20 text-red-400"
                                                    }`}
                                            >
                                                {message.text}
                                            </div>
                                        )}

                                        {/* Account Section */}
                                        {activeSection === "account" && (
                                            <div className="space-y-6">
                                                <div>
                                                    <h2 className="text-lg font-medium text-zinc-100">Account Settings</h2>
                                                    <p className="mt-1 text-sm text-zinc-500">Manage your account information and security</p>
                                                </div>

                                                <div className="space-y-4">
                                                    {/* Email */}
                                                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h3 className="text-sm font-medium text-zinc-200">Email Address</h3>
                                                                <p className="mt-1 text-sm text-zinc-500">{email}</p>
                                                            </div>
                                                            <button className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800">
                                                                Change
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Password */}
                                                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h3 className="text-sm font-medium text-zinc-200">Password</h3>
                                                                <p className="mt-1 text-sm text-zinc-500">Last changed: Never</p>
                                                            </div>
                                                            <button className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800">
                                                                Update
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Two-Factor */}
                                                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h3 className="text-sm font-medium text-zinc-200">Two-Factor Authentication</h3>
                                                                <p className="mt-1 text-sm text-zinc-500">Add an extra layer of security to your account</p>
                                                            </div>
                                                            <Toggle
                                                                enabled={settings.twoFactorEnabled}
                                                                onChange={(val) => setSettings({ ...settings, twoFactorEnabled: val })}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Delete Account */}
                                                    <div className="rounded-lg border border-red-900/30 bg-red-950/20 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h3 className="text-sm font-medium text-red-400">Delete Account</h3>
                                                                <p className="mt-1 text-sm text-zinc-500">Permanently delete your account and all data</p>
                                                            </div>
                                                            <button className="rounded-lg border border-red-800 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-900/30">
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Privacy Section */}
                                        {activeSection === "privacy" && (
                                            <div className="space-y-6">
                                                <div>
                                                    <h2 className="text-lg font-medium text-zinc-100">Privacy Settings</h2>
                                                    <p className="mt-1 text-sm text-zinc-500">Control who can see your information</p>
                                                </div>

                                                <div className="space-y-4">
                                                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h3 className="text-sm font-medium text-zinc-200">Profile Visibility</h3>
                                                                <p className="mt-1 text-sm text-zinc-500">Who can see your profile</p>
                                                            </div>
                                                            <Select
                                                                value={settings.profileVisibility}
                                                                options={[
                                                                    { value: "public", label: "Public" },
                                                                    { value: "friends", label: "Friends Only" },
                                                                    { value: "private", label: "Private" },
                                                                ]}
                                                                onChange={(val) =>
                                                                    setSettings({ ...settings, profileVisibility: val as typeof settings.profileVisibility })
                                                                }
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h3 className="text-sm font-medium text-zinc-200">Show Online Status</h3>
                                                                <p className="mt-1 text-sm text-zinc-500">Let others see when you&apos;re online</p>
                                                            </div>
                                                            <Toggle
                                                                enabled={settings.showOnlineStatus}
                                                                onChange={(val) => setSettings({ ...settings, showOnlineStatus: val })}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h3 className="text-sm font-medium text-zinc-200">Allow Messages From</h3>
                                                                <p className="mt-1 text-sm text-zinc-500">Who can send you direct messages</p>
                                                            </div>
                                                            <Select
                                                                value={settings.allowMessagesFrom}
                                                                options={[
                                                                    { value: "everyone", label: "Everyone" },
                                                                    { value: "friends", label: "Friends Only" },
                                                                    { value: "none", label: "No One" },
                                                                ]}
                                                                onChange={(val) =>
                                                                    setSettings({ ...settings, allowMessagesFrom: val as typeof settings.allowMessagesFrom })
                                                                }
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h3 className="text-sm font-medium text-zinc-200">Show Activity Status</h3>
                                                                <p className="mt-1 text-sm text-zinc-500">Show your recent activity to others</p>
                                                            </div>
                                                            <Toggle
                                                                enabled={settings.showActivityStatus}
                                                                onChange={(val) => setSettings({ ...settings, showActivityStatus: val })}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Notifications Section */}
                                        {activeSection === "notifications" && (
                                            <div className="space-y-6">
                                                <div>
                                                    <h2 className="text-lg font-medium text-zinc-100">Notification Preferences</h2>
                                                    <p className="mt-1 text-sm text-zinc-500">Choose what notifications you receive</p>
                                                </div>

                                                <div className="space-y-4">
                                                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h3 className="text-sm font-medium text-zinc-200">Push Notifications</h3>
                                                                <p className="mt-1 text-sm text-zinc-500">Receive push notifications on your device</p>
                                                            </div>
                                                            <Toggle
                                                                enabled={settings.pushNotifications}
                                                                onChange={(val) => setSettings({ ...settings, pushNotifications: val })}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h3 className="text-sm font-medium text-zinc-200">Message Notifications</h3>
                                                                <p className="mt-1 text-sm text-zinc-500">Get notified about new messages</p>
                                                            </div>
                                                            <Toggle
                                                                enabled={settings.messageNotifications}
                                                                onChange={(val) => setSettings({ ...settings, messageNotifications: val })}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h3 className="text-sm font-medium text-zinc-200">Mention Notifications</h3>
                                                                <p className="mt-1 text-sm text-zinc-500">Get notified when someone mentions you</p>
                                                            </div>
                                                            <Toggle
                                                                enabled={settings.mentionNotifications}
                                                                onChange={(val) => setSettings({ ...settings, mentionNotifications: val })}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h3 className="text-sm font-medium text-zinc-200">Follow Notifications</h3>
                                                                <p className="mt-1 text-sm text-zinc-500">Get notified when someone follows you</p>
                                                            </div>
                                                            <Toggle
                                                                enabled={settings.followNotifications}
                                                                onChange={(val) => setSettings({ ...settings, followNotifications: val })}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h3 className="text-sm font-medium text-zinc-200">Like Notifications</h3>
                                                                <p className="mt-1 text-sm text-zinc-500">Get notified when someone likes your post</p>
                                                            </div>
                                                            <Toggle
                                                                enabled={settings.likeNotifications}
                                                                onChange={(val) => setSettings({ ...settings, likeNotifications: val })}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h3 className="text-sm font-medium text-zinc-200">Comment Notifications</h3>
                                                                <p className="mt-1 text-sm text-zinc-500">Get notified when someone comments on your post</p>
                                                            </div>
                                                            <Toggle
                                                                enabled={settings.commentNotifications}
                                                                onChange={(val) => setSettings({ ...settings, commentNotifications: val })}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Appearance Section */}
                                        {activeSection === "appearance" && (
                                            <div className="space-y-6">
                                                <div>
                                                    <h2 className="text-lg font-medium text-zinc-100">Appearance</h2>
                                                    <p className="mt-1 text-sm text-zinc-500">Customize how the app looks and feels</p>
                                                </div>

                                                <div className="space-y-4">
                                                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h3 className="text-sm font-medium text-zinc-200">Theme</h3>
                                                                <p className="mt-1 text-sm text-zinc-500">Choose your preferred color scheme</p>
                                                            </div>
                                                            <Select
                                                                value={settings.theme}
                                                                options={[
                                                                    { value: "light", label: "Light" },
                                                                    { value: "dark", label: "Dark" },
                                                                    { value: "system", label: "System" },
                                                                ]}
                                                                onChange={(val) => setSettings({ ...settings, theme: val as typeof settings.theme })}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h3 className="text-sm font-medium text-zinc-200">Font Size</h3>
                                                                <p className="mt-1 text-sm text-zinc-500">Adjust the text size across the app</p>
                                                            </div>
                                                            <Select
                                                                value={settings.fontSize}
                                                                options={[
                                                                    { value: "small", label: "Small" },
                                                                    { value: "medium", label: "Medium" },
                                                                    { value: "large", label: "Large" },
                                                                ]}
                                                                onChange={(val) => setSettings({ ...settings, fontSize: val as typeof settings.fontSize })}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h3 className="text-sm font-medium text-zinc-200">Reduced Motion</h3>
                                                                <p className="mt-1 text-sm text-zinc-500">Reduce animations throughout the app</p>
                                                            </div>
                                                            <Toggle
                                                                enabled={settings.reducedMotion}
                                                                onChange={(val) => setSettings({ ...settings, reducedMotion: val })}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-4">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <h3 className="text-sm font-medium text-zinc-200">Auto-Download Media</h3>
                                                                <p className="mt-1 text-sm text-zinc-500">Automatically download images and videos</p>
                                                            </div>
                                                            <Toggle
                                                                enabled={settings.autoDownloadMedia}
                                                                onChange={(val) => setSettings({ ...settings, autoDownloadMedia: val })}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Save Button */}
                                        <div className="mt-8 flex flex-col gap-3 border-t border-zinc-800/60 pt-6 sm:flex-row sm:items-center">
                                            <button
                                                onClick={handleSave}
                                                disabled={saving}
                                                className="w-full rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-zinc-700 sm:w-auto"
                                            >
                                                {saving ? "Saving…" : "Save Changes"}
                                            </button>
                                            <button
                                                onClick={() => router.back()}
                                                className="w-full rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-800 sm:w-auto"
                                            >
                                                Cancel
                                            </button>
                                        </div>

                                        {/* Mobile: Logout Button at bottom */}
                                        <div className="mt-6 border-t border-zinc-800/60 pt-4 md:hidden">
                                            <button
                                                onClick={handleLogout}
                                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-950/30 px-4 py-3 text-sm font-medium text-red-400 transition-colors hover:bg-red-900/30"
                                            >
                                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                </svg>
                                                Log Out
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
