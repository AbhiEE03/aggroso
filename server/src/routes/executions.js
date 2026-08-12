const express = require('express');
const router = express.Router();

const ExecutionRun = require('../models/ExecutionRun');
const AuditLog = require('../models/AuditLog');
const Skill = require('../models/Skill');
const { approveStep, rejectStep } = require('../services/executionEngine');

// ─────────────────────────────────────────────
// GET /api/executions/:id
// Get a single execution run with its full step trace and audit log
// ─────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const run = await ExecutionRun.findById(req.params.id).lean();
    if (!run) {
      const err = new Error('Execution run not found');
      err.statusCode = 404;
      return next(err);
    }

    const logs = await AuditLog.find({ executionId: run._id })
      .sort({ timestamp: 1 })
      .lean();

    return res.json({ ...run, auditLog: logs });
  } catch (err) {
    if (err.name === 'CastError') {
      const e = new Error('Invalid execution ID format');
      e.statusCode = 400;
      return next(e);
    }
    return next(err);
  }
});

// ─────────────────────────────────────────────
// GET /api/executions/:id/audit-log
// Get the audit log for a specific execution run
// ─────────────────────────────────────────────
router.get('/:id/audit-log', async (req, res, next) => {
  try {
    const run = await ExecutionRun.findById(req.params.id).lean();
    if (!run) {
      const err = new Error('Execution run not found');
      err.statusCode = 404;
      return next(err);
    }

    const logs = await AuditLog.find({ executionId: run._id })
      .sort({ timestamp: 1 })
      .lean();

    return res.json(logs);
  } catch (err) {
    if (err.name === 'CastError') {
      const e = new Error('Invalid execution ID format');
      e.statusCode = 400;
      return next(e);
    }
    return next(err);
  }
});

// ─────────────────────────────────────────────
// GET /api/executions?skillId=xxx
// List execution runs, optionally filtered by skillId or status
// ─────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.skillId) filter.skillId = req.query.skillId;
    if (req.query.status) filter.status = req.query.status;

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = 20;
    const skip = (page - 1) * limit;

    const [runs, total] = await Promise.all([
      ExecutionRun.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ExecutionRun.countDocuments(filter)
    ]);

    return res.json({
      data: runs,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    return next(err);
  }
});

// ─────────────────────────────────────────────
// POST /api/executions/:id/steps/:stepNumber/approve
// Human approval for a write tool step
// ─────────────────────────────────────────────
router.post('/:id/steps/:stepNumber/approve', async (req, res, next) => {
  try {
    const run = await ExecutionRun.findById(req.params.id);
    if (!run) {
      const err = new Error('Execution run not found');
      err.statusCode = 404;
      return next(err);
    }

    if (run.status !== 'awaiting_approval') {
      const err = new Error(
        `Cannot approve a step — run is in status "${run.status}", expected "awaiting_approval"`
      );
      err.statusCode = 409;
      return next(err);
    }

    const stepNumber = parseInt(req.params.stepNumber, 10);
    if (isNaN(stepNumber) || stepNumber < 1) {
      const err = new Error('stepNumber must be a positive integer');
      err.statusCode = 400;
      return next(err);
    }

    const skill = await Skill.findById(run.skillId);
    if (!skill) {
      const err = new Error('Associated skill not found');
      err.statusCode = 404;
      return next(err);
    }

    const approvedBy = req.body?.approvedBy || 'user';
    const updatedRun = await approveStep(run, stepNumber, approvedBy, skill);

    return res.json(updatedRun);
  } catch (err) {
    if (err.name === 'CastError') {
      const e = new Error('Invalid ID format');
      e.statusCode = 400;
      return next(e);
    }
    // Business logic errors from approveStep (e.g. step not pending)
    if (!err.statusCode) err.statusCode = 400;
    return next(err);
  }
});

// ─────────────────────────────────────────────
// POST /api/executions/:id/steps/:stepNumber/reject
// Human rejection of a write tool step — terminates the run
// ─────────────────────────────────────────────
router.post('/:id/steps/:stepNumber/reject', async (req, res, next) => {
  try {
    const run = await ExecutionRun.findById(req.params.id);
    if (!run) {
      const err = new Error('Execution run not found');
      err.statusCode = 404;
      return next(err);
    }

    if (run.status !== 'awaiting_approval') {
      const err = new Error(
        `Cannot reject a step — run is in status "${run.status}", expected "awaiting_approval"`
      );
      err.statusCode = 409;
      return next(err);
    }

    const stepNumber = parseInt(req.params.stepNumber, 10);
    if (isNaN(stepNumber) || stepNumber < 1) {
      const err = new Error('stepNumber must be a positive integer');
      err.statusCode = 400;
      return next(err);
    }

    const rejectedBy = req.body?.rejectedBy || 'user';
    const updatedRun = await rejectStep(run, stepNumber, rejectedBy);

    return res.json(updatedRun);
  } catch (err) {
    if (err.name === 'CastError') {
      const e = new Error('Invalid ID format');
      e.statusCode = 400;
      return next(e);
    }
    if (!err.statusCode) err.statusCode = 400;
    return next(err);
  }
});

// ─────────────────────────────────────────────
// POST /api/executions/:id/cancel
// Cancel any non-terminal execution run
// ─────────────────────────────────────────────
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const run = await ExecutionRun.findById(req.params.id);
    if (!run) {
      const err = new Error('Execution run not found');
      err.statusCode = 404;
      return next(err);
    }

    const terminalStatuses = ['completed', 'failed', 'cancelled'];
    if (terminalStatuses.includes(run.status)) {
      const err = new Error(
        `Cannot cancel a run that is already "${run.status}"`
      );
      err.statusCode = 409;
      return next(err);
    }

    run.status = 'cancelled';
    await run.save();

    await AuditLog.create({
      executionId: run._id,
      actorType: 'user',
      action: 'execution_cancelled',
      detail: { cancelledBy: req.body?.cancelledBy || 'user' },
    });

    return res.json(run);
  } catch (err) {
    if (err.name === 'CastError') {
      const e = new Error('Invalid ID format');
      e.statusCode = 400;
      return next(e);
    }
    return next(err);
  }
});

module.exports = router;
