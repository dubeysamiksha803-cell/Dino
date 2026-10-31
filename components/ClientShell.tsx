"use client";

import React from "react";
import CallListener from "@/components/call/CallListener";
import MobileBottomNav from "@/components/mobile/MobileBottomNav";

export default function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CallListener />
      {children}
      <MobileBottomNav />
    </>
  );
}
