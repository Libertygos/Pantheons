/**
 * WoG convention (versions.md): display "version X.Y.Z" at the bottom of the landing page,
 * read from the repo-root versions.md topmost `# Version` heading at build time.
 */
import raw from '../../versions.md?raw';

export const APP_VERSION: string = /^#\s*Version\s+(\S+)/m.exec(raw)?.[1] ?? 'dev';
