/**
 * Rule Engine — Tier 1 Deterministic Verification.
 * Plugin-based architecture for verification rules.
 */

import type { Checker, VerificationContext, CheckerResult } from './types.js';

export interface RulePlugin {
  name: string;
  version: string;
  description: string;
  checker: Checker;
  enabled: boolean;
  dependsOn?: string[];
}

export class RuleEngine {
  private plugins: Map<string, RulePlugin> = new Map();
  private executionOrder: string[] = [];

  register(plugin: RulePlugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Rule plugin "${plugin.name}" already registered`);
    }
    this.plugins.set(plugin.name, plugin);
    this.updateExecutionOrder();
  }

  unregister(name: string): boolean {
    const removed = this.plugins.delete(name);
    if (removed) {
      this.updateExecutionOrder();
    }
    return removed;
  }

  get(name: string): RulePlugin | undefined {
    return this.plugins.get(name);
  }

  getAll(): RulePlugin[] {
    return Array.from(this.plugins.values());
  }

  getEnabled(): RulePlugin[] {
    return this.getAll().filter(p => p.enabled);
  }

  enable(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    plugin.enabled = true;
    this.updateExecutionOrder();
    return true;
  }

  disable(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    plugin.enabled = false;
    this.updateExecutionOrder();
    return true;
  }

  async runAll(context: VerificationContext, options?: {
    onProgress?: (pluginName: string, result: CheckerResult) => void;
    signal?: AbortSignal;
  }): Promise<Map<string, CheckerResult>> {
    const results = new Map<string, CheckerResult>();
    const enabledPlugins = this.getEnabled();

    for (const plugin of enabledPlugins) {
      if (options?.signal?.aborted) {
        throw new Error('VERIFICATION_CANCELLED');
      }

      try {
        const result = await plugin.checker.check(context);
        results.set(plugin.name, result);
        options?.onProgress?.(plugin.name, result);
      } catch (error) {
        // Record error but continue with other plugins
        results.set(plugin.name, {
          findings: [{
            severity: 'critical',
            specArea: 'other',
            specElementRef: `RuleEngine:${plugin.name}`,
            explanation: `Rule "${plugin.name}" failed: ${error instanceof Error ? error.message : String(error)}`,
            detectionTier: 'deterministic',
            status: 'open',
          }],
          durationMs: 0,
          filesProcessed: 0,
        });
      }
    }

    return results;
  }

  private updateExecutionOrder(): void {
    // Topological sort based on dependencies
    const enabled = this.getEnabled();
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (name: string): void => {
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected in rule plugins involving "${name}"`);
      }
      if (visited.has(name)) return;

      visiting.add(name);
      const plugin = this.plugins.get(name);
      if (plugin?.dependsOn) {
        for (const dep of plugin.dependsOn) {
          if (this.plugins.has(dep) && this.plugins.get(dep)!.enabled) {
            visit(dep);
          }
        }
      }
      visiting.delete(name);
      visited.add(name);
      order.push(name);
    }

    for (const plugin of enabled) {
      if (!visited.has(plugin.name)) {
        visit(plugin.name);
      }
    }

    this.executionOrder = order;
  }

  getExecutionOrder(): string[] {
    return [...this.executionOrder];
  }
}

// Global rule engine instance
export const ruleEngine = new RuleEngine();