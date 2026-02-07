import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { avatarUploadSchema } from "@/lib/validation/settings";
import { logger } from "@/lib/logger/logger";
import { generateAvatarSizes, AVATAR_SIZES } from "@/lib/utils/image-resize";

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

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate all avatar sizes
    logger.info("Generating avatar sizes", { userId: user.id });
    const sizes = await generateAvatarSizes(buffer);

    // Get current profile to find old avatars
    const { data: profile } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .single();

    // Delete old avatar files if they exist
    if (profile?.avatar_url) {
      try {
        // Extract old file base name
        const oldUrlParts = profile.avatar_url.split("/");
        const oldFileName = oldUrlParts[oldUrlParts.length - 1];
        const oldBaseName = oldFileName.replace(/-\d+\.webp$/, "");

        // Delete all old sizes
        const oldFiles = [
          `${user.id}/${oldBaseName}-40.webp`,
          `${user.id}/${oldBaseName}-80.webp`,
          `${user.id}/${oldBaseName}-160.webp`,
          `${user.id}/${oldBaseName}-320.webp`,
        ];

        await supabase.storage.from("avatars").remove(oldFiles);
        logger.info("Deleted old avatar files", { userId: user.id, count: oldFiles.length });
      } catch (error) {
        logger.warn("Failed to delete old avatars", { userId: user.id, error });
      }
    }

    // Generate unique base filename (timestamp)
    const timestamp = Date.now();
    const baseName = `avatar-${timestamp}`;

    // Upload all sizes
    const uploads = await Promise.all([
      supabase.storage.from("avatars").upload(
        `${user.id}/${baseName}-${AVATAR_SIZES.small}.webp`,
        sizes.small,
        { contentType: "image/webp", upsert: false }
      ),
      supabase.storage.from("avatars").upload(
        `${user.id}/${baseName}-${AVATAR_SIZES.medium}.webp`,
        sizes.medium,
        { contentType: "image/webp", upsert: false }
      ),
      supabase.storage.from("avatars").upload(
        `${user.id}/${baseName}-${AVATAR_SIZES.large}.webp`,
        sizes.large,
        { contentType: "image/webp", upsert: false }
      ),
      supabase.storage.from("avatars").upload(
        `${user.id}/${baseName}-${AVATAR_SIZES.xlarge}.webp`,
        sizes.xlarge,
        { contentType: "image/webp", upsert: false }
      ),
    ]);

    // Check for upload errors
    const uploadError = uploads.find((result) => result.error);
    if (uploadError?.error) {
      logger.error("Avatar upload error", {
        userId: user.id,
        error: uploadError.error,
      });
      return NextResponse.json({ error: "Failed to upload avatar" }, { status: 500 });
    }

    // Get public URL for the medium size (used as base URL)
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(`${user.id}/${baseName}-${AVATAR_SIZES.medium}.webp`);

    // Return base URL (client will append size suffix as needed)
    const baseUrl = publicUrl.replace(`-${AVATAR_SIZES.medium}.webp`, "");

    logger.info("Avatar uploaded successfully", {
      userId: user.id,
      baseName,
      sizes: Object.keys(sizes),
      baseUrl,
    });

    console.log("🟢 Avatar upload complete:", {
      userId: user.id,
      baseName,
      baseUrl,
      originalSize: file.size,
      generatedSizes: Object.keys(sizes),
    });

    return NextResponse.json({
      url: `${baseUrl}-${AVATAR_SIZES.medium}.webp`, // Return medium size as default
    });
  } catch (error) {
    logger.error("Avatar upload error", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
