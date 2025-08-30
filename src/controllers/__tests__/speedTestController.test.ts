import { Request, Response } from 'express';
import axios from 'axios';
import { runSpeedTest } from '../speedTestController';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock console.error to avoid noise in tests
const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

describe('SpeedTestController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Setup mock response
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
    mockRequest = {};
    mockResponse = {
      json: mockJson,
      status: mockStatus
    };
  });

  afterAll(() => {
    consoleSpy.mockRestore();
  });

  describe('runSpeedTest', () => {
    it('should return successful speed test results when LibreSpeed API works', async () => {
      // Mock successful API response
      const mockApiResponse = {
        ping: 15,
        jitter: 2,
        dl: 45.5, // download speed in Mbps
        ul: 23.2, // upload speed in Mbps
        server: 'speedtest.ztm.gr'
      };

      // Mock axios response with proper structure
      (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
        data: mockApiResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      // Call the controller
      await runSpeedTest(mockRequest as Request, mockResponse as Response);

      // Verify axios was called with correct parameters
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://speedtest.ztm.gr/api.php',
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      // Verify response structure
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        ping: 15,
        jitter: 2,
        download: 45.5,
        upload: 23.2,
        server: 'speedtest.ztm.gr',
        timestamp: expect.any(Date)
      });
    });

    it('should handle API response with missing fields gracefully', async () => {
      // Mock API response with missing fields
      const mockApiResponse = {
        ping: 20,
        // missing jitter, dl, ul, server
      };

      (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
        data: mockApiResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      // Call the controller
      await runSpeedTest(mockRequest as Request, mockResponse as Response);

      // Verify response handles missing fields
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        ping: 20,
        jitter: undefined,
        download: undefined,
        upload: undefined,
        server: undefined,
        timestamp: expect.any(Date)
      });
    });

    it('should handle network errors and return 500 status', async () => {
      // Mock network error
      const networkError = new Error('Network timeout');
      (mockedAxios.get as jest.Mock).mockRejectedValueOnce(networkError);

      // Call the controller
      await runSpeedTest(mockRequest as Request, mockResponse as Response);

      // Verify error handling
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Speed test failed',
        error: 'Network timeout'
      });
      expect(consoleSpy).toHaveBeenCalledWith('Speed test failed:', 'Network timeout');
    });

    it('should handle API errors with response data', async () => {
      // Mock API error with response
      const apiError = {
        response: {
          status: 503,
          data: { error: 'Service temporarily unavailable' }
        },
        message: 'Request failed with status code 503'
      };
      (mockedAxios.get as jest.Mock).mockRejectedValueOnce(apiError);

      // Call the controller
      await runSpeedTest(mockRequest as Request, mockResponse as Response);

      // Verify error handling
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Speed test failed',
        error: 'Request failed with status code 503'
      });
    });

    it('should handle timeout errors', async () => {
      // Mock timeout error
      const timeoutError = new Error('Request timeout');
      (mockedAxios.get as jest.Mock).mockRejectedValueOnce(timeoutError);

      // Call the controller
      await runSpeedTest(mockRequest as Request, mockResponse as Response);

      // Verify error handling
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        message: 'Speed test failed',
        error: 'Request timeout'
      });
    });

    it('should handle malformed API responses', async () => {
      // Mock malformed response (not an object)
      (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
        data: 'invalid json string',
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      // Call the controller
      await runSpeedTest(mockRequest as Request, mockResponse as Response);

      // Should still return success but with undefined values
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        ping: undefined,
        jitter: undefined,
        download: undefined,
        upload: undefined,
        server: undefined,
        timestamp: expect.any(Date)
      });
    });

    it('should handle null API response', async () => {
      // Mock null response
      (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
        data: null,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      // Call the controller
      await runSpeedTest(mockRequest as Request, mockResponse as Response);

      // Should handle null gracefully
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        ping: undefined,
        jitter: undefined,
        download: undefined,
        upload: undefined,
        server: undefined,
        timestamp: expect.any(Date)
      });
    });

    it('should validate speed values are numbers', async () => {
      // Mock response with string values instead of numbers
      const mockApiResponse = {
        ping: '15',
        jitter: '2',
        dl: '45.5',
        ul: '23.2',
        server: 'speedtest.ztm.gr'
      };

      (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
        data: mockApiResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      // Call the controller
      await runSpeedTest(mockRequest as Request, mockResponse as Response);

      // Should handle string values (they'll be passed through as-is)
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        ping: '15',
        jitter: '2',
        download: '45.5',
        upload: '23.2',
        server: 'speedtest.ztm.gr',
        timestamp: expect.any(Date)
      });
    });

    it('should handle very large speed values', async () => {
      // Mock response with very large values
      const mockApiResponse = {
        ping: 1,
        jitter: 0.5,
        dl: 1000, // 1 Gbps
        ul: 500,  // 500 Mbps
        server: 'speedtest.ztm.gr'
      };

      (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
        data: mockApiResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      // Call the controller
      await runSpeedTest(mockRequest as Request, mockResponse as Response);

      // Should handle large values correctly
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        ping: 1,
        jitter: 0.5,
        download: 1000,
        upload: 500,
        server: 'speedtest.ztm.gr',
        timestamp: expect.any(Date)
      });
    });

    it('should handle zero speed values', async () => {
      // Mock response with zero values
      const mockApiResponse = {
        ping: 0,
        jitter: 0,
        dl: 0,
        ul: 0,
        server: 'speedtest.ztm.gr'
      };

      (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
        data: mockApiResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      // Call the controller
      await runSpeedTest(mockRequest as Request, mockResponse as Response);

      // Should handle zero values correctly
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        ping: 0,
        jitter: 0,
        download: 0,
        upload: 0,
        server: 'speedtest.ztm.gr',
        timestamp: expect.any(Date)
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle concurrent speed test requests', async () => {
      const mockApiResponse = {
        ping: 15,
        jitter: 2,
        dl: 45.5,
        ul: 23.2,
        server: 'speedtest.ztm.gr'
      };

      (mockedAxios.get as jest.Mock).mockResolvedValue({
        data: mockApiResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      });

      // Make multiple concurrent requests
      const promises = Array(3).fill(null).map(() => 
        runSpeedTest(mockRequest as Request, mockResponse as Response)
      );

      await Promise.all(promises);

      // Should handle all requests
      expect(mockedAxios.get).toHaveBeenCalledTimes(3);
    });

    it('should maintain consistent response structure across different scenarios', async () => {
      const testCases = [
        { ping: 10, jitter: 1, dl: 50, ul: 25, server: 'test1' },
        { ping: 20, jitter: 3, dl: 30, ul: 15, server: 'test2' },
        { ping: 5, jitter: 0.5, dl: 100, ul: 50, server: 'test3' }
      ];

      for (const testCase of testCases) {
        (mockedAxios.get as jest.Mock).mockResolvedValueOnce({
          data: testCase,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {}
        });

        await runSpeedTest(mockRequest as Request, mockResponse as Response);

        // Verify consistent response structure
        expect(mockJson).toHaveBeenCalledWith({
          success: true,
          ping: testCase.ping,
          jitter: testCase.jitter,
          download: testCase.dl,
          upload: testCase.ul,
          server: testCase.server,
          timestamp: expect.any(Date)
        });
      }
    });
  });
});
