"use client"

import * as React from "react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { FolderOpen } from "lucide-react"

import { useProjects } from "@/hooks/use-projects"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { CreateProjectDialog } from "./create-project-dialog"

export function ProjectList() {
  const { data, isLoading, error } = useProjects()

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading projects...</div>
  }

  if (error) {
    return <div className="text-sm text-destructive">Error loading projects.</div>
  }

  const projects = data?.data || []

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
        <FolderOpen className="mb-4 h-10 w-10 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-semibold">No projects created</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          You don&apos;t have any projects yet. Create one to get started.
        </p>
        <CreateProjectDialog />
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Repository</TableHead>
            <TableHead>Last Updated</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow key={project.id}>
              <TableCell className="font-medium">
                <Link href={`/projects/${project.id}`} className="hover:underline">
                  {project.name}
                </Link>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      project.lastVerificationStatus === "clean"
                        ? "bg-green-500"
                        : project.lastVerificationStatus === "findings"
                        ? "bg-amber-500"
                        : project.lastVerificationStatus === "failed"
                        ? "bg-destructive"
                        : "bg-muted-foreground"
                    }`}
                  />
                  <span className="text-sm capitalize">
                    {project.lastVerificationStatus.replace("_", " ")}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {project.hasRepoConnection ? "Connected" : "Not connected"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/projects/${project.id}`}>
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
