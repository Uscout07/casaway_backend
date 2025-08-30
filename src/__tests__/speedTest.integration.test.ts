import request from 'supertest';
import express from 'express';
import { runSpeedTest } from '../controllers/speedTestController';
import speedTestRoutes from '../routes/speedTest';

// Create a test app
const app = express();
app.use(express.json());
app.use('/api/speedtest', speedTestRoutes);

// Mock authentication middleware for testing
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    // Mock authenticated user
    req.user = { id: 'test-user-id' };
    next();
  }
}));

describe('SpeedTest API Integration Tests', () => {
  describe('POST /api/speedtest', () => {
    it('should return speed test results when API is accessible', async () => {
      // This test will make a real API call to LibreSpeed
      // Note: This might fail if the external API is down
      const response = await request(app)
        .post('/api/speedtest')
        .send({})
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('timestamp');
      
      if (response.body.success) {
        expect(response.body).toHaveProperty('ping');
        expect(response.body).toHaveProperty('jitter');
        expect(response.body).toHaveProperty('download');
        expect(response.body).toHaveProperty('upload');
        expect(response.body).toHaveProperty('server');
        
        // Verify data types
        expect(typeof response.body.ping).toBe('number');
        expect(typeof response.body.jitter).toBe('number');
        expect(typeof response.body.download).toBe('number');
        expect(typeof response.body.upload).toBe('number');
        expect(typeof response.body.server).toBe('string');
        
        // Verify reasonable value ranges
        expect(response.body.ping).toBeGreaterThanOrEqual(0);
        expect(response.body.jitter).toBeGreaterThanOrEqual(0);
        expect(response.body.download).toBeGreaterThanOrEqual(0);
        expect(response.body.upload).toBeGreaterThanOrEqual(0);
        
        // Speed values should be reasonable (not negative, not extremely high)
        expect(response.body.download).toBeLessThan(10000); // Less than 10 Gbps
        expect(response.body.upload).toBeLessThan(10000);   // Less than 10 Gbps
      }
    }, 30000); // 30 second timeout for real API call

    it('should handle malformed request body gracefully', async () => {
      const response = await request(app)
        .post('/api/speedtest')
        .send({ invalid: 'data' })
        .expect(200); // Should still work as the endpoint doesn't validate body

      expect(response.body).toHaveProperty('success');
    });

    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/api/speedtest')
        .send()
        .expect(200);

      expect(response.body).toHaveProperty('success');
    });

    it('should handle large request body', async () => {
      const largeBody = { data: 'x'.repeat(10000) }; // 10KB body
      
      const response = await request(app)
        .post('/api/speedtest')
        .send(largeBody)
        .expect(200);

      expect(response.body).toHaveProperty('success');
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts gracefully', async () => {
      // This test simulates what happens when the external API is slow
      // We can't easily simulate this without mocking, but we can test the structure
      const response = await request(app)
        .post('/api/speedtest')
        .send({})
        .timeout(60000); // 60 second timeout

      // Should either succeed or fail gracefully
      expect([200, 500]).toContain(response.status);
      
      if (response.status === 500) {
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('error');
      }
    }, 60000);
  });

  describe('Response Validation', () => {
    it('should return consistent response structure', async () => {
      const response = await request(app)
        .post('/api/speedtest')
        .send({})
        .expect(200);

      const requiredFields = ['success', 'timestamp'];
      const optionalFields = ['ping', 'jitter', 'download', 'upload', 'server'];

      // Check required fields
      requiredFields.forEach(field => {
        expect(response.body).toHaveProperty(field);
      });

      // Check optional fields if success is true
      if (response.body.success) {
        optionalFields.forEach(field => {
          expect(response.body).toHaveProperty(field);
        });
      }
    });

    it('should return valid timestamp', async () => {
      const response = await request(app)
        .post('/api/speedtest')
        .send({})
        .expect(200);

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp.getTime()).toBeGreaterThan(0);
      expect(timestamp).toBeInstanceOf(Date);
      
      // Timestamp should be recent (within last 5 minutes)
      const now = new Date();
      const timeDiff = now.getTime() - timestamp.getTime();
      expect(timeDiff).toBeLessThan(5 * 60 * 1000); // 5 minutes
    });
  });

  describe('Performance Tests', () => {
    it('should respond within reasonable time', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/speedtest')
        .send({})
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Response should be within 30 seconds (external API call)
      expect(responseTime).toBeLessThan(30000);
      
      console.log(`Speed test response time: ${responseTime}ms`);
    }, 30000);

    it('should handle concurrent requests', async () => {
      const concurrentRequests = 3;
      const promises = Array(concurrentRequests).fill(null).map(() =>
        request(app)
          .post('/api/speedtest')
          .send({})
          .expect(200)
      );

      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.body).toHaveProperty('success');
      });
    }, 60000);
  });
});
