export const VERSION_CONFIG = {
  MAJOR: 1,
  MINOR: 1,
  PATCH: 0,
};

export const getVersionString = () => {
  const { MAJOR, MINOR, PATCH } = VERSION_CONFIG;
  const version = `${MAJOR}.${MINOR}.${PATCH}`;
  
  // Use Vite's environment variables or defined constants
  const isDev = import.meta.env.DEV;
  const commitSha = import.meta.env.VITE_COMMIT_SHA || '';
  
  if (isDev) {
    return `v${version}-dev`;
  }
  
  if (commitSha) {
    return `v${version}+sha.${commitSha.substring(0, 7)}`;
  }
  
  return `v${version} (Prod)`;
};
