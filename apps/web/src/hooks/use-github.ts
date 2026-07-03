import { useQuery } from "@tanstack/react-query"

export type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
}

export type GitHubReposResponse = {
  connected: boolean;
  repos: GitHubRepo[];
}

export function useGithubRepos() {
  return useQuery({
    queryKey: ["github-repos"],
    queryFn: async (): Promise<GitHubReposResponse> => {
      const res = await fetch("/api/github/repos")
      if (!res.ok) {
        // Return not connected if the token is invalid or endpoint fails
        return { connected: false, repos: [] }
      }
      return res.json()
    },
  })
}
