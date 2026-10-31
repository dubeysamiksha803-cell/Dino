"use client";

import { Fragment, useRef, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, children }: ModalProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        initialFocus={cancelButtonRef}
        onClose={onClose}
      >
        {/* Dimmed, blurred backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-3 py-8 sm:px-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-2 scale-95"
              enterTo="opacity-100 translate-y-0 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0 scale-100"
              leaveTo="opacity-0 translate-y-2 scale-95"
            >
              {/* Outer glow ring for subtle highlight */}
              <div className="relative w-full max-w-xl">
                <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-zinc-500/25 via-purple-500/20 to-emerald-500/20 opacity-70 blur-xl" />

                <Dialog.Panel className="relative overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/95 text-left shadow-[0_18px_60px_rgba(0,0,0,0.85)]">
                  {/* Top bar with grab-handle + close */}
                  <div className="flex items-center justify-between border-b border-zinc-800/70 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-zinc-400">
                      <span className="inline-flex h-1.5 w-10 rounded-full bg-zinc-700/80" />
                      <span>CREATE</span>
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-100"
                      onClick={onClose}
                      ref={cancelButtonRef}
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Content area: let ComposerInline control its own layout */}
                  <div className="p-3 sm:p-4">
                    {children}
                  </div>
                </Dialog.Panel>
              </div>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
