import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Email configuration
const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
};

// Create transporter
const transporter = nodemailer.createTransport(emailConfig);

// Email templates
const emailTemplates = {
  passwordReset: (username: string, resetToken: string, resetUrl: string) => ({
    subject: 'Password Reset Request - Casaway',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - Casaway</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #214F3F; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #214F3F; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          .token { background: #e8f5e8; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 14px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${username}!</h2>
            <p>We received a request to reset your password for your Casaway account.</p>
            
            <p>To reset your password, please use the verification token below:</p>
            
            <div class="token">
              <strong>Verification Token:</strong><br>
              ${resetToken}
            </div>
            
            <p><strong>Important:</strong></p>
            <ul>
              <li>This token is valid for 1 hour only</li>
              <li>If you didn't request this password reset, please ignore this email</li>
              <li>For security reasons, never share this token with anyone</li>
            </ul>
            
            <p>If you're having trouble, you can also copy and paste this token directly into the app.</p>
            
            <div class="footer">
              <p>This is an automated message from Casaway. Please do not reply to this email.</p>
              <p>If you have any questions, please contact our support team.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Password Reset Request - Casaway

Hello ${username}!

We received a request to reset your password for your Casaway account.

To reset your password, please use the verification token below:

Verification Token: ${resetToken}

Important:
- This token is valid for 1 hour only
- If you didn't request this password reset, please ignore this email
- For security reasons, never share this token with anyone

If you're having trouble, you can also copy and paste this token directly into the app.

This is an automated message from Casaway. Please do not reply to this email.
If you have any questions, please contact our support team.
    `
  }),
};

// Email service functions
export const emailService = {
  // Send password reset email
  async sendPasswordResetEmail(userEmail: string, username: string, resetToken: string): Promise<boolean> {
    try {
      const template = emailTemplates.passwordReset(username, resetToken, '');
      
      const mailOptions = {
        from: `"Casaway Support" <${process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Password reset email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return false;
    }
  },

  // Verify email configuration
  async verifyConnection(): Promise<boolean> {
    try {
      await transporter.verify();
      console.log('Email service is ready');
      return true;
    } catch (error) {
      console.error('Email service configuration error:', error);
      return false;
    }
  },
};

export default emailService;
