"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MediaGalleryProps {
  mediaUrls: string[];
  className?: string;
}

export function MediaGallery({ mediaUrls, className }: MediaGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const isOpen = selectedIndex !== null;

  const handlePrevious = useCallback(() => {
    if (selectedIndex === null) return;
    setSelectedIndex((prev) =>
      prev === null ? null : prev === 0 ? mediaUrls.length - 1 : prev - 1
    );
  }, [selectedIndex, mediaUrls.length]);

  const handleNext = useCallback(() => {
    if (selectedIndex === null) return;
    setSelectedIndex((prev) =>
      prev === null ? null : prev === mediaUrls.length - 1 ? 0 : prev + 1
    );
  }, [selectedIndex, mediaUrls.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "ArrowLeft") {
        handlePrevious();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "Escape") {
        setSelectedIndex(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handlePrevious, handleNext]);

  if (mediaUrls.length === 0) return null;

  // Single image
  if (mediaUrls.length === 1) {
    return (
      <>
        <div
          className={cn(
            "relative cursor-pointer overflow-hidden rounded-lg",
            className
          )}
          onClick={() => setSelectedIndex(0)}
        >
          <div className="relative aspect-video w-full">
            <Image
              src={mediaUrls[0]}
              alt="Post media"
              fill
              className="object-cover transition-transform hover:scale-105"
              unoptimized
            />
          </div>
        </div>
        <LightboxDialog
          mediaUrls={mediaUrls}
          selectedIndex={selectedIndex}
          onClose={() => setSelectedIndex(null)}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      </>
    );
  }

  // Two images
  if (mediaUrls.length === 2) {
    return (
      <>
        <div
          className={cn(
            "grid grid-cols-2 gap-1 overflow-hidden rounded-lg",
            className
          )}
        >
          {mediaUrls.map((url, index) => (
            <div
              key={index}
              className="relative aspect-square cursor-pointer"
              onClick={() => setSelectedIndex(index)}
            >
              <Image
                src={url}
                alt={`Post media ${index + 1}`}
                fill
                className="object-cover transition-transform hover:scale-105"
                unoptimized
              />
            </div>
          ))}
        </div>
        <LightboxDialog
          mediaUrls={mediaUrls}
          selectedIndex={selectedIndex}
          onClose={() => setSelectedIndex(null)}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      </>
    );
  }

  // Three images
  if (mediaUrls.length === 3) {
    return (
      <>
        <div
          className={cn(
            "grid grid-cols-2 gap-1 overflow-hidden rounded-lg",
            className
          )}
        >
          <div
            className="relative row-span-2 aspect-3/4 cursor-pointer"
            onClick={() => setSelectedIndex(0)}
          >
            <Image
              src={mediaUrls[0]}
              alt="Post media 1"
              fill
              className="object-cover transition-transform hover:scale-105"
              unoptimized
            />
          </div>
          {mediaUrls.slice(1).map((url, index) => (
            <div
              key={index + 1}
              className="relative aspect-square cursor-pointer"
              onClick={() => setSelectedIndex(index + 1)}
            >
              <Image
                src={url}
                alt={`Post media ${index + 2}`}
                fill
                className="object-cover transition-transform hover:scale-105"
                unoptimized
              />
            </div>
          ))}
        </div>
        <LightboxDialog
          mediaUrls={mediaUrls}
          selectedIndex={selectedIndex}
          onClose={() => setSelectedIndex(null)}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      </>
    );
  }

  // Four or more images
  return (
    <>
      <div
        className={cn(
          "grid grid-cols-2 gap-1 overflow-hidden rounded-lg",
          className
        )}
      >
        {mediaUrls.slice(0, 4).map((url, index) => (
          <div
            key={index}
            className="relative aspect-square cursor-pointer"
            onClick={() => setSelectedIndex(index)}
          >
            <Image
              src={url}
              alt={`Post media ${index + 1}`}
              fill
              className="object-cover transition-transform hover:scale-105"
              unoptimized
            />
            {index === 3 && mediaUrls.length > 4 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <span className="text-2xl font-bold text-white">
                  +{mediaUrls.length - 4}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
      <LightboxDialog
        mediaUrls={mediaUrls}
        selectedIndex={selectedIndex}
        onClose={() => setSelectedIndex(null)}
        onPrevious={handlePrevious}
        onNext={handleNext}
      />
    </>
  );
}

interface LightboxDialogProps {
  mediaUrls: string[];
  selectedIndex: number | null;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

function LightboxDialog({
  mediaUrls,
  selectedIndex,
  onClose,
  onPrevious,
  onNext,
}: LightboxDialogProps) {
  if (selectedIndex === null) return null;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-h-[95vh] max-w-[95vw] border-0 bg-transparent p-0 shadow-none">
        <div className="relative flex items-center justify-center">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-50 h-10 w-10 rounded-full bg-black/50 text-white hover:bg-black/70"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>

          {/* Previous button */}
          {mediaUrls.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 z-50 h-10 w-10 rounded-full bg-black/50 text-white hover:bg-black/70"
              onClick={onPrevious}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}

          {/* Image */}
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <Image
              src={mediaUrls[selectedIndex]}
              alt={`Media ${selectedIndex + 1} of ${mediaUrls.length}`}
              width={1200}
              height={800}
              className="max-h-[90vh] w-auto object-contain"
              unoptimized
            />
          </div>

          {/* Next button */}
          {mediaUrls.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 z-50 h-10 w-10 rounded-full bg-black/50 text-white hover:bg-black/70"
              onClick={onNext}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}

          {/* Counter */}
          {mediaUrls.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
              {selectedIndex + 1} / {mediaUrls.length}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
