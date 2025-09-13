import { Request, Response } from 'express';
import WebSocket from 'ws';

export const runSpeedTest = async (req: Request, res: Response) => {
  const serverUrl = 'wss://ndt.websocket.measurementlab.net/ndt/v7';  // FIXED URL
  
  try {
    const result = await new Promise<{ download: string; upload: string; ping: string; server: string }>((resolve, reject) => {
      const ws = new WebSocket(serverUrl);

      let startTime = Date.now();
      let bytesReceived = 0;

      ws.on('open', () => {
        console.log('WebSocket connected to M-Lab NDT7 server');
      });

      ws.on('message', (data) => {
        bytesReceived += (data as Buffer).length;
      });

      ws.on('close', () => {
        const durationSeconds = (Date.now() - startTime) / 1000;
        const downloadMbps = ((bytesReceived * 8) / durationSeconds / 1e6).toFixed(2);

        resolve({
          download: downloadMbps,
          upload: 'N/A',
          ping: 'N/A',
          server: serverUrl,
        });
      });

      ws.on('error', (err) => {
        reject(err);
      });

      setTimeout(() => ws.close(), 10000);  // 10s test duration
    });

    res.json(result);
  } catch (err) {
    console.error('NDT7 Speedtest failed:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Speedtest failed', details: errorMessage });
    
  }
};
