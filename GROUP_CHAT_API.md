# Group Chat API Documentation

## Overview
This document describes the group chat functionality with admin powers for the Casaway backend API.

## Authentication
All endpoints require authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Chat Model Structure
```javascript
{
  _id: ObjectId,
  members: [ObjectId], // Array of user IDs
  messages: [ObjectId], // Array of message IDs
  lastMessage: ObjectId, // Reference to last message
  isGroup: Boolean, // true for group chats, false for direct chats
  groupName: String, // Required for group chats
  groupDescription: String, // Optional description
  admins: [ObjectId], // Array of admin user IDs
  createdBy: ObjectId, // User who created the group
  groupImage: String, // Optional group image URL
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints

### 1. Create Group Chat
**POST** `/api/chat/group`

Creates a new group chat with the specified members.

**Request Body:**
```javascript
{
  "groupName": "string", // Required
  "groupDescription": "string", // Optional
  "memberIds": ["userId1", "userId2", ...], // Array of user IDs (min 2)
  "groupImage": "string" // Optional image URL
}
```

**Response:**
```javascript
{
  "_id": "chatId",
  "groupName": "My Group",
  "groupDescription": "Group description",
  "members": [
    { "_id": "user1", "name": "User 1", "email": "user1@example.com" },
    { "_id": "user2", "name": "User 2", "email": "user2@example.com" }
  ],
  "admins": [
    { "_id": "creatorId", "name": "Creator", "email": "creator@example.com" }
  ],
  "createdBy": "creatorId",
  "isGroup": true,
  "groupImage": "image_url",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

### 2. Add Members to Group
**POST** `/api/chat/:chatId/add-members`

Adds new members to an existing group chat. Only admins can perform this action.

**Request Body:**
```javascript
{
  "memberIds": ["userId1", "userId2", ...] // Array of user IDs to add
}
```

**Response:** Returns updated chat object with new members.

### 3. Remove Members from Group
**POST** `/api/chat/:chatId/remove-members`

Removes members from a group chat. Only admins can perform this action.

**Request Body:**
```javascript
{
  "memberIds": ["userId1", "userId2", ...] // Array of user IDs to remove
}
```

**Response:** Returns updated chat object with members removed.

### 4. Add Admin
**POST** `/api/chat/:chatId/add-admin`

Promotes a member to admin role. Only existing admins can perform this action.

**Request Body:**
```javascript
{
  "userId": "userId" // User ID to make admin
}
```

**Response:** Returns updated chat object with new admin.

### 5. Remove Admin
**POST** `/api/chat/:chatId/remove-admin`

Removes admin privileges from a user. Only admins can perform this action.

**Request Body:**
```javascript
{
  "userId": "userId" // User ID to remove from admins
}
```

**Response:** Returns updated chat object with admin removed.

### 6. Update Group Information
**PUT** `/api/chat/:chatId/group-info`

Updates group name, description, or image. Only admins can perform this action.

**Request Body:**
```javascript
{
  "groupName": "string", // Optional
  "groupDescription": "string", // Optional
  "groupImage": "string" // Optional
}
```

**Response:** Returns updated chat object with new information.

### 7. Leave Group
**POST** `/api/chat/:chatId/leave`

Allows a user to leave a group chat.

**Request Body:** None

**Response:**
```javascript
{
  "msg": "Successfully left the group."
}
```

### 8. Get All User Chats
**GET** `/api/chat/user`

Returns all chats for the authenticated user (both direct and group chats).

**Response:**
```javascript
[
  {
    "_id": "chatId",
    "isGroup": true,
    "groupName": "My Group",
    "members": [...],
    "admins": [...],
    "lastMessage": {...},
    "createdAt": "2023-01-01T00:00:00.000Z"
  }
]
```

### 9. Get Specific Chat
**GET** `/api/chat/:chatId`

Returns detailed information about a specific chat.

**Response:** Returns chat object with populated members and admins.

## Error Responses

### 400 Bad Request
```javascript
{
  "msg": "Error message describing the issue"
}
```

### 403 Forbidden
```javascript
{
  "msg": "Only admins can perform this action."
}
```

### 404 Not Found
```javascript
{
  "msg": "Chat not found."
}
```

### 500 Internal Server Error
```javascript
{
  "msg": "Internal Server Error",
  "error": "Error details"
}
```

## Admin Powers

### What Admins Can Do:
1. **Add Members**: Invite new users to the group
2. **Remove Members**: Remove users from the group
3. **Add Admins**: Promote members to admin role
4. **Remove Admins**: Remove admin privileges (except themselves)
5. **Update Group Info**: Change group name, description, or image
6. **Delete Group**: Group is automatically deleted when last member leaves

### Admin Restrictions:
1. Cannot remove themselves as admin (must leave group instead)
2. Cannot remove all admins (at least one admin must remain)
3. Only group members can become admins

## Notifications

The API automatically creates notifications for:
- New group invitations
- Member additions
- Admin promotions

## Usage Examples

### Creating a Group Chat
```javascript
const response = await fetch('/api/chat/group', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    groupName: 'Project Team',
    groupDescription: 'Team chat for project collaboration',
    memberIds: ['user1', 'user2', 'user3']
  })
});
```

### Adding Members
```javascript
const response = await fetch(`/api/chat/${chatId}/add-members`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    memberIds: ['user4', 'user5']
  })
});
```

### Removing Members
```javascript
const response = await fetch(`/api/chat/${chatId}/remove-members`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    memberIds: ['user1']
  })
});
```

## Security Considerations

1. **Authentication Required**: All endpoints require valid JWT token
2. **Authorization Checks**: Admin-only actions verify user permissions
3. **Input Validation**: All inputs are validated and sanitized
4. **Error Handling**: Comprehensive error handling with appropriate HTTP status codes
5. **Data Integrity**: Ensures at least one admin remains in group at all times
