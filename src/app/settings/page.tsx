"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileSection } from "@/components/settings/profile-section";
import { AccountSection } from "@/components/settings/account-section";

export default function SettingsPage() {
  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <ProfileSection />
        </TabsContent>

        <TabsContent value="account" className="space-y-6">
          <AccountSection />
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <div className="rounded-lg border p-6">
            <h3 className="text-lg font-semibold mb-2">Appearance</h3>
            <p className="text-sm text-muted-foreground">
              Coming soon: Theme customization and display preferences.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
