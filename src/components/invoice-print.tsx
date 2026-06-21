import { formatCurrency } from "@/lib/format";

export type InvoiceData = {
  number?: string | number;
  date?: string;
  store?: { name?: string; phone?: string; address?: string; logo_url?: string; tax_number?: string };
  customer?: { name?: string; phone?: string } | null;
  items: { name: string; quantity: number; unit_price: number }[];
  subtotal: number;
  discount: number;
  tax: number;
  tax_rate?: number;
  total: number;
  paid: number;
  due: number;
  currency: string;
  payment?: string;
  cashier?: string;
};

export function InvoicePrint({ data }: { data: InvoiceData }) {
  const d = data;
  return (
    <div className="print-area hidden print:block" dir="rtl" style={{ fontFamily: "system-ui, sans-serif", color: "#000" }}>
      <div style={{ textAlign: "center", borderBottom: "2px dashed #000", paddingBottom: 8, marginBottom: 8 }}>
        {d.store?.logo_url && <img src={d.store.logo_url} alt="" style={{ height: 48, margin: "0 auto 4px" }} />}
        <div style={{ fontWeight: 800, fontSize: 18 }}>{d.store?.name ?? "Muassal Pro"}</div>
        {d.store?.address && <div style={{ fontSize: 11 }}>{d.store.address}</div>}
        {d.store?.phone && <div style={{ fontSize: 11 }}>هاتف: {d.store.phone}</div>}
        {d.store?.tax_number && <div style={{ fontSize: 11 }}>الرقم الضريبي: {d.store.tax_number}</div>}
      </div>
      <div style={{ fontSize: 12, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
        <div>فاتورة #{d.number ?? "—"}</div>
        <div>{d.date ?? new Date().toLocaleString("ar")}</div>
      </div>
      {d.customer?.name && <div style={{ fontSize: 12, marginBottom: 6 }}>العميل: {d.customer.name}{d.customer.phone ? ` — ${d.customer.phone}` : ""}</div>}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #000" }}>
            <th style={{ textAlign: "right", padding: 4 }}>الصنف</th>
            <th style={{ padding: 4 }}>الكمية</th>
            <th style={{ padding: 4 }}>السعر</th>
            <th style={{ padding: 4 }}>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {d.items.map((it, i) => (
            <tr key={i} style={{ borderBottom: "1px dashed #999" }}>
              <td style={{ padding: 4 }}>{it.name}</td>
              <td style={{ padding: 4, textAlign: "center" }}>{it.quantity}</td>
              <td style={{ padding: 4, textAlign: "center" }}>{formatCurrency(it.unit_price, d.currency)}</td>
              <td style={{ padding: 4, textAlign: "center" }}>{formatCurrency(it.quantity * it.unit_price, d.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 8, fontSize: 12 }}>
        <Row label="المجموع" value={formatCurrency(d.subtotal, d.currency)} />
        {d.discount > 0 && <Row label="الخصم" value={`- ${formatCurrency(d.discount, d.currency)}`} />}
        {d.tax > 0 && <Row label={`الضريبة ${d.tax_rate ?? ""}%`} value={formatCurrency(d.tax, d.currency)} />}
        <div style={{ borderTop: "1px solid #000", margin: "4px 0" }} />
        <Row label="الإجمالي" value={formatCurrency(d.total, d.currency)} bold />
        <Row label="المدفوع" value={formatCurrency(d.paid, d.currency)} />
        {d.due > 0 && <Row label="المتبقي (آجل)" value={formatCurrency(d.due, d.currency)} bold />}
        {d.payment && <Row label="طريقة الدفع" value={d.payment} />}
      </div>
      <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, borderTop: "2px dashed #000", paddingTop: 8 }}>
        شكراً لزيارتكم 🌹
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: bold ? 800 : 400, padding: "2px 0" }}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}
