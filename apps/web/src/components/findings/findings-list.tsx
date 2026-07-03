'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
}

const severityColors = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
  info: 'bg-gray-500',
};

export function FindingsList({ projectId }: { projectId: string }) {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterSpecArea, setFilterSpecArea] = useState<string>('all');
  
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
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchFindings();
  }, [projectId, filterSeverity, filterSpecArea]);

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
                  <Badge variant="secondary" className="capitalize">{finding.detectionTier} Tier</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{finding.explanation}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
