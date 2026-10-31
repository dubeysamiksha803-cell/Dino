"use client";

import Topbar from "@/components/dashboard/Topbar";
import Sidebar from "@/components/dashboard/Sidebar";
import ExploreGrid from "@/components/explore/ExploreGrid";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import { APP_BG, PAGE_MAIN, LAYOUT_ROW } from "@/lib/theme";

export default function ExplorePage() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setEmail(data.session?.user?.email ?? null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className={APP_BG}>
      <Topbar email={email} />
      <main className={PAGE_MAIN}>
        <div className={LAYOUT_ROW}>
          <Sidebar />
          <div className="min-w-0 flex-1">
            <ExploreGrid />
          </div>
        </div>
      </main>
    </div>
  );
}
