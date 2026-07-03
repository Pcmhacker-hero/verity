/**
 * Prompt Builder — Doc 13 §5.
 *
 * Provides system and user prompt templates for all generation stages.
 */

import type { ARTIFACT_TYPES } from '@verity/shared/types';
import { ContextManager } from './context-manager.js';

export class PromptBuilder {
  static getSystemPrompt(artifactType: typeof ARTIFACT_TYPES[number]): string {
    const baseSystem = `You are a Principal Software Architect and Staff Engineer. Your goal is to design robust, production-grade software specifications.
You must output ONLY valid JSON adhering strictly to the requested schema. Do NOT include markdown code blocks (e.g. \`\`\`json) or any conversational text.`;

    switch (artifactType) {
      case 'prd':
        return `${baseSystem}\nDraft a comprehensive Product Requirements Document (PRD) focusing on problem statement, target users, features, non-goals, and success criteria.`;
      case 'architecture':
        return `${baseSystem}\nDesign the System Architecture based on the provided PRD. Break down the system into core components and outline the data flow between them. Ensure all features from the PRD are mapped to architectural components.`;
      case 'schema':
        return `${baseSystem}\nDesign a highly normalized Relational Database Schema. Map entities to the Architecture components. Include primary keys (UUID), data types, required flags, and foreign keys.`;
      case 'api':
        return `${baseSystem}\nDesign a RESTful API Specification. Map endpoints to the Database Schema entities. Define methods, paths, request/response shapes, and authentication requirements.`;
      case 'repo_structure':
        return `${baseSystem}\nDesign a monorepo file structure tree mapping to the Architecture and API specifications. Separate apps, packages, and services.`;
      case 'roadmap':
        return `${baseSystem}\nDefine an implementation Roadmap divided into logical phases, ensuring dependencies are respected.`;
      case 'tasks':
        return `${baseSystem}\nBreak down the entire specification into granular, actionable Implementation Tasks. Map each task to a roadmap phase, PRD feature, Architecture component, Schema entity, and API endpoint.`;
      default:
        return baseSystem;
    }
  }

  static getUserPrompt(
    artifactType: typeof ARTIFACT_TYPES[number],
    ideaText: string,
    contextArtifacts: Record<string, any>
  ): string {
    const contextString = ContextManager.serializeContext(contextArtifacts);
    
    let prompt = `Original User Idea:\n${ideaText}\n\n`;
    
    if (contextString) {
      prompt += `Existing Context (Strictly adhere to and build upon these previous decisions):\n${contextString}\n\n`;
    }

    prompt += `Please generate the ${artifactType.toUpperCase()} artifact as a JSON object.`;
    return prompt;
  }
}
