// Stub type definition for minimatch to prevent TypeScript errors
// minimatch provides its own types, but this stub prevents implicit type library errors
declare module 'minimatch' {
  export function minimatch(target: string, pattern: string, options?: any): boolean;
  export default minimatch;
}

