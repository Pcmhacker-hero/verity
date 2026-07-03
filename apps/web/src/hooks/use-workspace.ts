import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

export interface WorkspaceResponse {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export function useWorkspace() {
  return useQuery({
    queryKey: ["workspace"],
    queryFn: async (): Promise<WorkspaceResponse> => {
      const res = await fetch("/api/workspace")
      if (!res.ok) {
        throw new Error("Failed to fetch workspace details")
      }
      return res.json()
    },
  })
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        throw new Error("Failed to update workspace")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace"] })
    },
  })
}
