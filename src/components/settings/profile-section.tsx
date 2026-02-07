"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useProfile, useUpdateProfile } from "@/hooks/use-profiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Loader2, Upload, User, X } from "lucide-react";
import { profileUpdateSchema, avatarUploadSchema } from "@/lib/validation/settings";

export function ProfileSection() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id ?? null);
  const updateProfile = useUpdateProfile();

  // Debug: Log profile changes
  useEffect(() => {
    console.log("🔵 Profile data updated:", {
      avatar_url: profile?.avatar_url,
      display_name: profile?.display_name,
      userId: user?.id
    });
  }, [profile, user]);

  const [displayName, setDisplayName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Initialize display name when profile loads
  useState(() => {
    if (profile?.display_name && !isEditingName) {
      setDisplayName(profile.display_name);
    }
  });

  const handleDisplayNameSave = async () => {
    try {
      const validated = profileUpdateSchema.parse({ display_name: displayName });
      await updateProfile.mutateAsync({ display_name: validated.display_name });
      toast.success("Display name updated");
      setIsEditingName(false);
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      console.log("🔵 Starting avatar upload:", { fileName: file.name, fileSize: file.size });
      avatarUploadSchema.parse({ file });
      setUploadingAvatar(true);

      const formData = new FormData();
      formData.append("file", file);

      console.log("🔵 Sending upload request to API...");
      const response = await fetch("/api/upload/avatar", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("❌ Upload failed:", error);
        throw new Error(error.error || "Upload failed");
      }

      const { url } = await response.json();
      console.log("🔵 Upload successful! URL received:", url);
      console.log("🔵 Current profile before update:", profile);

      await updateProfile.mutateAsync({ avatar_url: url });
      console.log("🔵 Profile update mutation completed");

      toast.success("Avatar updated");
    } catch (error) {
      if (error instanceof Error) {
        console.error("❌ Avatar upload error:", error.message);
        toast.error(error.message);
      }
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await updateProfile.mutateAsync({ avatar_url: null });
      toast.success("Avatar removed");
    } catch (error) {
      toast.error("Failed to remove avatar");
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Avatar Section */}
      <div className="rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Profile Picture</h3>
        <div className="flex items-center gap-6">
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback>
              <User className="h-8 w-8" />
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Label htmlFor="avatar-upload" className="cursor-pointer">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingAvatar}
                  asChild
                >
                  <span>
                    {uploadingAvatar ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Upload
                  </span>
                </Button>
              </Label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              {profile?.avatar_url && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveAvatar}
                  disabled={updateProfile.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              JPEG, PNG, GIF, or WebP. Max 2MB.
            </p>
          </div>
        </div>
      </div>

      {/* Display Name Section */}
      <div className="rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Profile Information</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <div className="flex gap-2">
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (!isEditingName) setIsEditingName(true);
                }}
                placeholder={profile?.display_name || "Enter your name"}
                maxLength={50}
              />
              {isEditingName && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleDisplayNameSave}
                    disabled={updateProfile.isPending}
                  >
                    {updateProfile.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDisplayName(profile?.display_name || "");
                      setIsEditingName(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email || ""} disabled />
            <p className="text-xs text-muted-foreground">
              To change your email, go to the Account tab.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
