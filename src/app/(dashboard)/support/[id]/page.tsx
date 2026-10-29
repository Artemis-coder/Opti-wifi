'use client';

import { useParams } from 'next/navigation';
import { TicketThread } from '@/components/support/TicketThread';

export default function ClientTicketPage() {
  const { id } = useParams<{ id: string }>();
  return <TicketThread endpoint={`/api/support/${id}`} viewer="client" backHref="/support" backLabel="Mes tickets" />;
}
