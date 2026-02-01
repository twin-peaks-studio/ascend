"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";

/**
 * Hook to fetch user profiles from the profiles table
 * Profiles are synced with Supabase Auth - when users sign up,
 * a trigger creates their profile automatically.
 */
export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { data, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .order("display_name", { ascending: true, nullsFirst: false });

    if (fetchError) {
      console.error("Error fetching profiles:", fetchError);
      setError(fetchError.message);
      setProfiles([]);
    } else {
      setProfiles((data as Profile[]) || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  return {
    profiles,
    loading,
    error,
    refetch: fetchProfiles,
  };
}

/**
 * Hook to get a single profile by ID
 */
export function useProfile(profileId: string | null) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!profileId) {
      setProfile(null);
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { data, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profileId)
      .single();

    if (fetchError) {
      console.error("Error fetching profile:", fetchError);
      setError(fetchError.message);
      setProfile(null);
    } else {
      setProfile(data as Profile);
    }

    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    error,
    refetch: fetchProfile,
  };
}
