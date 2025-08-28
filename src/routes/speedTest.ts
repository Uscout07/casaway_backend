import express from 'express';
import { authenticateToken } from '../middleware/auth';
import axios from 'axios';
import asyncHandler from '../utils/asyncHandler';

const router = express.Router();

// Function to measure download speed
const measureDownloadSpeed = async (url: string, timeout: number = 10000): Promise<number> => {
  const startTime = Date.now();
  
  try {
    const response = await axios.get(url, {
      timeout,
      responseType: 'arraybuffer',
      maxContentLength: 50 * 1024 * 1024, // 50MB max
    });
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000; // Convert to seconds
    const sizeInBytes = response.data.length;
    const sizeInMbps = (sizeInBytes * 8) / (1024 * 1024); // Convert bytes to Mbps
    const speedMbps = sizeInMbps / duration;
    
    return speedMbps;
  } catch (error) {
    console.error('Download speed test error:', error);
    throw new Error('Download speed test failed');
  }
};

// Function to measure upload speed
const measureUploadSpeed = async (url: string, dataSize: number, timeout: number = 10000): Promise<number> => {
  const startTime = Date.now();
  
  try {
    // Create a buffer of specified size
    const buffer = Buffer.alloc(dataSize);
    
    const response = await axios.post(url, buffer, {
      timeout,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    });
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000; // Convert to seconds
    const sizeInMbps = (dataSize * 8) / (1024 * 1024); // Convert bytes to Mbps
    const speedMbps = sizeInMbps / duration;
    
    return speedMbps;
  } catch (error) {
    console.error('Upload speed test error:', error);
    throw new Error('Upload speed test failed');
  }
};

// Function to round to nearest 10
const roundToNearest10 = (value: number): number => {
  return Math.round(value / 10) * 10;
};

// Speed test endpoint
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
  try {
    console.log('[SPEEDTEST] Starting speed test for user:', req.userId);
    
    // Test URLs for download speed testing
    const downloadUrls = [
      'https://speed.cloudflare.com/__down?bytes=5242880', // 5MB
      'https://speed.cloudflare.com/__down?bytes=10485760', // 10MB
      'https://speed.cloudflare.com/__down?bytes=20971520', // 20MB
    ];
    
    // Test URL for upload speed testing
    const uploadUrl = 'https://httpbin.org/post';
    
    let downloadSpeed = 0;
    let uploadSpeed = 0;
    
    // Measure download speed (average of multiple tests)
    console.log('[SPEEDTEST] Testing download speed...');
    const downloadSpeeds = [];
    for (const url of downloadUrls) {
      try {
        const speed = await measureDownloadSpeed(url, 15000);
        downloadSpeeds.push(speed);
      } catch (error) {
        console.error(`[SPEEDTEST] Download test failed for ${url}:`, error);
      }
    }
    
    if (downloadSpeeds.length > 0) {
      downloadSpeed = downloadSpeeds.reduce((sum, speed) => sum + speed, 0) / downloadSpeeds.length;
    }
    
    // Measure upload speed
    console.log('[SPEEDTEST] Testing upload speed...');
    try {
      uploadSpeed = await measureUploadSpeed(uploadUrl, 1024 * 1024, 15000); // 1MB upload test
    } catch (error) {
      console.error('[SPEEDTEST] Upload test failed:', error);
    }
    
    // Round speeds to nearest 10
    const roundedDownload = roundToNearest10(downloadSpeed);
    const roundedUpload = roundToNearest10(uploadSpeed);
    
    // Ensure minimum values
    const finalDownload = Math.max(roundedDownload, 10);
    const finalUpload = Math.max(roundedUpload, 5);
    
    console.log('[SPEEDTEST] Speed test completed:', {
      original: { download: downloadSpeed, upload: uploadSpeed },
      rounded: { download: finalDownload, upload: finalUpload }
    });
    
    res.json({
      success: true,
      download: finalDownload,
      upload: finalUpload,
      message: 'Speed test completed successfully'
    });
    
  } catch (error) {
    console.error('[SPEEDTEST] Speed test error:', error);
    res.status(500).json({
      success: false,
      msg: 'Speed test failed. Please try again.',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

export default router;
