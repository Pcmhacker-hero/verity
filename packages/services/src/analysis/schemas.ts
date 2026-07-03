import { z } from 'zod';

export const fileAnalysisSchema = z.object({
  dependencies: z.array(z.string()).describe("List of external packages or core modules imported by this file"),
  architecture: z.array(z.string()).describe("List of architectural patterns detected (e.g. MVC, Singleton, Provider, React Hook, etc.)"),
  codeQuality: z.array(z.string()).describe("List of code quality observations or potential improvements"),
  security: z.array(z.string()).describe("List of security observations or potential vulnerabilities (e.g. SQL injection, XSS, unvalidated inputs)"),
  performance: z.array(z.string()).describe("List of performance observations or potential bottlenecks"),
  documentation: z.array(z.string()).describe("List of observations regarding documentation clarity and completeness"),
});

export type FileAnalysisResult = z.infer<typeof fileAnalysisSchema>;
