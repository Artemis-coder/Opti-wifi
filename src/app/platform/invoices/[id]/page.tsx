'use client';

import { useParams } from 'next/navigation';
import { InvoiceView } from '@/components/invoices/InvoiceView';

export default function PlatformInvoicePage() {
  const { id } = useParams<{ id: string }>();
  return <InvoiceView id={id} backHref="/platform/invoices" backLabel="Factures" />;
}
