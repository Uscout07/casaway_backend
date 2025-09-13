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

  passwordResetCode: (username: string, resetCode: string) => ({
    subject: 'Password Reset Code - Casaway',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Code - Casaway</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #214F3F; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .code { background: #e8f5e8; padding: 20px; border-radius: 8px; font-family: monospace; font-size: 32px; font-weight: bold; text-align: center; margin: 20px 0; letter-spacing: 8px; color: #214F3F; border: 2px solid #214F3F; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Code</h1>
          </div>
          <div class="content">
            <h2>Hello ${username}!</h2>
            <p>We received a request to reset your password for your Casaway account.</p>
            
            <p>Please use the following verification code to reset your password:</p>
            
            <div class="code">
              ${resetCode}
            </div>
            
            <div class="warning">
              <p><strong>⚠️ Important Security Information:</strong></p>
              <ul>
                <li>This code is valid for <strong>15 minutes only</strong></li>
                <li>If you didn't request this password reset, please ignore this email</li>
                <li>Never share this code with anyone - Casaway will never ask for it</li>
                <li>Enter this code in the app to complete your password reset</li>
              </ul>
            </div>
            
            <p>If you're having trouble, you can copy and paste this code: <strong>${resetCode}</strong></p>
            
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
Password Reset Code - Casaway

Hello ${username}!

We received a request to reset your password for your Casaway account.

Please use the following verification code to reset your password:

VERIFICATION CODE: ${resetCode}

⚠️ Important Security Information:
- This code is valid for 15 minutes only
- If you didn't request this password reset, please ignore this email
- Never share this code with anyone - Casaway will never ask for it
- Enter this code in the app to complete your password reset

If you're having trouble, you can copy and paste this code: ${resetCode}

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

  // Send password reset code
  async sendPasswordResetCode(userEmail: string, username: string, resetCode: string): Promise<boolean> {
    try {
      const template = emailTemplates.passwordResetCode(username, resetCode);
      
      const mailOptions = {
        from: `"Casaway Support" <${process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: template.subject,
        html: template.html,
        text: template.text,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Password reset code sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending password reset code:', error);
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
