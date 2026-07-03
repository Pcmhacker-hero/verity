"use client"

import { CreateProjectDialog } from "@/components/projects/create-project-dialog"
import { ProjectList } from "@/components/projects/project-list"

export default function ProjectsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage your AI verification projects and specs.
          </p>
        </div>
        <CreateProjectDialog />
      </div>
      <ProjectList />
    </div>
  )
}
