"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Sidebar from "@/components/dashboard/Sidebar";
import ComposerInline from "@/components/dashboard/ComposerInline";
import RightRail from "@/components/dashboard/RightRail";
import PostList from "@/components/posts/PostList";
import MobileTopbar from "@/components/mobile/MobileTopbar";
import Modal from "@/components/ui/Modal";
import { APP_BG, PAGE_MAIN, LAYOUT_ROW } from "@/lib/theme";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [composerOpen] = useState(false);
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      if (isMounted) {
        setChecking(false);
      }
    };
    checkSession();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });
    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#15202b]">
        <div className="text-slate-400">Loading dashboard…</div>
      </div>
    );
  }

  return (
    <div className={APP_BG}>
      <MobileTopbar onCreatePost={() => setShowCreatePostModal(true)} />
      <main className={`${PAGE_MAIN} pb-20`}>
        <div className={LAYOUT_ROW}>
          {/* Desktop sidebar Create post should also open the modal popup */}
          <Sidebar onCreatePost={() => setShowCreatePostModal(true)} />
          <div className="min-w-0 flex-1 space-y-4">
            {composerOpen && <ComposerInline />}
            <PostList />
          </div>
          <RightRail />
        </div>
      </main>

      {/* Create Post Modal */}
      <Modal open={showCreatePostModal} onClose={() => setShowCreatePostModal(false)}>
        <ComposerInline />
      </Modal>
    </div>
  );
}


