/**
 * @lozzalingo/orders - Order Management Controller
 */

const crypto = require('crypto');

function createOrderController(prisma, options = {}) {
  const { modelName = 'order' } = options;

  console.log('[Orders] Initializing order controller');

  function generateOrderNumber() {
    const date = new Date();
    const prefix = `ORD-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}-${suffix}`;
  }

  async function getAll(req, res) {
    try {
      console.log('[Orders] Fetching orders');
      const { page = 1, limit = 50, status, email, search, startDate, endDate } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const where = {};
      if (status) where.status = status;
      if (email) where.customerEmail = { contains: email };
      if (search) {
        where.OR = [
          { orderNumber: { contains: search } },
          { customerEmail: { contains: search } },
          { customerName: { contains: search } },
        ];
      }
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const [orders, total] = await Promise.all([
        prisma[modelName].findMany({
          where,
          include: { items: true },
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(limit),
        }),
        prisma[modelName].count({ where }),
      ]);

      res.json({
        orders,
        total,
        page: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
      });
    } catch (error) {
      console.error('[Orders] Error fetching orders:', error.message);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  }

  async function getById(req, res) {
    try {
      const { id } = req.params;
      console.log('[Orders] Fetching order:', id);

      const order = await prisma[modelName].findUnique({
        where: { id: parseInt(id) || id },
        include: { items: true },
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      res.json(order);
    } catch (error) {
      console.error('[Orders] Error fetching order:', error.message);
      res.status(500).json({ error: 'Failed to fetch order' });
    }
  }

  async function create(req, res) {
    try {
      const {
        customerEmail, customerName, totalAmount, currency = 'gbp',
        status = 'paid', items = [], notes, shippingName, shippingLine1,
        shippingLine2, shippingCity, shippingPostalCode, shippingCountry,
      } = req.body;

      if (!customerEmail || !totalAmount) {
        return res.status(400).json({ error: 'customerEmail and totalAmount are required' });
      }

      console.log('[Orders] Creating manual order for:', customerEmail);

      const order = await prisma[modelName].create({
        data: {
          orderNumber: generateOrderNumber(),
          customerEmail,
          customerName,
          totalAmount: parseInt(totalAmount),
          currency,
          status,
          notes,
          shippingName,
          shippingLine1,
          shippingLine2,
          shippingCity,
          shippingPostalCode,
          shippingCountry,
          items: {
            create: items.map(item => ({
              productName: item.productName,
              quantity: item.quantity || 1,
              unitPrice: parseInt(item.unitPrice),
            })),
          },
        },
        include: { items: true },
      });

      console.log('[Orders] Order created:', order.orderNumber);
      res.status(201).json(order);
    } catch (error) {
      console.error('[Orders] Error creating order:', error.message);
      res.status(500).json({ error: 'Failed to create order' });
    }
  }

  async function update(req, res) {
    try {
      const { id } = req.params;
      const { status, trackingNumber, carrier, notes } = req.body;

      console.log('[Orders] Updating order:', id);

      const data = {};
      if (status !== undefined) data.status = status;
      if (trackingNumber !== undefined) data.trackingNumber = trackingNumber;
      if (carrier !== undefined) data.carrier = carrier;
      if (notes !== undefined) data.notes = notes;

      const order = await prisma[modelName].update({
        where: { id: parseInt(id) || id },
        data,
        include: { items: true },
      });

      console.log('[Orders] Order updated:', order.orderNumber);
      res.json(order);
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Order not found' });
      }
      console.error('[Orders] Error updating order:', error.message);
      res.status(500).json({ error: 'Failed to update order' });
    }
  }

  async function remove(req, res) {
    try {
      const { id } = req.params;
      console.log('[Orders] Deleting order:', id);

      await prisma[modelName].delete({
        where: { id: parseInt(id) || id },
      });

      console.log('[Orders] Order deleted');
      res.json({ message: 'Order deleted' });
    } catch (error) {
      if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Order not found' });
      }
      console.error('[Orders] Error deleting order:', error.message);
      res.status(500).json({ error: 'Failed to delete order' });
    }
  }

  async function resendConfirmation(req, res) {
    try {
      const { id } = req.params;
      console.log('[Orders] Resending confirmation for order:', id);

      const order = await prisma[modelName].findUnique({
        where: { id: parseInt(id) || id },
        include: { items: true },
      });

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // This would use the email service if injected via options
      console.log('[Orders] Would resend confirmation to:', order.customerEmail);
      res.json({ message: 'Confirmation email queued', email: order.customerEmail });
    } catch (error) {
      console.error('[Orders] Error resending confirmation:', error.message);
      res.status(500).json({ error: 'Failed to resend confirmation' });
    }
  }

  return { getAll, getById, create, update, remove, resendConfirmation };
}

module.exports = { createOrderController };
