/**
 * Deterministic Diff Engine for Spec Artifacts
 * 
 * Generates mechanical change summaries when an artifact is updated via PUT.
 * This satisfies the "Change summary generation" requirement without AI (Doc 14).
 */

export function generateChangeSummary(artifactType: string, oldObj: any, newObj: any): string {
  if (!oldObj) return `Created initial ${artifactType} artifact.`;

  const changes: string[] = [];

  for (const key of Object.keys(newObj)) {
    // Ignore IDs
    if (key === 'id') continue;

    const oldVal = oldObj[key];
    const newVal = newObj[key];

    if (Array.isArray(newVal) && Array.isArray(oldVal)) {
      const oldIds = new Set(oldVal.map((item: any) => item.id).filter(Boolean));
      const newIds = new Set(newVal.map((item: any) => item.id).filter(Boolean));

      let added = 0;
      let removed = 0;
      let modified = 0;

      for (const item of newVal) {
        if (item.id && !oldIds.has(item.id)) {
          added++;
        } else if (item.id && oldIds.has(item.id)) {
          // A very rudimentary modification check (just stringify comparison)
          const oldItem = oldVal.find((o: any) => o.id === item.id);
          if (JSON.stringify(oldItem) !== JSON.stringify(item)) {
            modified++;
          }
        }
      }

      for (const id of oldIds) {
        if (!newIds.has(id)) {
          removed++;
        }
      }

      const listChanges = [];
      if (added > 0) listChanges.push(`added ${added}`);
      if (removed > 0) listChanges.push(`removed ${removed}`);
      if (modified > 0) listChanges.push(`modified ${modified}`);

      if (listChanges.length > 0) {
        changes.push(`In ${key}: ${listChanges.join(', ')}`);
      }
    } else if (typeof newVal === 'object' && newVal !== null) {
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push(`Modified ${key}`);
      }
    } else {
      if (oldVal !== newVal) {
        changes.push(`Updated ${key}`);
      }
    }
  }

  if (changes.length === 0) {
    return `No structural changes detected in ${artifactType}.`;
  }

  return `Changes in ${artifactType}: ` + changes.join('; ');
}
