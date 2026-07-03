"use client"

import * as React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Edit2, Eye } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ArtifactViewer } from "./artifact-viewer"
import { ArtifactEditor } from "./artifact-editor"

interface ArtifactManagerProps {
  projectId: string
  artifactType: string
}

export function ArtifactManager({ projectId, artifactType }: ArtifactManagerProps) {
  const [mode, setMode] = React.useState<"view" | "edit">("view")
  const queryClient = useQueryClient()
  const queryKey = ["artifact", projectId, artifactType]

  const { data: artifact, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      // Use the dynamically provided artifact type, falling back if not supported
      // Note: backend may only have /prd, /architecture, etc.
      const res = await fetch(`/api/projects/${projectId}/spec/${artifactType}`)
      if (!res.ok) {
        if (res.status === 404) {
          return null // Not generated yet
        }
        throw new Error("Failed to fetch artifact")
      }
      return res.json()
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (content: string) => {
      let payload: any;
      try {
        payload = JSON.parse(content);
      } catch {
        payload = {
          narrative: content,
          problemStatement: "Updated via UI",
          targetUsers: [],
          features: [],
          nonGoals: [],
          successCriteria: [],
        };
      }

      const res = await fetch(`/api/projects/${projectId}/spec/${artifactType}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        throw new Error("Failed to update artifact")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      setMode("view")
    },
  })

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading artifact...</div>
  }

  if (error) {
    return <div className="p-8 text-center text-destructive">Error loading artifact.</div>
  }

  // The actual JSON structure depends on the artifact type (e.g., prdArtifactSchema). 
  // For rendering markdown here, we just stringify or use a specific field like "narrative".
  const contentString = artifact ? artifact.narrative || JSON.stringify(artifact, null, 2) : ""

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        {mode === "view" ? (
          <Button variant="outline" onClick={() => setMode("edit")}>
            <Edit2 className="mr-2 h-4 w-4" />
            Edit
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setMode("view")}>
            <Eye className="mr-2 h-4 w-4" />
            Preview
          </Button>
        )}
      </div>

      {mode === "view" ? (
        <ArtifactViewer content={contentString} />
      ) : (
        <ArtifactEditor 
          initialContent={contentString} 
          onSave={async (newContent) => {
            await updateMutation.mutateAsync(newContent)
          }} 
        />
      )}
    </div>
  )
}
