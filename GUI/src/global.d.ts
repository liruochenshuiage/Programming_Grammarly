// global.d.ts
declare module '*.png' {
    const value: string;
    export default value;
  }
  declare module '*.jpg';
  declare module '*.jpeg';
  declare module '*.gif';
  declare module 'remark-gfm';
  declare module 'rehype-highlight';
  declare module 'rehype-raw';
  // 也可以按需加其他文件类型
  