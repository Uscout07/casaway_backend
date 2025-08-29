import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['like', 'comment', 'reply', 'message', 'chat', 'group_invite', 'group_update', 'group_admin_change'], required: true },
  sourceUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  relatedId: { type: mongoose.Schema.Types.ObjectId, required: true },
  targetType: { type: String, enum: ['post', 'listing', 'comment', 'reply', 'chat'], required: true },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Notification', notificationSchema);