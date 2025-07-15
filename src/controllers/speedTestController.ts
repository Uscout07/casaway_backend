import { Request, Response } from 'express';
import multer from 'multer';

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

export const uploadSpeedTest = (req: Request, res: Response) => {
    // Multer processes the file and attaches it to req.file
    // We don't need to save the file, just acknowledge its receipt
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded for speed test.' });
    }

    // Respond to indicate successful receipt
    res.status(200).json({
        message: 'File received for upload speed test.',
        fileSize: req.file.size,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
    });
};
