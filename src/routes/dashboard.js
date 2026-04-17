import { Router } from 'express';
import GetTaskStatisticsAction from '../actions/tasks/GetTaskStatisticsAction.js';
import requireAuth from '../middleware/auth.js';
import TaskModel from '../models/TaskModel.js';

const router = Router();
const getTaskStatisticsAction = new GetTaskStatisticsAction();

const getGreeting = (date = new Date()) => {
  const hour = date.getHours();

  if (hour < 12) {
    return 'Good morning';
  }

  if (hour < 18) {
    return 'Good afternoon';
  }

  return 'Good evening';
};

router.use(requireAuth);

router.get('/', (req, res) => {
  const stats = getTaskStatisticsAction.execute(req.session.userId);
  const dueTodayTasks = TaskModel.findByUserId(req.session.userId, {
    dueToday: true,
    sort: 'due_date',
    limit: 5,
  });

  res.render('dashboard/index', {
    title: 'Dashboard',
    greeting: getGreeting(),
    stats,
    dueTodayTasks,
  });
});

export default router;
