'use client';

import { useParams } from 'next/navigation';
import { InvoiceView } from '@/components/invoices/InvoiceView';

export default function ClientInvoicePage() {
  const { id } = useParams<{ id: string }>();
  return <InvoiceView id={id} backHref="/subscription#factures" backLabel="Mes factures" />;
}
