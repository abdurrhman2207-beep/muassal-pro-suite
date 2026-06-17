import JsBarcode from "jsbarcode";

export function printBarcodeLabel(opts: { code: string; name: string; price?: string }) {
  const win = window.open("", "_blank", "width=400,height=300");
  if (!win) return;
  const svgId = "bc";
  win.document.write(`<!doctype html><html dir="rtl"><head><title>طباعة باركود</title>
  <style>body{font-family:system-ui;margin:0;padding:16px;text-align:center}
  .label{border:1px dashed #999;padding:12px;display:inline-block}
  .name{font-weight:700;font-size:14px;margin-bottom:4px}
  .price{font-size:13px;margin-top:4px}
  @media print{.label{border:none}}
  </style></head><body>
  <div class="label"><div class="name">${opts.name}</div>
  <svg id="${svgId}"></svg>
  ${opts.price ? `<div class="price">${opts.price}</div>` : ""}</div>
  </body></html>`);
  win.document.close();
  // generate after DOM ready
  const svg = win.document.getElementById(svgId)!;
  JsBarcode(svg, opts.code, { format: "CODE128", width: 2, height: 60, displayValue: true, fontSize: 14, margin: 4 });
  setTimeout(() => { win.focus(); win.print(); }, 200);
}