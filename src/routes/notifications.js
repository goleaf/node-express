import { Router } from 'express';
import requireAuth from '../middleware/auth.js';
import validateIntegerParam from '../middleware/validateIntegerParam.js';
import NotificationModel from '../models/NotificationModel.js';
import { registerNotificationListener, unregisterNotificationListener } from '../actions/notifications/notificationStreams.js';

const router = Router();

router.use(requireAuth);
router.param('id', validateIntegerParam('id'));

router.get('/', (req, res) => {
  return res.json({
    notifications: NotificationModel.findByUserId(req.session.userId),
    unreadCount: NotificationModel.countUnread(req.session.userId),
  });
});

router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(': connected\n\n');

  const userId = req.session.userId;
  const listener = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  registerNotificationListener(userId, listener);

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unregisterNotificationListener(userId, listener);
    res.end();
  });
});

router.patch('/read-all', (req, res) => {
  NotificationModel.markAllAsRead(req.session.userId);

  return res.json({
    success: true,
    unreadCount: 0,
  });
});

router.patch('/:id/read', (req, res) => {
  const notification = NotificationModel.markAsRead(Number(req.params.id), req.session.userId);

  if (!notification) {
    return res.status(404).json({
      message: 'Notification not found.',
    });
  }

  return res.json({
    notification,
    unreadCount: NotificationModel.countUnread(req.session.userId),
  });
});

export default router;
