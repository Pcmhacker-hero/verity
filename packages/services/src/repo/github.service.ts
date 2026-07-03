import * as fs from 'node:fs/promises';
import { join } from 'node:path';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
}

export class GitHubService {
  /**
   * List repositories accessible to the user via their OAuth token.
   */
  async getUserRepositories(accessToken: string): Promise<GitHubRepo[]> {
    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Verity-App',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${text}`);
    }

    const data = await response.json();
    return data as GitHubRepo[];
  }

  /**
   * Download a repository archive (zipball) to a destination path.
   * Uses the native fetch API and arrayBuffer (sufficient for typical repos).
   */
  async downloadRepoZip(
    repoFullName: string,
    defaultBranch: string,
    accessToken: string,
    destFilePath: string
  ): Promise<void> {
    const response = await fetch(
      `https://api.github.com/repos/${repoFullName}/zipball/${defaultBranch}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'Verity-App',
        },
        redirect: 'follow',
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub API error downloading zipball: ${response.status} ${text}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    await fs.writeFile(destFilePath, Buffer.from(arrayBuffer));
  }
}
