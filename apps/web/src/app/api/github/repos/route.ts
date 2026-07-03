export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth } from '@/lib/api/handler';
import { AuthService, GitHubService } from '@verity/services';

const authService = new AuthService();
const githubService = new GitHubService();

export const GET = withApiAuth(async (request: NextRequest, { auth }) => {
  const token = await authService.getGithubToken(auth.userId);
  if (!token) {
    return NextResponse.json({ connected: false, repos: [] });
  }

  try {
    const repos = await githubService.getUserRepositories(token);
    return NextResponse.json({ connected: true, repos });
  } catch (error: any) {
    // If the token is invalid or expired
    console.error('Failed to fetch github repos', error);
    return NextResponse.json({ connected: false, error: 'Failed to fetch repositories' }, { status: 401 });
  }
});
