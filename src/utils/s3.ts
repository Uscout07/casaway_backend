
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from 'uuid';

console.log(process.env.AWS_ACCESS_KEY_ID, process.env.AWS_SECRET_ACCESS_KEY, process.env.AWS_REGION, process.env.jwtSecret, process.env.AWS_S3_BUCKET_NAME);

console.log("AWS_REGION:", process.env.AWS_REGION);
console.log("AWS_ACCESS_KEY_ID:", process.env.AWS_ACCESS_KEY_ID ? "✅ loaded" : "❌ missing");
console.log("AWS_SECRET_ACCESS_KEY:", process.env.AWS_SECRET_ACCESS_KEY ? "✅ loaded" : "❌ missing");
console.log("AWS_S3_BUCKET_NAME:", process.env.AWS_S3_BUCKET_NAME);


const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

export const uploadToS3 = async (file: Express.Multer.File) => {
    const key = `uploads/${uuidv4()}-${file.originalname}`;
    const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
    });

    try {
        await s3.send(command);
        return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    } catch (error) {
        console.error("Error uploading to S3:", error);
        if (error instanceof Error) {
            console.error("S3 Error Name:", error.name);
            console.error("S3 Error Message:", error.message);
        }
        throw error;
    }
};
