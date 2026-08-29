import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();
app.use(cors());
app.use(express.json());

const prisma = new PrismaClient();

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Get all tickets
app.get('/tickets', async (_req, res) => {
  try {
    const tickets = await prisma.ticket.findMany();
    res.json(tickets);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// Create a new ticket
app.post('/tickets', async (req, res) => {
  const { title, description } = req.body;
  try {
    const ticket = await prisma.ticket.create({
      data: { title, description },
    });
    res.status(201).json(ticket);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// TicketType CRUD endpoints
app.get('/ticket-types', async (_req, res) => {
  try {
    const types = await prisma.ticketType.findMany();
    res.json(types);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch ticket types' });
  }
});

app.post('/ticket-types', async (req, res) => {
  const { name, duration, price, status } = req.body;
  try {
    const type = await prisma.ticketType.create({
      data: { name, duration, price, status },
    });
    res.status(201).json(type);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create ticket type' });
  }
});

app.put('/ticket-types/:id', async (req, res) => {
  const { id } = req.params;
  const { name, duration, price, status } = req.body;
  try {
    const type = await prisma.ticketType.update({
      where: { id: Number(id) },
      data: { name, duration, price, status },
    });
    res.json(type);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update ticket type' });
  }
});

app.delete('/ticket-types/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.ticketType.delete({ where: { id: Number(id) } });
    res.status(204).end();
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete ticket type' });
  }
});

const PORT = process.env.PORT || 3000;

export default app;
export function startServer() {
  app.listen(PORT, () => {
    console.log(`🚀 Server listening on http://localhost:${PORT}`);
  });
}
