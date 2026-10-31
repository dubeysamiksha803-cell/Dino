"use client";

import { useState, useRef } from "react";
import { parseWhatsAppChat, ParsedMessage } from "@/lib/whatsappParser";
import { supabase } from "@/lib/supabaseClient";
import { X, Upload, Check, AlertCircle, ArrowLeft } from "lucide-react";
import { User } from "./types";

interface WhatsAppImportModalProps {
    open: boolean;
    onClose: () => void;
    chatId: string;
    members: User[];
    onImportComplete: () => void;
}

export default function WhatsAppImportModal({
    open,
    onClose,
    chatId,
    members,
    onImportComplete
}: WhatsAppImportModalProps) {
    const [step, setStep] = useState<"upload" | "map" | "importing" | "done">("upload");
    const [parsedMessages, setParsedMessages] = useState<ParsedMessage[]>([]);
    const [senders, setSenders] = useState<string[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);

    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!open) return null;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith(".txt")) {
            setError("Please upload a .txt file (Export Chat > Without Media)");
            return;
        }

        setError(null);
        try {
            const text = await file.text();
            const messages = parseWhatsAppChat(text);

            if (messages.length === 0) {
                setError("No messages found. Check file format.");
                return;
            }

            setParsedMessages(messages);
            const uniqueSenders = Array.from(new Set(messages.map((m) => m.sender)));
            setSenders(uniqueSenders);

            // Auto-map if names match exactly
            const initialMapping: Record<string, string> = {};
            uniqueSenders.forEach(sender => {
                const lowerSender = sender.toLowerCase();
                const match = members.find(m => m.username.toLowerCase() === lowerSender);
                if (match) {
                    initialMapping[sender] = match.id;
                } else {
                    initialMapping[sender] = ""; // default to empty
                }
            });

            setMapping(initialMapping);
            setStep("map");
        } catch {
            setError("Failed to read file.");
        }
    };

    const executeImport = async () => {
        setStep("importing");
        setProgress(0);

        try {
            const BATCH_SIZE = 50;

            // Filter out messages where sender is mapped to 'skip' or empty
            const messagesToImport = parsedMessages.filter(m => {
                const userId = mapping[m.sender];
                return userId && userId !== 'skip';
            });

            const effectiveTotal = messagesToImport.length;

            for (let i = 0; i < effectiveTotal; i += BATCH_SIZE) {
                const batch = messagesToImport.slice(i, i + BATCH_SIZE);

                const rows = batch.map(msg => ({
                    chat_id: chatId,
                    sender_id: mapping[msg.sender],
                    content: msg.content,
                    // created_at must be preserved
                    created_at: msg.date.toISOString(),
                    message_type: 'text'
                }));

                const { error: insertError } = await supabase
                    .from('messages')
                    .insert(rows);

                if (insertError) throw insertError;

                setProgress(Math.min(100, Math.round(((i + BATCH_SIZE) / effectiveTotal) * 100)));
            }

            setStep("done");
            onImportComplete();
            setTimeout(() => onClose(), 2000);

        } catch (err: unknown) {
            console.error("Import failed", err);
            const msg = err instanceof Error ? err.message : "Failed to import messages";
            setError(msg);
            setStep("map");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-neutral-800 px-5 py-4 shrink-0">
                    <h3 className="text-lg font-semibold text-zinc-100">Import WhatsApp Chat</h3>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-zinc-400 hover:bg-neutral-800 hover:text-zinc-200 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
                    {step === "upload" && (
                        <div className="space-y-6">
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                Export your chat from WhatsApp (Settings {'>'} Export Chat {'>'} Without Media) and upload the extracted <code className="bg-zinc-900 px-1 py-0.5 rounded text-zinc-300">.txt</code> file here.
                            </p>
                            <div
                                className="group border-2 border-dashed border-zinc-700 bg-zinc-900/30 rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-zinc-900/50 transition-all"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    <Upload className="h-6 w-6 text-zinc-400 group-hover:text-emerald-500" />
                                </div>
                                <span className="text-zinc-300 font-medium">Click to upload chat file</span>
                                <span className="text-zinc-500 text-xs mt-1">Accepts .txt files only</span>
                                <input
                                    type="file"
                                    accept=".txt"
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </div>
                            {error && (
                                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/20 p-3 rounded-lg border border-red-900/50">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    <p>{error}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {step === "map" && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-zinc-400">Map WhatsApp names to members</p>
                                <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded-full">{senders.length} senders found</span>
                            </div>
                            <div className="space-y-3 pr-1">
                                {senders.map(sender => (
                                    <div key={sender} className="flex flex-col gap-1.5 bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/50">
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className="h-6 w-6 rounded-full bg-emerald-900/30 flex items-center justify-center text-[10px] text-emerald-400 font-bold border border-emerald-900/50">
                                                {(sender[0] || '?').toUpperCase()}
                                            </div>
                                            <span className="text-sm font-medium text-zinc-200 truncate" title={sender}>{sender}</span>
                                        </div>
                                        <select
                                            className="w-full bg-black text-sm rounded-lg border border-zinc-800 p-2 text-zinc-300 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none appearance-none"
                                            value={mapping[sender] || ""}
                                            onChange={(e) => setMapping(prev => ({ ...prev, [sender]: e.target.value }))}
                                        >
                                            <option value="">-- Select Member --</option>
                                            <option value="skip">Don&apos;t Import / System</option>
                                            <optgroup label="Chat Members">
                                                {members.map(m => (
                                                    <option key={m.id} value={m.id}>{m.username}</option>
                                                ))}
                                            </optgroup>
                                        </select>
                                    </div>
                                ))}
                            </div>
                            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                        </div>
                    )}

                    {step === "importing" && (
                        <div className="py-10 flex flex-col items-center justify-center text-center space-y-6">
                            <div className="relative h-16 w-16">
                                <div className="absolute inset-0 rounded-full border-4 border-zinc-800"></div>
                                <div
                                    className="absolute inset-0 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"
                                ></div>
                                <div className="absolute inset-0 flex items-center justify-center font-bold text-xs text-emerald-500">
                                    {progress}%
                                </div>
                            </div>
                            <div>
                                <h4 className="text-zinc-200 font-medium">Importing Messages</h4>
                                <p className="text-zinc-500 text-sm mt-1">Please wait while we process the chat history...</p>
                            </div>
                        </div>
                    )}

                    {step === "done" && (
                        <div className="py-10 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="h-16 w-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mb-2">
                                <Check className="h-8 w-8" />
                            </div>
                            <div>
                                <h4 className="text-xl font-bold text-zinc-100">Import Complete!</h4>
                                <p className="text-zinc-400 text-sm mt-2">Your messages have been added to the chat.</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === "map" && (
                    <div className="flex items-center justify-between border-t border-neutral-800 px-5 py-4 bg-neutral-900/30 shrink-0">
                        <button
                            onClick={() => setStep("upload")}
                            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </button>
                        <button
                            className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-900/20"
                            onClick={executeImport}
                            disabled={Object.values(mapping).filter(v => v !== "" && v !== "skip").length === 0}
                        >
                            Start Import
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
