"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { ImageIcon, Video, Smile, Loader2, X } from "lucide-react";
import {
  compressImage,
  formatFileSize,
} from "@/lib/utils/image-compression";
import {
  MentionDropdown,
  useMention,
} from "@/components/shared/MentionDropdown";

interface PostComposerProps {
  user: {
    displayName: string;
    avatarUrl: string | null;
  };
  onPostCreated?: () => void;
}

export function PostComposer({ user, onPostCreated }: PostComposerProps) {
  const [content, setContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Mention autocomplete
  const {
    showDropdown,
    mentionQuery,
    dropdownPosition,
    handleSelectUser,
    closeDropdown,
  } = useMention({
    inputRef: textareaRef,
    value: content,
    onChange: setContent,
  });

  const handleSubmit = async () => {
    if ((!content.trim() && mediaFiles.length === 0) || isLoading) return;

    setIsLoading(true);

    try {
      // Upload media files first if any
      const uploadedUrls: string[] = [];

      if (mediaFiles.length > 0) {
        setIsUploading(true);
        for (const file of mediaFiles) {
          // Compress images before upload
          let fileToUpload = file;
          if (file.type.startsWith("image/")) {
            try {
              const originalSize = file.size;
              fileToUpload = await compressImage(file, {
                maxWidth: 1920,
                maxHeight: 1920,
                quality: 0.85,
                maxSizeKB: 1024, // 1MB max
              });
              const compressedSize = fileToUpload.size;
              console.log(
                `Image compressed: ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)} (${Math.round((1 - compressedSize / originalSize) * 100)}% reduction)`
              );
            } catch (err) {
              console.warn("Image compression failed, using original:", err);
            }
          }

          const formData = new FormData();
          formData.append("file", fileToUpload);
          formData.append("type", "post");

          const uploadRes = await fetch("/api/v1/upload", {
            method: "POST",
            body: formData,
          });

          const uploadData = (await uploadRes.json()) as {
            success: boolean;
            data?: { url: string };
          };

          if (uploadData.success && uploadData.data?.url) {
            uploadedUrls.push(uploadData.data.url);
          }
        }
        setIsUploading(false);
      }

      // Create post
      const res = await fetch("/api/v1/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim() || undefined,
          mediaUrls: uploadedUrls.length > 0 ? uploadedUrls : undefined,
        }),
      });

      const data = (await res.json()) as { success: boolean };

      if (data.success) {
        setContent("");
        setMediaFiles([]);
        setMediaPreviewUrls([]);
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
        onPostCreated?.();
      }
    } catch (error) {
      console.error("Failed to create post:", error);
    } finally {
      setIsLoading(false);
      setIsUploading(false);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limit to 10 files total
    const remainingSlots = 10 - mediaFiles.length;
    const filesToAdd = files.slice(0, remainingSlots);

    if (filesToAdd.length === 0) {
      alert("Maximum 10 media files allowed per post");
      return;
    }

    setMediaFiles((prev) => [...prev, ...filesToAdd]);

    // Create preview URLs
    const newPreviewUrls = filesToAdd.map((file) => URL.createObjectURL(file));
    setMediaPreviewUrls((prev) => [...prev, ...newPreviewUrls]);

    // Reset input
    e.target.value = "";
  };

  const removeMedia = (index: number) => {
    URL.revokeObjectURL(mediaPreviewUrls[index]);
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
    setMediaPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={user.avatarUrl || undefined}
              alt={user.displayName}
            />
            <AvatarFallback>
              {user.displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-3">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                placeholder="What's on your mind? Use @username to mention someone"
                value={content}
                onChange={handleTextareaChange}
                className="min-h-20 resize-none border-0 p-0 text-base focus-visible:ring-0"
                disabled={isLoading}
              />

              {/* Mention Dropdown */}
              {showDropdown && (
                <MentionDropdown
                  query={mentionQuery}
                  position={dropdownPosition}
                  onSelect={handleSelectUser}
                  onClose={closeDropdown}
                />
              )}
            </div>

            {/* Media Previews */}
            {mediaPreviewUrls.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {mediaPreviewUrls.map((url, index) => (
                  <div key={index} className="relative aspect-square">
                    {mediaFiles[index]?.type.startsWith("video/") ? (
                      <video
                        src={url}
                        className="h-full w-full rounded-lg object-cover"
                      />
                    ) : (
                      <Image
                        src={url}
                        alt={`Media ${index + 1}`}
                        fill
                        className="rounded-lg object-cover"
                        unoptimized
                      />
                    )}
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => removeMedia(index)}
                      disabled={isLoading}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between border-t pt-3">
              <div className="flex gap-1">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleMediaSelect}
                  disabled={isLoading || mediaFiles.length >= 10}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isLoading || mediaFiles.length >= 10}
                >
                  <ImageIcon className="text-muted-foreground h-5 w-5" />
                </Button>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/webm"
                  className="hidden"
                  onChange={handleMediaSelect}
                  disabled={isLoading || mediaFiles.length >= 10}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={isLoading || mediaFiles.length >= 10}
                >
                  <Video className="text-muted-foreground h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  disabled
                >
                  <Smile className="text-muted-foreground h-5 w-5" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                {mediaFiles.length > 0 && (
                  <span className="text-muted-foreground text-xs">
                    {mediaFiles.length}/10 files
                  </span>
                )}
                <Button
                  onClick={handleSubmit}
                  disabled={
                    (!content.trim() && mediaFiles.length === 0) || isLoading
                  }
                  size="sm"
                >
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isUploading ? "Uploading..." : "Post"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
