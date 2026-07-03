import type { ZodSchema, ZodError } from 'zod';
import { VerityError } from '@verity/shared/errors';

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  zodError?: ZodError;
}

export class StructuredOutputParser {
  /**
   * Attempts to parse and validate an LLM string response against a Zod schema.
   * Handles markdown stripping and basic JSON repair before validation.
   */
  static parse<T>(text: string, schema: ZodSchema<T>): ParseResult<T> {
    let cleaned = this.stripMarkdown(text);
    
    let parsedJson: any;
    try {
      parsedJson = JSON.parse(cleaned);
    } catch (e: any) {
      // Try some basic repairs before giving up
      cleaned = this.repairJson(cleaned);
      try {
        parsedJson = JSON.parse(cleaned);
      } catch (e2: any) {
        return {
          success: false,
          error: `Failed to parse JSON: ${e2.message}. Original text: ${text.substring(0, 100)}...`,
        };
      }
    }

    const result = schema.safeParse(parsedJson);
    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    } else {
      return {
        success: false,
        error: `Schema validation failed: ${result.error.message}`,
        zodError: result.error,
      };
    }
  }

  /**
   * Strips markdown JSON blocks if the LLM wrapped its output.
   */
  private static stripMarkdown(text: string): string {
    const trimmed = text.trim();
    if (trimmed.startsWith('```')) {
      const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return trimmed;
  }

  /**
   * Very basic JSON heuristics to fix common LLM mistakes.
   */
  private static repairJson(text: string): string {
    let repaired = text;
    
    // Fix trailing commas in objects or arrays
    repaired = repaired.replace(/,\s*([\]}])/g, '$1');
    
    // Sometimes LLMs cut off the final brace due to token limits. 
    // A robust repair engine would count braces. For this MVP, we 
    // assume standard LLM outputs and just strip trailing commas.
    return repaired;
  }

  /**
   * Generates a corrective prompt based on a Zod validation error.
   */
  static generateCorrectionPrompt(zodError: ZodError): string {
    const errors = zodError.errors.map(err => {
      const path = err.path.join('.');
      return `- Field '${path}': ${err.message}`;
    });

    return `Your previous output failed JSON schema validation with the following errors:

${errors.join('\n')}

Please provide the corrected JSON strictly adhering to the schema. Do not include any explanations.`;
  }
}
