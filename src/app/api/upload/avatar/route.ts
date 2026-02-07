import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { avatarUploadSchema } from "@/lib/validation/settings";
import { logger } from "@/lib/logger/logger";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file
    try {
      avatarUploadSchema.parse({ file });
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid file. Must be JPEG, PNG, GIF, or WebP under 2MB" },
        { status: 400 }
      );
    }

    // Get current profile to find old avatar
    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .single();

    // Delete old avatar if exists
    if (profile?.avatar_url) {
      try {
        const oldPath = profile.avatar_url.split("/").pop();
        if (oldPath) {
          await supabase.storage.from("avatars").remove([`${user.id}/${oldPath}`]);
        }
      } catch (error) {
        logger.warn("Failed to delete old avatar", { userId: user.id, error });
      }
    }

    // Generate unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      logger.error("Avatar upload error", {
        userId: user.id,
        error: uploadError,
      });
      return NextResponse.json({ error: "Failed to upload avatar" }, { status: 500 });
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(filePath);

    logger.info("Avatar uploaded", {
      userId: user.id,
      filePath,
    });

    return NextResponse.json({
      url: publicUrl,
    });
  } catch (error) {
    logger.error("Avatar upload error", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
