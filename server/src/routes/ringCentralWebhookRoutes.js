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
    console.warn('[ringcentral] Webhook rejected — verification token mismatch');
    return res.status(403).json({ message: 'Invalid verification token' });
  }

  res.status(200).end();

  const eventPath = String(req.body?.event || '');
  const sessionId = req.body?.body?.telephonySessionId || req.body?.telephonySessionId || null;
  console.log('[ringcentral] Webhook received', {
    event: eventPath || 'unknown',
    sessionId: sessionId || null,
  });

  try {
    await processRingCentralWebhookPayload(req.body);
  } catch (err) {
    console.error('[ringcentral] webhook processing failed:', err.message);
  }
});

export default router;
