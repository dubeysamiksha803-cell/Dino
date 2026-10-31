"use client";

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { X, Check, ZoomIn, ZoomOut } from "lucide-react";

interface ImageCropperModalProps {
    imageSrc: string;
    onCropComplete: (croppedImageBlob: Blob) => void;
    onCancel: () => void;
    aspectRatio?: number;
    cropShape?: "rect" | "round";
}

// Utility function to create cropped image blob
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve) => (image.onload = resolve));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2d context");

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Canvas is empty"));
        }, "image/jpeg", 0.9);
    });
}

export default function ImageCropperModal({
    imageSrc,
    onCropComplete,
    onCancel,
    aspectRatio = 1,
    cropShape = "round",
}: ImageCropperModalProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const onCropCompleteHandler = useCallback(
        (_croppedArea: Area, croppedAreaPixels: Area) => {
            setCroppedAreaPixels(croppedAreaPixels);
        },
        []
    );

    const handleConfirm = async () => {
        if (!croppedAreaPixels) return;
        setIsProcessing(true);
        try {
            const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
            onCropComplete(croppedBlob);
        } catch (err) {
            console.error("Error cropping image:", err);
            alert("Failed to crop image");
        } finally {
            setIsProcessing(false);
        }
    };

    if (typeof document === "undefined") return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-black/95">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <button
                    onClick={onCancel}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                >
                    <X className="h-5 w-5" />
                    Cancel
                </button>
                <span className="text-sm font-medium text-white">Crop Image</span>
                <button
                    onClick={handleConfirm}
                    disabled={isProcessing || !croppedAreaPixels}
                    className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isProcessing ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                        <Check className="h-5 w-5" />
                    )}
                    {isProcessing ? "Processing..." : "Apply"}
                </button>
            </div>

            {/* Cropper Area */}
            <div className="relative flex-1">
                <Cropper
                    image={imageSrc}
                    crop={crop}
                    zoom={zoom}
                    aspect={aspectRatio}
                    cropShape={cropShape}
                    showGrid={false}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropCompleteHandler}
                    classes={{
                        containerClassName: "bg-black",
                        cropAreaClassName: "border-2 border-purple-500",
                    }}
                />
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center justify-center gap-4 px-4 py-4 border-t border-white/10">
                <button
                    onClick={() => setZoom((z) => Math.max(1, z - 0.1))}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                    <ZoomOut className="h-5 w-5" />
                </button>
                <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="w-48 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <button
                    onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                    <ZoomIn className="h-5 w-5" />
                </button>
                <span className="ml-2 text-sm text-white/50 w-12">{Math.round(zoom * 100)}%</span>
            </div>
        </div>,
        document.body
    );
}
