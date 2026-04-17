import { Router } from 'express';
import SearchTasksAction from '../actions/tasks/SearchTasksAction.js';
import requireAuth from '../middleware/auth.js';
import CategoryModel from '../models/CategoryModel.js';
import TagModel from '../models/TagModel.js';

const router = Router();
const searchTasksAction = new SearchTasksAction();

router.use(requireAuth);

router.get('/', (req, res) => {
  const searchResult = searchTasksAction.execute(req.session.userId, req.query);

  res.render('search/index', {
    title: 'Search',
    categories: CategoryModel.findByUserId(req.session.userId),
    tags: TagModel.findByUserId(req.session.userId),
    searchResult,
    initialFilters: {
      query: typeof req.query.query === 'string' ? req.query.query : '',
      filter_status: typeof req.query.filter_status === 'string' ? req.query.filter_status : '',
      filter_priority: typeof req.query.filter_priority === 'string' ? req.query.filter_priority : '',
      filter_category_id: typeof req.query.filter_category_id === 'string' ? req.query.filter_category_id : '',
      filter_tag_id: typeof req.query.filter_tag_id === 'string' ? req.query.filter_tag_id : '',
      date_from: typeof req.query.date_from === 'string' ? req.query.date_from : '',
      date_to: typeof req.query.date_to === 'string' ? req.query.date_to : '',
      sort_by: typeof req.query.sort_by === 'string' ? req.query.sort_by : 'position',
      sort_direction: typeof req.query.sort_direction === 'string' ? req.query.sort_direction : 'asc',
    },
  });
});

export default router;
