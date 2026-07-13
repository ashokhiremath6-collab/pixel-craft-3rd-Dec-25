const PINNED = ["Shamrock", "Maker Tower", "Little Gibbs"];

export function sortProjectsForDropdown<T extends { projectName: string }>(projects: T[]): T[] {
  return [...projects].sort((a, b) => {
    const ai = PINNED.indexOf(a.projectName);
    const bi = PINNED.indexOf(b.projectName);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.projectName.localeCompare(b.projectName);
  });
}
