# Forgot Password with Email OTP Verification - Implementation Guide

## Overview
This document outlines the complete implementation of the **Forgot Password with Email OTP Verification** feature for the Viros GST Billing application.

## Features Implemented

✅ User enters email address  
✅ Backend verifies user exists  
✅ Backend generates secure 5-digit OTP  
✅ OTP expires in 10 minutes  
✅ OTP and expiry stored in database  
✅ OTP sent to user email via Nodemailer  
✅ User verifies OTP  
✅ Backend verifies OTP and expiry  
✅ User sets new password  
✅ Password hashed using bcryptjs (bcrypt with 12 rounds)  
✅ Clear OTP fields after successful reset  
✅ Redirect to login page after reset  

## Architecture

### Database Schema Changes
Added two new fields to the `users` table:
- `otp` (VARCHAR(10)): Stores the 5-digit OTP
- `otp_expiry` (DATETIME): Stores the OTP expiration timestamp

### API Endpoints

#### 1. POST `/api/auth/forgot-password`
**Purpose**: Generate and send OTP to user email

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Response**:
```json
{
  "message": "OTP sent to your email"
}
```

**Process**:
1. Validate email input
2. Check if user exists in database
3. Generate 5-digit random OTP (10000-99999)
4. Calculate expiry time (current time + 10 minutes)
5. Store OTP and expiry in database
6. Send OTP via email using Nodemailer
7. Return success message

---

#### 2. POST `/api/auth/verify-otp`
**Purpose**: Verify the OTP provided by user

**Request Body**:
```json
{
  "email": "user@example.com",
  "otp": "12345"
}
```

**Response**:
```json
{
  "message": "OTP verified successfully"
}
```

**Process**:
1. Validate email and OTP input
2. Fetch user from database
3. Verify OTP matches
4. Verify OTP hasn't expired
5. Return success if valid, error if invalid/expired

---

#### 3. POST `/api/auth/reset-password`
**Purpose**: Reset user password after OTP verification

**Request Body**:
```json
{
  "email": "user@example.com",
  "otp": "12345",
  "newPassword": "newpassword123"
}
```

**Response**:
```json
{
  "message": "Password reset successfully"
}
```

**Process**:
1. Validate all inputs
2. Verify OTP again for security
3. Hash new password using bcryptjs (12 rounds)
4. Update password in database
5. Clear OTP and otpExpiry fields
6. Return success message

---

### Frontend Pages

#### 1. `/auth/forgot-password`
**Component**: `app/(auth)/forgot-password/page.tsx`

**Features**:
- Email input field
- Submit button to request OTP
- Error/success toast notifications
- Loading state with spinner
- Redirect to verify OTP page upon success
- Link back to login page

**Flow**:
1. User enters email
2. Click "Send OTP"
3. API called to generate OTP
4. Success toast shown
5. Redirect to OTP verification page (with email as query param)

---

#### 2. `/auth/verify-otp`
**Component**: `app/(auth)/verify-otp/page.tsx`

**Features**:
- 5-digit OTP input field (numeric only)
- Submit button to verify OTP
- "Resend OTP" button for resending
- Error/success toast notifications
- Auto-redirect on successful verification
- Link back to forgot password and login

**Flow**:
1. Display user's email (from query params)
2. User enters 5-digit OTP
3. Click "Verify OTP"
4. API verifies OTP and expiry
5. Success toast shown
6. Redirect to reset password page (with email and OTP as query params)

---

#### 3. `/auth/reset-password`
**Component**: `app/(auth)/reset-password/page.tsx`

**Features**:
- New password input field
- Confirm password input field
- Password strength validation (minimum 6 characters)
- Submit button to reset password
- Error/success toast notifications
- Password match validation
- Auto-redirect to login on success

**Flow**:
1. Display password reset form
2. User enters new password and confirms
3. Validation checks:
   - Passwords match
   - Password length >= 6 characters
4. Click "Reset Password"
5. API resets password and clears OTP fields
6. Success toast shown
7. Redirect to login page

---

## Email Template

The OTP email is sent with an HTML template containing:
- Header: "Password Reset Request"
- Large, bold OTP display (24px font)
- Expiry information (10 minutes)
- Security note about ignoring if not requested

---

## Dependencies

**New Dependencies Added**:
- `nodemailer`: For sending emails

**Existing Dependencies Used**:
- `bcryptjs`: For password hashing
- `next-auth`: For authentication context
- `react-hook-form`: For form handling (optional, not used in these pages)

---

## Environment Variables

The following environment variables must be configured in `.env`:

```
# SMTP Configuration for Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Database
DATABASE_URL=mysql://user:password@host:port/database
```

**Note**: For Gmail, generate an [App Password](https://support.google.com/accounts/answer/185833) instead of using your regular password.

---

## Security Features

1. **OTP Expiration**: OTP expires after 10 minutes
2. **Password Hashing**: Using bcryptjs with 12 salt rounds
3. **OTP Validation**: Both OTP value and expiry checked before password reset
4. **Secure Email**: Uses SMTP with TLS (port 587)
5. **Double Verification**: OTP verified again during password reset

---

## File Structure

```
app/
├── (auth)/
│   ├── forgot-password/
│   │   └── page.tsx          # Forgot password form page
│   ├── verify-otp/
│   │   └── page.tsx          # OTP verification page
│   └── reset-password/
│       └── page.tsx          # Password reset form page
└── api/
    └── auth/
        ├── forgot-password/
        │   └── route.ts      # Generate and send OTP
        ├── verify-otp/
        │   └── route.ts      # Verify OTP validity
        └── reset-password/
            └── route.ts      # Reset password and clear OTP
```

---

## Usage Flow

### Complete User Journey

```
1. User on login page
   ↓
2. Click "Forgot your password?" link
   ↓
3. Redirect to /auth/forgot-password
   ↓
4. Enter email and click "Send OTP"
   ↓
5. API generates OTP, stores in DB, sends email
   ↓
6. Success message shown
   ↓
7. Auto-redirect to /auth/verify-otp?email=user@example.com
   ↓
8. Enter OTP received in email
   ↓
9. Click "Verify OTP"
   ↓
10. API verifies OTP and expiry
    ↓
11. Success message shown
    ↓
12. Auto-redirect to /auth/reset-password?email=user@example.com&otp=12345
    ↓
13. Enter new password and confirm
    ↓
14. Click "Reset Password"
    ↓
15. API hashes password, updates DB, clears OTP fields
    ↓
16. Success message shown
    ↓
17. Auto-redirect to /auth/login
    ↓
18. User logs in with new password
```

---

## Testing

### Manual Testing Steps

1. **Forgot Password Page**:
   - Navigate to `/auth/forgot-password`
   - Enter valid email
   - Click "Send OTP"
   - Check email for OTP
   - Verify success message

2. **Verify OTP Page**:
   - OTP should be automatically in the input (or copied from email)
   - Enter OTP within 10 minutes
   - Click "Verify OTP"
   - Verify redirect to reset password

3. **Reset Password Page**:
   - Enter new password (minimum 6 characters)
   - Confirm password
   - Click "Reset Password"
   - Verify redirect to login
   - Login with new password

---

## Troubleshooting

### OTP Not Received
- Check spam/junk folder
- Verify SMTP credentials in `.env`
- Check database for OTP storage
- Verify email is less than 10 minutes old

### Login Fails After Reset
- Verify password was hashed (bcrypt hash starts with `$2a$` or `$2b$`)
- Check database password field was updated
- Verify OTP fields were cleared

### Database Error
- Run `node add-otp-columns.ts` to add OTP columns
- Verify database connection string

---

## Future Enhancements

1. Add rate limiting to prevent OTP brute force attacks
2. Add email verification for security
3. Add SMS OTP as alternative
4. Add password strength meter
5. Add security questions
6. Add two-factor authentication
7. Add account lockout after failed attempts
8. Add OTP resend cooldown timer

---

## Version
**Implementation Date**: May 12, 2026  
**Status**: ✅ Complete and Ready for Use
