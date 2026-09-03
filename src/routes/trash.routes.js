const express = require('express');
const router = express.Router();
const trashController = require('../controllers/trash.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/role.middleware');

router.use(authenticate);

// List soft-deleted records for an entity
router.get('/:entity', authorize('ADMIN', 'PHARMACIST'), trashController.getTrashItems);

// Restore all soft-deleted records for an entity
router.post('/:entity/restore-all', authorize('ADMIN', 'PHARMACIST'), trashController.restoreAllTrash);

// Purge all soft-deleted records for an entity
router.delete('/:entity/purge-all', authorize('ADMIN'), trashController.purgeAllTrash);

// Restore a specific item
router.post('/:entity/:id/restore', authorize('ADMIN', 'PHARMACIST'), trashController.restoreTrashItem);

// Permanently purge a specific item
router.delete('/:entity/:id/purge', authorize('ADMIN'), trashController.purgeTrashItem);

module.exports = router;
