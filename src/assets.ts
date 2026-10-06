// Keep public assets relative to the deployment root, including Pages subpaths.
export function publicAsset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}
