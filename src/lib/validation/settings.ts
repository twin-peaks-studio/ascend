import { z } from "zod";

// Profile validation
export const profileUpdateSchema = z.object({
  display_name: z
    .string()
    .min(1, "Display name is required")
    .max(50, "Display name must be less than 50 characters")
    .trim(),
});

export const avatarUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size <= 2 * 1024 * 1024, "File size must be less than 2MB")
    .refine(
      (file) => ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type),
      "File must be a JPEG, PNG, GIF, or WebP image"
    ),
});

// Account validation
export const emailChangeSchema = z.object({
  newEmail: z.string().email("Invalid email address"),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters")
      .max(72, "Password must be less than 72 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must contain at least one uppercase letter, one lowercase letter, and one number"
      ),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

export const accountDeletionSchema = z.object({
  confirmation: z.literal("delete my account", {
    errorMap: () => ({ message: 'You must type "delete my account" to confirm' }),
  }),
});

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
export type AvatarUpload = z.infer<typeof avatarUploadSchema>;
export type EmailChange = z.infer<typeof emailChangeSchema>;
export type PasswordChange = z.infer<typeof passwordChangeSchema>;
export type AccountDeletion = z.infer<typeof accountDeletionSchema>;
