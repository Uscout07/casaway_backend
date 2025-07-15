import { Router } from 'express';
import { uploadSpeedTest } from '../controllers/speedTestController';
import multer from 'multer';

const router = Router();

// Configure multer for memory storage for this route
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Define the upload speed test route
// Use upload.single('speedTestFile') middleware to handle a single file upload
router.post('/upload', upload.single('speedTestFile'), uploadSpeedTest);

export default router;
