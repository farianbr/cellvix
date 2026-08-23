import Badge from '@/components/ui/Badge';

const TONES = {
  placed: { tone: 'info', label: 'Placed' },
  processing: { tone: 'warn', label: 'Processing' },
  shipped: { tone: 'info', label: 'Shipped' },
  out_for_delivery: { tone: 'brand', label: 'Out for delivery' },
  delivered: { tone: 'ok', label: 'Delivered' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
};

const INVOICE_TONES = {
  paid: { tone: 'ok', label: 'Paid' },
  unpaid: { tone: 'warn', label: 'Unpaid' },
  partial: { tone: 'warn', label: 'Partial' },
  overdue: { tone: 'danger', label: 'Overdue' },
};

export function OrderStatusBadge({ status, size }) {
  const meta = TONES[status] ?? { tone: 'neutral', label: status };
  return (
    <Badge tone={meta.tone} size={size}>
      {meta.label}
    </Badge>
  );
}

export function InvoiceStatusBadge({ status, size }) {
  const meta = INVOICE_TONES[status] ?? { tone: 'neutral', label: status };
  return (
    <Badge tone={meta.tone} size={size}>
      {meta.label}
    </Badge>
  );
}

export default OrderStatusBadge;
