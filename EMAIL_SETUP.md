# Email Setup Guide for Casaway Backend

This guide explains how to set up email functionality for password reset and other email notifications in the Casaway backend.

## 📧 Email Service Overview

The email service uses **Nodemailer** to send emails through SMTP. It's currently configured for:
- Password reset emails with verification tokens
- Professional HTML email templates
- Fallback text-only emails

## 🚀 Quick Setup

### 1. Choose Your Email Provider

#### Option A: Gmail (Recommended for Development)
1. Go to your Google Account settings
2. Enable 2-Factor Authentication
3. Generate an "App Password":
   - Go to Security → App passwords
   - Select "Mail" and your device
   - Copy the generated 16-character password

#### Option B: Outlook/Hotmail
- Use your regular email and password
- No additional setup required

#### Option C: Custom SMTP Server
- Contact your email provider for SMTP settings

### 2. Configure Environment Variables

Add these variables to your `.env` file:

```env
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### 3. Test the Configuration

The email service will automatically verify the connection when the server starts. Check the console logs for:
- ✅ "Email service is ready" - Configuration is correct
- ❌ "Email service configuration error" - Check your credentials

## 🔧 Email Service Features

### Password Reset Flow
1. User requests password reset
2. System generates secure token (valid for 1 hour)
3. Email sent with verification token
4. User enters token in app to reset password
5. Token is invalidated after use

### Email Template Features
- ✅ Professional HTML design
- ✅ Mobile-responsive layout
- ✅ Casaway branding colors
- ✅ Clear instructions and security warnings
- ✅ Fallback text-only version

## 🛠️ Troubleshooting

### Common Issues

#### "Email service configuration error"
- Check your email credentials
- Verify 2FA is enabled (for Gmail)
- Ensure you're using an App Password (for Gmail)
- Check firewall/network restrictions

#### "Email delivery failed"
- Check spam folder
- Verify email address is correct
- Try a different email provider
- Check SMTP port settings

#### Gmail-specific Issues
- Make sure you're using an App Password, not your regular password
- Enable "Less secure app access" (not recommended for production)
- Check if your account has any restrictions

### Testing Email Service

You can test the email service by:
1. Starting the server
2. Making a password reset request
3. Checking the console logs for email delivery status
4. Verifying the email arrives in the inbox

## 🚀 Production Deployment

### Recommended Email Services for Production

1. **SendGrid** - Popular, reliable, good free tier
2. **Mailgun** - Developer-friendly, good API
3. **Amazon SES** - Cost-effective for high volume
4. **Resend** - Modern, developer-focused

### Environment Variables for Production

```env
# Example: SendGrid
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=your-sendgrid-api-key

# Example: Mailgun
EMAIL_HOST=smtp.mailgun.org
EMAIL_PORT=587
EMAIL_USER=your-mailgun-username
EMAIL_PASS=your-mailgun-password
```

### Security Considerations

1. **Never commit email credentials to version control**
2. **Use environment variables for all sensitive data**
3. **Rotate email passwords regularly**
4. **Monitor email delivery rates**
5. **Implement rate limiting for password reset requests**

## 📝 Email Templates

The email templates are located in `src/utils/emailService.ts` and include:

- **HTML version**: Professional design with styling
- **Text version**: Plain text fallback
- **Customizable branding**: Colors and styling can be modified
- **Security information**: Clear warnings and instructions

### Customizing Templates

To modify email templates:
1. Edit the `emailTemplates` object in `emailService.ts`
2. Update the HTML/CSS styling
3. Modify the text content
4. Test with different email clients

## 🔒 Security Features

- **Token expiration**: 1-hour validity
- **Secure token generation**: Cryptographically random
- **One-time use**: Tokens are invalidated after password change
- **Rate limiting**: Prevents abuse (implement in production)
- **Email verification**: Ensures user owns the email address

## 📊 Monitoring

For production, consider implementing:
- Email delivery tracking
- Bounce rate monitoring
- Spam complaint handling
- Delivery rate analytics

## 🆘 Support

If you encounter issues:
1. Check the console logs for error messages
2. Verify your email provider's SMTP settings
3. Test with a different email provider
4. Check network/firewall restrictions
5. Review the troubleshooting section above
