/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    selectDirectory: () => Promise<string>
    selectFile: (filters: any[]) => Promise<string>
    saveFile: (defaultPath: string, filters: any[]) => Promise<string>
    readFile: (filePath: string) => Promise<Buffer>
    writeFile: (filePath: string, data: string) => Promise<boolean>
    getAppPath: () => Promise<string>
  }
}

declare module '*.module' {
  interface ProcessEnv {
    DIST: string
    VITE_PUBLIC: string
    VITE_DEV_SERVER_URL: string
  }
}
