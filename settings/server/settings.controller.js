/**
 * @lozzalingo/settings - Encrypted Settings Controller
 */

const { encrypt, decrypt } = require('./encryption');

function createSettingsController(prisma, options = {}) {
  const secretKey = options.secretKey || process.env.SETTINGS_SECRET || process.env.NEXTAUTH_SECRET;
  
  if (!secretKey) {
    console.warn('[Settings] No secret key configured - encrypted settings will not work');
  } else {
    console.log('[Settings] Initializing settings controller with encryption');
  }

  function maskSecret(value) {
    if (!value || value.length < 4) return '****';
    return '***' + value.slice(-4);
  }

  async function getAll(req, res) {
    try {
      console.log('[Settings] Fetching all settings');
      const settings = await prisma.setting.findMany({
        orderBy: [{ category: 'asc' }, { key: 'asc' }],
      });

      // Group by category, mask secrets
      const grouped = {};
      for (const setting of settings) {
        if (!grouped[setting.category]) {
          grouped[setting.category] = [];
        }
        
        let displayValue = setting.value;
        if (setting.isSecret && setting.value) {
          try {
            const decrypted = decrypt(setting.value, secretKey);
            displayValue = maskSecret(decrypted);
          } catch {
            displayValue = '***encrypted***';
          }
        }

        grouped[setting.category].push({
          ...setting,
          value: displayValue,
        });
      }

      res.json({ settings: grouped });
    } catch (error) {
      console.error('[Settings] Error fetching settings:', error.message);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  }

  async function getByKey(req, res) {
    try {
      const { key } = req.params;
      console.log('[Settings] Fetching setting:', key);

      const setting = await prisma.setting.findUnique({ where: { key } });
      if (!setting) {
        return res.status(404).json({ error: 'Setting not found' });
      }

      let value = setting.value;
      if (setting.isSecret && value && secretKey) {
        try {
          value = decrypt(value, secretKey);
        } catch {
          return res.status(500).json({ error: 'Failed to decrypt setting' });
        }
      }

      res.json({ ...setting, value });
    } catch (error) {
      console.error('[Settings] Error fetching setting:', error.message);
      res.status(500).json({ error: 'Failed to fetch setting' });
    }
  }

  async function saveSetting(req, res) {
    try {
      const { key, value, category = 'general', isSecret = false, description } = req.body;

      if (!key) {
        return res.status(400).json({ error: 'Key is required' });
      }

      console.log('[Settings] Saving setting:', key);

      let storedValue = value;
      if (isSecret && value && secretKey) {
        storedValue = encrypt(value, secretKey);
      }

      const setting = await prisma.setting.upsert({
        where: { key },
        update: { value: storedValue, category, isSecret, description },
        create: { key, value: storedValue, category, isSecret, description },
      });

      // Return masked value for secrets
      const displayValue = isSecret ? maskSecret(value) : value;

      res.json({ message: 'Setting saved', setting: { ...setting, value: displayValue } });
    } catch (error) {
      console.error('[Settings] Error saving setting:', error.message);
      res.status(500).json({ error: 'Failed to save setting' });
    }
  }

  async function deleteSetting(req, res) {
    try {
      const { key } = req.params;
      console.log('[Settings] Deleting setting:', key);

      await prisma.setting.delete({ where: { key } });
      res.json({ message: 'Setting deleted' });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Setting not found' });
      }
      console.error('[Settings] Error deleting setting:', error.message);
      res.status(500).json({ error: 'Failed to delete setting' });
    }
  }

  async function testStripeConnection(req, res) {
    try {
      console.log('[Settings] Testing Stripe connection');
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        return res.json({ success: false, error: 'STRIPE_SECRET_KEY not configured' });
      }

      const response = await fetch('https://api.stripe.com/v1/balance', {
        headers: { Authorization: `Bearer ${stripeKey}` },
      });

      if (response.ok) {
        console.log('[Settings] Stripe connection OK');
        res.json({ success: true, message: 'Stripe connection successful' });
      } else {
        const data = await response.json();
        console.error('[Settings] Stripe connection failed:', data.error?.message);
        res.json({ success: false, error: data.error?.message || 'Connection failed' });
      }
    } catch (error) {
      console.error('[Settings] Stripe test error:', error.message);
      res.json({ success: false, error: error.message });
    }
  }

  async function testResendConnection(req, res) {
    try {
      console.log('[Settings] Testing Resend connection');
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        return res.json({ success: false, error: 'RESEND_API_KEY not configured' });
      }

      const response = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (response.ok) {
        console.log('[Settings] Resend connection OK');
        res.json({ success: true, message: 'Resend connection successful' });
      } else {
        const data = await response.json();
        console.error('[Settings] Resend connection failed');
        res.json({ success: false, error: data.message || 'Connection failed' });
      }
    } catch (error) {
      console.error('[Settings] Resend test error:', error.message);
      res.json({ success: false, error: error.message });
    }
  }

  return {
    getAll,
    getByKey,
    saveSetting,
    deleteSetting,
    testStripeConnection,
    testResendConnection,
  };
}

module.exports = { createSettingsController };
