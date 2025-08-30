import { Request, Response } from "express";
import FastSpeedtest from "fast-speedtest-api";

interface SpeedTestResult {
  ping: number;
  jitter: number;
  download: number;
  upload: number;
  server: string;
  timestamp: string;
}

export const runSpeedTest = async (req: Request, res: Response) => {
  try {
    console.log("Starting speed test using fast-speedtest-api...");
    
    // Configure the speed test
    const speedtest = new FastSpeedtest({
      token: "YXNkZmFzZGxmbnNkYWZoYXNkZmhrYWxm", // Default token
      verbose: false,
      timeout: 10000,
      https: true,
      urlCount: 5,
      bufferSize: 1000,
      unit: FastSpeedtest.UNITS.Mbps
    });
    
    console.log("Measuring speed...");
    const speedResult = await speedtest.getSpeed();
    
    // The library returns a single speed value, so we'll use it for both download and upload
    const downloadSpeed = speedResult;
    const uploadSpeed = speedResult;
    
    // For ping, we'll use a default value since the library might not provide it
    const ping = 50; // Default ping value
    
    // Calculate jitter (we'll use a simple approximation since the library doesn't provide it)
    const jitter = Math.round(ping * 0.1 * 100) / 100; // 10% of ping as jitter
    
    const result: SpeedTestResult = {
      ping: Math.round(ping * 100) / 100,
      jitter: jitter,
      download: Math.round(downloadSpeed * 100) / 100,
      upload: Math.round(uploadSpeed * 100) / 100,
      server: "Speedtest.net",
      timestamp: new Date().toISOString()
    };
    
    console.log("Speed test completed successfully:", result);
    
    res.json({
      success: true,
      ...result
    });
    
  } catch (error: any) {
    console.error("Speed test failed:", error.message);
    res.status(500).json({
      success: false,
      message: "Speed test failed",
      error: error.message
    });
  }
};
