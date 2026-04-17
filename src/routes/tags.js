import express from 'express';
import CreateTagAction from '../actions/tags/CreateTagAction.js';
import DeleteTagAction from '../actions/tags/DeleteTagAction.js';
import UpdateTagAction from '../actions/tags/UpdateTagAction.js';
import { requireAuth } from '../middleware/auth.js';
import validateIntegerParam from '../middleware/validateIntegerParam.js';
import TagModel from '../models/TagModel.js';
import validateCreateTag from '../requests/tags/validateCreateTag.js';
import validateUpdateTag from '../requests/tags/validateUpdateTag.js';

const router = express.Router();

const createTagAction = new CreateTagAction();
const updateTagAction = new UpdateTagAction();
const deleteTagAction = new DeleteTagAction();
const toast = (message, type = 'success') => ({ type, message });

router.use(requireAuth);
router.param('id', validateIntegerParam('id'));

router.get('/', (req, res) => {
  return res.redirect('/categories?tab=tags');
});

router.get('/:id', (req, res) => {
  const tag = TagModel.findById(Number(req.params.id), req.session.userId);

  if (!tag) {
    return res.status(404).json({
      message: 'Tag not found.',
    });
  }

  return res.json({
    tag,
  });
});

router.post('/', validateCreateTag, (req, res) => {
  const tag = createTagAction.execute(req.session.userId, req.body);

  return res.status(201).json({
    success: true,
    toast: toast('Tag created'),
    tag,
  });
});

router.patch('/:id', validateUpdateTag, (req, res) => {
  const tag = updateTagAction.execute(Number(req.params.id), req.session.userId, req.body);

  if (!tag) {
    return res.status(404).json({
      message: 'Tag not found.',
    });
  }

  return res.json({
    success: true,
    toast: toast('Tag updated'),
    tag,
  });
});

router.delete('/:id', (req, res) => {
  const existingTag = TagModel.findById(Number(req.params.id), req.session.userId);

  if (!existingTag) {
    return res.status(404).json({
      message: 'Tag not found.',
    });
  }

  deleteTagAction.execute(existingTag.id, req.session.userId);

  return res.json({
    success: true,
    toast: toast('Tag deleted'),
  });
});

export default router;
