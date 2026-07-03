/** File filter — Doc 18 §13.2. Excludes non-analyzable files. */
export function filterRepoFiles(_files: string[]): string[] {
  // TODO: Exclude .gitignore matches, binaries, node_modules, lock files, >100KB files
  return [];
}
