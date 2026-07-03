import { db, chatMessages, chatSessions } from '@verity/database';
import { WorkspaceService } from '@verity/services';
import { eq, and, asc } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { requireAuthContext } from '@/lib/auth/session';
import { ChatInterface } from '@/components/chat/chat-interface';
import type { UIMessage } from '@ai-sdk/react';

const workspaceService = new WorkspaceService();

export default async function ChatPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const auth = await requireAuthContext();
  const { projectId } = await params;

  // Verify access
  try {
    await workspaceService.getProjectDetail({
      workspaceId: auth.workspaceId,
      projectId,
    });
  } catch (_error) {
    redirect('/projects');
  }

  // Fetch chat history
  const session = await db.query.chatSessions.findFirst({
    where: and(
      eq(chatSessions.projectId, projectId),
      eq(chatSessions.userId, auth.userId)
    )
  });
  
  let initialMessages: UIMessage[] = [];
  if (session) {
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, session.id))
      .orderBy(asc(chatMessages.createdAt));
      
    initialMessages = messages.map((msg) => ({
      id: msg.id,
      role: msg.role as 'user' | 'assistant' | 'system',
      parts: [{ type: 'text', text: msg.content }],
    } as any));
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Project Chat</h1>
        <p className="text-muted-foreground mt-2">
          Discuss your product requirements, architecture, and verification results.
        </p>
      </div>

      <ChatInterface projectId={projectId} initialMessages={initialMessages} />
    </div>
  );
}
