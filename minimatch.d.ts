// Type declaration for minimatch to resolve TypeScript build errors
declare module 'minimatch' {
  export function minimatch(target: string, pattern: string, options?: any): boolean;
  export default minimatch;
}

