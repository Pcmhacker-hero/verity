import type { UIMessage } from '@ai-sdk/react';
import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

function extractTextFromMessage(message: UIMessage): string {
  const m = message as unknown as Record<string, unknown>;
  if (Array.isArray(m.parts)) {
    return m.parts
      .filter((p: unknown) => typeof p === 'object' && p !== null && (p as Record<string, unknown>).type === 'text')
      .map((p: unknown) => String((p as Record<string, unknown>).text || ''))
      .join('');
  }
  return typeof m.content === 'string' ? m.content : String(m.content || '');
}

export function ChatMessage({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn(
        'group relative mb-4 flex items-start md:-ml-12',
        isUser ? 'flex-row-reverse md:ml-auto md:flex-row' : ''
      )}
    >
      <div
        className={cn(
          'flex size-8 shrink-0 select-none items-center justify-center rounded-md border shadow',
          isUser ? 'bg-background ml-4 md:ml-0 md:mr-4' : 'bg-primary text-primary-foreground md:mr-4'
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div className="flex-1 px-1 overflow-hidden">
        <div
          className={cn(
            'prose prose-sm dark:prose-invert max-w-none',
            isUser ? 'text-right md:text-left' : ''
          )}
        >
          <ReactMarkdown>
            {extractTextFromMessage(message)}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
