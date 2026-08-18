import { Router } from 'express';
import { processRingCentralWebhookPayload } from '../services/ringCentralEventService.js';

const router = Router();

router.post('/ringcentral', async (req, res) => {
  const validationToken = req.headers['validation-token'];
  if (validationToken) {
    res.setHeader('Validation-Token', validationToken);
    return res.status(200).end();
  }

  const expectedVerification = process.env.RINGCENTRAL_WEBHOOK_VERIFICATION_TOKEN?.trim();
  const verificationToken = req.headers['verification-token'];
  if (expectedVerification && verificationToken !== expectedVerification) {
    return res.status(403).json({ message: 'Invalid verification token' });
  }

  res.status(200).end();

  try {
    await processRingCentralWebhookPayload(req.body);
  } catch (err) {
    console.error('[ringcentral] webhook processing failed:', err.message);
  }
});

export default router;
