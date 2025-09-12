# Google OAuth Setup Guide for Casaway Backend

This guide explains how to set up Google OAuth authentication for the Casaway backend.

## 🔐 Google OAuth Overview

Google OAuth allows users to sign in to your app using their Google accounts, providing a seamless authentication experience without requiring users to create new accounts.

## 🚀 Setup Instructions

### 1. Create Google OAuth Application

1. **Go to Google Cloud Console**
   - Visit: https://console.developers.google.com/
   - Sign in with your Google account

2. **Create or Select Project**
   - Create a new project or select an existing one
   - Give it a descriptive name (e.g., "Casaway OAuth")

3. **Enable Google+ API**
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click "Enable"

4. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Give it a name (e.g., "Casaway Web Client")

5. **Configure Authorized Redirect URIs**
   Add these URIs (replace with your actual domains):
   ```
   http://localhost:5000/api/oauth/google/callback
   https://yourdomain.com/api/oauth/google/callback
   ```

6. **Get Your Credentials**
   - Copy the **Client ID** and **Client Secret**
   - Keep these secure and never commit them to version control

### 2. Configure Environment Variables

Add these variables to your `.env` file:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
GOOGLE_CALLBACK_URL=http://localhost:5000/api/oauth/google/callback
FRONTEND_URL=http://localhost:3000
```

### 3. Test the Configuration

1. **Start your backend server**
2. **Test the OAuth flow**:
   - Visit: `http://localhost:5000/api/oauth/google`
   - You should be redirected to Google's OAuth consent screen
   - After authorization, you'll be redirected back to your frontend

## 🔧 OAuth Flow

### Authentication Flow
1. **User clicks "Sign in with Google"**
2. **Redirect to Google**: `/api/oauth/google`
3. **User authorizes app** on Google's consent screen
4. **Google redirects back**: `/api/oauth/google/callback`
5. **Backend processes OAuth response**:
   - Creates new user or links to existing account
   - Generates JWT token
   - Redirects to frontend with token
6. **Frontend receives token** and logs user in

### User Account Handling
- **New Google users**: Automatically created with Google profile data
- **Existing users**: Google account linked to existing email
- **Email verification**: Automatically verified for Google users
- **Profile data**: Name, email, and profile picture from Google

## 🛠️ API Endpoints

### OAuth Endpoints
- `GET /api/oauth/google` - Initiate Google OAuth
- `GET /api/oauth/google/callback` - OAuth callback handler
- `GET /api/oauth/failure` - OAuth failure redirect

### User Management
- `GET /api/oauth/me` - Get current user info
- `POST /api/oauth/link-google` - Link Google account to existing user
- `POST /api/oauth/unlink-google` - Unlink Google account

## 🔒 Security Features

### Token Management
- **JWT tokens**: 7-day expiration
- **Secure generation**: Cryptographically random
- **Token validation**: Proper JWT verification

### Account Security
- **Email verification**: Automatic for Google users
- **Account linking**: Secure linking of Google accounts
- **Password requirements**: Optional for Google users
- **Unlink protection**: Requires password before unlinking

### Data Protection
- **Minimal data collection**: Only necessary profile information
- **Secure storage**: Encrypted passwords and tokens
- **Privacy compliance**: Follows OAuth best practices

## 🎯 Frontend Integration

### OAuth Callback Handling
Your frontend should handle the OAuth callback:

```javascript
// Handle OAuth callback
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
const success = urlParams.get('success');

if (success === 'true' && token) {
  // Store token and redirect to dashboard
  localStorage.setItem('token', token);
  window.location.href = '/dashboard';
} else {
  // Handle OAuth failure
  console.error('OAuth failed:', urlParams.get('error'));
}
```

### Sign-in Button
Add a Google sign-in button to your login page:

```html
<a href="http://localhost:5000/api/oauth/google" class="google-signin-btn">
  Sign in with Google
</a>
```

## 🚀 Production Deployment

### Environment Variables for Production
```env
GOOGLE_CLIENT_ID=your-production-client-id
GOOGLE_CLIENT_SECRET=your-production-client-secret
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/oauth/google/callback
FRONTEND_URL=https://yourdomain.com
```

### Google Cloud Console Production Setup
1. **Add production redirect URI**:
   ```
   https://yourdomain.com/api/oauth/google/callback
   ```
2. **Configure OAuth consent screen**:
   - Add your domain to authorized domains
   - Set up privacy policy and terms of service
   - Configure app information

### Security Considerations
- **HTTPS required**: OAuth requires secure connections
- **Domain verification**: Verify your domain in Google Console
- **Rate limiting**: Implement rate limiting for OAuth endpoints
- **Monitoring**: Monitor OAuth success/failure rates

## 🛠️ Troubleshooting

### Common Issues

#### "redirect_uri_mismatch"
- Check that your redirect URI matches exactly in Google Console
- Ensure protocol (http/https) matches
- Verify port numbers are correct

#### "invalid_client"
- Verify your Client ID and Client Secret
- Check that the OAuth app is properly configured
- Ensure the app is not in testing mode (for production)

#### "access_denied"
- User denied permission on consent screen
- Check OAuth consent screen configuration
- Verify required scopes are requested

#### "OAuth callback error"
- Check server logs for detailed error messages
- Verify database connection
- Ensure JWT secret is configured

### Testing OAuth Flow
1. **Clear browser cookies** and try again
2. **Check network tab** for failed requests
3. **Verify environment variables** are loaded correctly
4. **Test with different Google accounts**

## 📊 Monitoring and Analytics

### OAuth Metrics to Track
- **Success rate**: Percentage of successful OAuth flows
- **Failure reasons**: Common failure points
- **User conversion**: OAuth vs. regular signup rates
- **Account linking**: How often users link Google accounts

### Logging
The OAuth system logs important events:
- OAuth initiation
- Successful authentications
- Account creation/linking
- Error conditions

## 🆘 Support

If you encounter issues:
1. Check the console logs for error messages
2. Verify your Google Cloud Console configuration
3. Test with a fresh browser session
4. Review the troubleshooting section above
5. Check that all environment variables are set correctly

## 🔄 Updates and Maintenance

### Regular Tasks
- **Monitor OAuth quotas** in Google Console
- **Review security logs** for suspicious activity
- **Update OAuth scopes** if needed
- **Test OAuth flow** after deployments

### Security Updates
- **Rotate Client Secret** periodically
- **Review OAuth permissions** regularly
- **Monitor for security advisories**
- **Update dependencies** for security patches
