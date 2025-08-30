declare module 'fast-speedtest-api' {
  export interface SpeedTestOptions {
    token?: string;
    verbose?: boolean;
    timeout?: number;
    https?: boolean;
    urlCount?: number;
    bufferSize?: number;
    unit?: string;
  }

  export interface SpeedTestResult {
    download: number;
    upload: number;
    ping?: number;
  }

  export default class FastSpeedtest {
    constructor(options?: SpeedTestOptions);
    
    static UNITS: {
      Mbps: string;
      Kbps: string;
      Bps: string;
    };

    getSpeed(): Promise<number>;
    getDownloadSpeed(): Promise<number>;
    getUploadSpeed(): Promise<number>;
    getPing(): Promise<number>;
  }
}
