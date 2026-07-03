import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ProjectsListResponse } from "@/app/api/projects/route"

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async (): Promise<ProjectsListResponse> => {
      const res = await fetch("/api/projects")
      if (!res.ok) {
        throw new Error("Failed to fetch projects")
      }
      return res.json()
    },
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        throw new Error("Failed to create project")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })
}
