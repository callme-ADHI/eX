/// <reference types="vite/client" />
/// <reference types="chrome" />

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
