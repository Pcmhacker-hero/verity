"use client"

import { WorkspaceSettings } from "@/components/settings/workspace-settings"

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and workspace settings.
        </p>
      </div>
      
      <div className="grid gap-6">
        <WorkspaceSettings />
      </div>
    </div>
  )
}
