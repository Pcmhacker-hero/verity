'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface User {
  id: string;
  name: string;
  image: string | null;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: User;
}

interface Finding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  specArea: string;
  specElementRef: string;
  filePath: string | null;
  lineNumber: number | null;
  explanation: string;
  status: string;
  detectionTier: string;
  assignee: User | null;
}

const severityColors = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
  info: 'bg-gray-500',
};

// Mock list of workspace members for the MVP Team Collaboration
const MOCK_TEAM_MEMBERS = [
  { id: 'user_1', name: 'Marcus' },
  { id: 'user_2', name: 'Elena' },
  { id: 'user_3', name: 'Aiden' },
];

export function FindingsList({ projectId }: { projectId: string }) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterSpecArea, setFilterSpecArea] = useState<string>('all');
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentsData, setCommentsData] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  
  useEffect(() => {
    async function fetchFindings() {
      setLoading(true);
      setError(null);
      try {
        const queryParams = new URLSearchParams();
        if (filterSeverity !== 'all') queryParams.set('severity', filterSeverity);
        if (filterSpecArea !== 'all') queryParams.set('specArea', filterSpecArea);
        
        const res = await fetch(`/api/projects/${projectId}/findings?${queryParams.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch findings');
        const data = await res.json();
        setFindings(data.findings || []);
      } catch (err: unknown) {
        if (err instanceof Error) setError(err.message);
        else setError(String(err));
      } finally {
        setLoading(false);
      }
    }
    
    fetchFindings();
  }, [projectId, filterSeverity, filterSpecArea]);

  const updateFindingState = async (findingId: string, payload: Partial<Finding>) => {
    try {
      await fetch(`/api/projects/${projectId}/findings/${findingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      setFindings(prev => prev.map(f => f.id === findingId ? { ...f, ...payload } : f));
    } catch (err) {
      console.error('Failed to update finding', err);
    }
  };

  const toggleComments = async (findingId: string) => {
    const isExpanded = expandedComments[findingId];
    setExpandedComments(prev => ({ ...prev, [findingId]: !isExpanded }));

    if (!isExpanded && !commentsData[findingId]) {
      try {
        const res = await fetch(`/api/projects/${projectId}/findings/${findingId}/comments`);
        const data = await res.json();
        setCommentsData(prev => ({ ...prev, [findingId]: data.comments || [] }));
      } catch (err) {
        console.error('Failed to fetch comments', err);
      }
    }
  };

  const postComment = async (findingId: string) => {
    const content = newComment[findingId];
    if (!content?.trim()) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/findings/${findingId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      
      if (data.comment) {
        setCommentsData(prev => ({
          ...prev,
          [findingId]: [data.comment, ...(prev[findingId] || [])]
        }));
        setNewComment(prev => ({ ...prev, [findingId]: '' }));
      }
    } catch (err) {
      console.error('Failed to post comment', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterSpecArea} onValueChange={setFilterSpecArea}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by Spec Area" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Areas</SelectItem>
            <SelectItem value="auth">Auth</SelectItem>
            <SelectItem value="schema">Schema</SelectItem>
            <SelectItem value="api">API</SelectItem>
            <SelectItem value="architecture">Architecture</SelectItem>
            <SelectItem value="prd">PRD</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : error ? (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-6 text-red-600">
            {error}
          </CardContent>
        </Card>
      ) : findings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="text-4xl mb-4">🎉</div>
            <p>No findings match the current filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {findings.map((finding) => (
            <Card key={finding.id} className="overflow-hidden">
              <div className={`h-1 w-full ${severityColors[finding.severity] || 'bg-gray-500'}`} />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">{finding.severity}</Badge>
                      {finding.specArea} - {finding.specElementRef}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {finding.filePath ? (
                        <code className="text-xs bg-muted p-1 rounded">
                          {finding.filePath}{finding.lineNumber ? `:${finding.lineNumber}` : ''}
                        </code>
                      ) : (
                        <span className="text-xs text-muted-foreground">No specific file</span>
                      )}
                    </CardDescription>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Select 
                      value={finding.assignee?.id || 'unassigned'} 
                      onValueChange={(val) => updateFindingState(finding.id, { assigneeId: val === 'unassigned' ? null : val } as Partial<Finding>)}
                    >
                      <SelectTrigger className="h-8 w-[130px] text-xs">
                        <SelectValue placeholder="Assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {MOCK_TEAM_MEMBERS.map(member => (
                          <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select 
                      value={finding.status} 
                      onValueChange={(val) => updateFindingState(finding.id, { status: val })}
                    >
                      <SelectTrigger className="h-8 w-[130px] text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="assigned">Assigned</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="verified">Verified</SelectItem>
                        <SelectItem value="wont-fix">Won't Fix</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{finding.explanation}</p>
              </CardContent>
              <CardFooter className="flex flex-col items-stretch border-t bg-muted/20 px-6 py-3">
                <div className="flex justify-between items-center w-full">
                  <Button variant="ghost" size="sm" onClick={() => toggleComments(finding.id)}>
                    {expandedComments[finding.id] ? 'Hide Comments' : 'View Comments'}
                  </Button>
                </div>
                
                {expandedComments[finding.id] && (
                  <div className="mt-4 space-y-4 w-full">
                    <div className="space-y-3">
                      {(commentsData[finding.id] || []).map(comment => (
                        <div key={comment.id} className="bg-background border rounded-md p-3 text-sm">
                          <div className="font-semibold mb-1 flex items-center justify-between text-xs">
                            <span>{comment.author?.name || 'Unknown'}</span>
                            <span className="text-muted-foreground">{new Date(comment.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-muted-foreground">{comment.content}</p>
                        </div>
                      ))}
                      {(commentsData[finding.id] || []).length === 0 && (
                        <p className="text-sm text-muted-foreground italic">No comments yet.</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Textarea 
                        placeholder="Add a comment..." 
                        className="min-h-[60px] text-sm"
                        value={newComment[finding.id] || ''}
                        onChange={(e) => setNewComment(prev => ({ ...prev, [finding.id]: e.target.value }))}
                      />
                      <Button onClick={() => postComment(finding.id)}>Post</Button>
                    </div>
                  </div>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
