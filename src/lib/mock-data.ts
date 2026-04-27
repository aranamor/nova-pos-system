// Realistic demo data so the UI is fully usable in preview.
const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const future = (months: number) => {
  const d = new Date(today); d.setMonth(d.getMonth() + months); return d.toISOString().slice(0, 7);
};

export const mockData = {
  dashboardStats: {
    todaySales: 24850.75,
    todayBillCount: 18,
    totalProducts: 412,
    lowStock: 9,
    expiringSoon: 14,
    monthSales: 384200,
    monthBills: 246,
    salesTrend: Array.from({ length: 14 }, (_, i) => ({
      date: iso(new Date(today.getTime() - (13 - i) * 86400000)),
      sales: Math.round(8000 + Math.random() * 22000),
    })),
    recentBills: [
      { id: 101, bill_number: "INV-1024", patient_name: "Aarav Sharma", grand_total: 1450.5, bill_date: today.toISOString() },
      { id: 102, bill_number: "INV-1023", patient_name: "Priya Verma", grand_total: 890.0, bill_date: today.toISOString() },
      { id: 103, bill_number: "INV-1022", patient_name: "Rohit Mehta", grand_total: 2340.75, bill_date: today.toISOString() },
      { id: 104, bill_number: "INV-1021", patient_name: "Ishita Roy", grand_total: 560.25, bill_date: today.toISOString() },
      { id: 105, bill_number: "INV-1020", patient_name: "Karan Patel", grand_total: 4120.0, bill_date: today.toISOString() },
    ],
  },
  products: [
    { id: 1, name: "Paracetamol 500mg", hsn: "30049099", batch: "PCM2401", quantity: 240, packaging: "Strip of 10", mrp: 25, purchase_rate: 14, sale_rate: 21.18, sale_rate_inclusive: 25, expiry: future(8), cgst: 6, sgst: 6 },
    { id: 2, name: "Azithromycin 500mg", hsn: "30049099", batch: "AZT2312", quantity: 60, packaging: "Strip of 5", mrp: 120, purchase_rate: 70, sale_rate: 101.7, sale_rate_inclusive: 120, expiry: future(14), cgst: 9, sgst: 9 },
    { id: 3, name: "Cetirizine 10mg", hsn: "30049099", batch: "CTZ2402", quantity: 8, packaging: "Strip of 10", mrp: 30, purchase_rate: 16, sale_rate: 25.4, sale_rate_inclusive: 30, expiry: future(2), cgst: 6, sgst: 6 },
    { id: 4, name: "Vitamin D3 60K", hsn: "30049099", batch: "VTD2310", quantity: 45, packaging: "Sachet", mrp: 45, purchase_rate: 22, sale_rate: 38.13, sale_rate_inclusive: 45, expiry: future(6), cgst: 6, sgst: 6 },
    { id: 5, name: "Pantoprazole 40mg", hsn: "30049099", batch: "PNT2403", quantity: 4, packaging: "Strip of 15", mrp: 90, purchase_rate: 50, sale_rate: 76.3, sale_rate_inclusive: 90, expiry: future(1), cgst: 9, sgst: 9 },
    { id: 6, name: "Amoxicillin 250mg", hsn: "30049099", batch: "AMX2402", quantity: 110, packaging: "Strip of 10", mrp: 65, purchase_rate: 38, sale_rate: 55.08, sale_rate_inclusive: 65, expiry: future(11), cgst: 9, sgst: 9 },
    { id: 7, name: "Insulin Glargine", hsn: "30043900", batch: "INS2401", quantity: 22, packaging: "Vial", mrp: 850, purchase_rate: 580, sale_rate: 720.34, sale_rate_inclusive: 850, expiry: future(9), cgst: 9, sgst: 9 },
    { id: 8, name: "ORS Sachet", hsn: "30049099", batch: "ORS2401", quantity: 320, packaging: "Sachet", mrp: 22, purchase_rate: 11, sale_rate: 18.64, sale_rate_inclusive: 22, expiry: future(18), cgst: 6, sgst: 6 },
  ],
  customers: [
    { id: 1, name: "Aarav Sharma", mobile: "9876543210", doctor_name: "Dr. Mehta" },
    { id: 2, name: "Priya Verma", mobile: "9876501234", doctor_name: "Dr. Iyer" },
    { id: 3, name: "Rohit Mehta", mobile: "9988776655", doctor_name: "Dr. Khan" },
    { id: 4, name: "Ishita Roy", mobile: "9123456789", doctor_name: "Dr. Mehta" },
    { id: 5, name: "Karan Patel", mobile: "9001122334", doctor_name: "Dr. Sharma" },
  ],
  customerHistory: [
    { product_id: 1, name: "Paracetamol 500mg", batch: "PCM2401", quantity: 2, sale_rate_inclusive: 25, last_bought: iso(today) },
    { product_id: 4, name: "Vitamin D3 60K", batch: "VTD2310", quantity: 1, sale_rate_inclusive: 45, last_bought: iso(today) },
  ],
  suppliers: [
    { id: 1, name: "MedSource Distributors", contact_person: "Anil K.", phone: "9810000001", email: "anil@medsource.in", address: "Mumbai" },
    { id: 2, name: "PharmaPlus Ltd.", contact_person: "Sunita R.", phone: "9810000002", email: "sunita@pharmaplus.in", address: "Delhi" },
    { id: 3, name: "WellCare Wholesale", contact_person: "Rakesh M.", phone: "9810000003", email: "rakesh@wellcare.in", address: "Bengaluru" },
  ],
  settings: {
    shop_name: "Apex Pharmacy",
    gstin: "27ABCDE1234F1Z5",
    address: "12, MG Road, Pune, Maharashtra 411001",
    phone: "+91 98765 43210",
    email: "hello@apexrx.in",
    low_stock_threshold: "10",
  },
  bills: [
    { id: 101, bill_number: "INV-1024", patient_name: "Aarav Sharma", patient_mobile: "9876543210", grand_total: 1450.5, bill_date: today.toISOString(), status: "Completed" },
    { id: 102, bill_number: "INV-1023", patient_name: "Priya Verma", patient_mobile: "9876501234", grand_total: 890.0, bill_date: today.toISOString(), status: "Completed" },
    { id: 103, bill_number: "INV-1022", patient_name: "Rohit Mehta", patient_mobile: "9988776655", grand_total: 2340.75, bill_date: today.toISOString(), status: "Completed" },
    { id: 104, bill_number: "HOLD-9", patient_name: "Walk-in", patient_mobile: "0000000000", grand_total: 320, bill_date: today.toISOString(), status: "Hold" },
  ],
  purchases: [
    { id: 11, invoice_number: "PUR-2401", supplier_name: "MedSource Distributors", purchase_date: iso(today), grand_total: 18450, status: "Completed", tax_type: "Local" },
    { id: 12, invoice_number: "PUR-2402", supplier_name: "PharmaPlus Ltd.", purchase_date: iso(today), grand_total: 9220, status: "Draft", tax_type: "Interstate" },
  ],
  reportsByType(type: string) {
    switch (type) {
      case "sales":
        return [
          { bill_number: "INV-1024", date: iso(today), patient: "Aarav Sharma", subtotal: 1300, tax: 150.5, total: 1450.5 },
          { bill_number: "INV-1023", date: iso(today), patient: "Priya Verma", subtotal: 800, tax: 90, total: 890 },
        ];
      case "profitability":
        return [
          { product: "Paracetamol 500mg", sold: 24, cost: 336, revenue: 600, profit: 264 },
          { product: "Azithromycin 500mg", sold: 6, cost: 420, revenue: 720, profit: 300 },
        ];
      case "inventory":
        return mockData.products.map(p => ({ name: p.name, batch: p.batch, qty: p.quantity, mrp: p.mrp, expiry: p.expiry }));
      case "expiry":
        return mockData.products
          .filter(p => p.expiry <= future(3))
          .map(p => ({ name: p.name, batch: p.batch, expiry: p.expiry, qty: p.quantity }));
      default:
        return [];
    }
  },
};
