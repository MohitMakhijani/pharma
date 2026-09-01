const prisma = require('../config/prisma');

async function getScheduleDrugReport(storeId, filters = {}) {
  const { fromDate, toDate, scheduleType, search } = filters;

  const dateFilter = {};
  if (fromDate || toDate) {
    if (fromDate) dateFilter.gte = new Date(`${fromDate}T00:00:00.000Z`);
    if (toDate) dateFilter.lte = new Date(`${toDate}T23:59:59.999Z`);
  }

  // 1. Fetch sales that contain schedule / prescription / narcotics drugs
  const sales = await prisma.sale.findMany({
    where: {
      storeId,
      status: { in: ['COMPLETED', 'PARTIALLY_RETURNED', 'FULLY_RETURNED'] },
      ...(Object.keys(dateFilter).length > 0 ? { invoiceDate: dateFilter } : {}),
      items: {
        some: {
          product: {
            OR: [
              { prescriptionOnly: true },
              { scheduling: { not: null } },
              { name: { contains: 'NRX', mode: 'insensitive' } },
            ],
          },
        },
      },
    },
    include: {
      customer: true,
      doctorRel: true,
      items: {
        include: {
          product: true,
          batch: true,
          packaging: true,
        },
      },
    },
    orderBy: {
      invoiceDate: 'desc',
    },
  });

  const registerEntries = [];

  let countScheduleH1 = 0;
  let countScheduleH = 0;
  let countScheduleX = 0;
  let countNrx = 0;
  let totalDispensedQty = 0;

  for (const sale of sales) {
    for (const item of sale.items) {
      const p = item.product;
      const sched = String(p.scheduling || '').toUpperCase();
      const isNrx = sched.includes('NRX') || p.name.toUpperCase().includes('NRX') || p.prescriptionOnly;
      const isH1 = sched.includes('H1');
      const isH = sched.includes('H') && !isH1;
      const isX = sched.includes('X');

      // If user filtered by specific schedule type (H1, H, X, NRX)
      if (scheduleType && scheduleType !== 'ALL') {
        const filterTypeUpper = scheduleType.toUpperCase();
        if (filterTypeUpper === 'H1' && !isH1) continue;
        if (filterTypeUpper === 'H' && !isH) continue;
        if (filterTypeUpper === 'X' && !isX) continue;
        if (filterTypeUpper === 'NRX' && !isNrx) continue;
      }

      // Count classification
      if (isH1) countScheduleH1++;
      else if (isX) countScheduleX++;
      else if (isH) countScheduleH++;
      if (isNrx) countNrx++;

      const qty = Number(item.quantity || 0);
      totalDispensedQty += qty;

      registerEntries.push({
        id: item.id,
        saleId: sale.id,
        invoiceNumber: sale.invoiceNumber,
        dispenseDate: sale.invoiceDate,
        patientName: sale.customer?.name || 'Walk-in Patient',
        patientPhone: sale.customer?.phone || '—',
        patientAddress: sale.customer?.address || '—',
        doctorName: sale.doctorRel?.name || sale.doctor || 'Registered Medical Practitioner',
        doctorRegNo: sale.doctorRel?.registrationNo || '—',
        drugName: p.name,
        genericName: p.genericName || '—',
        scheduleType: p.scheduling || (p.prescriptionOnly ? 'Rx / Schedule H' : 'General'),
        batchNumber: item.batch?.batchNumber || '—',
        expiryDate: item.batch?.expiryDate || null,
        quantity: qty,
        unit: item.packaging?.name || 'Units',
        totalPrice: Number(item.totalAmount || 0),
        prescriptions: sale.prescriptions || [],
      });
    }
  }

  // Search filtering
  let filtered = registerEntries;
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = registerEntries.filter(
      (entry) =>
        entry.drugName.toLowerCase().includes(q) ||
        entry.patientName.toLowerCase().includes(q) ||
        entry.doctorName.toLowerCase().includes(q) ||
        entry.doctorRegNo.toLowerCase().includes(q) ||
        entry.batchNumber.toLowerCase().includes(q) ||
        entry.invoiceNumber.toLowerCase().includes(q)
    );
  }

  // Grouping maps for deep breakdowns
  const doctorDispenseMap = {};
  const patientDispenseMap = {};
  const drugDispenseMap = {};

  for (const entry of registerEntries) {
    // Doctor grouping
    const docKey = entry.doctorName;
    if (!doctorDispenseMap[docKey]) {
      doctorDispenseMap[docKey] = {
        doctorName: docKey,
        doctorRegNo: entry.doctorRegNo,
        prescriptionsCount: 0,
        unitsDispensed: 0,
        totalValue: 0,
      };
    }
    doctorDispenseMap[docKey].prescriptionsCount += 1;
    doctorDispenseMap[docKey].unitsDispensed += entry.quantity;
    doctorDispenseMap[docKey].totalValue += entry.totalPrice;

    // Patient grouping
    const patKey = entry.patientName;
    if (!patientDispenseMap[patKey]) {
      patientDispenseMap[patKey] = {
        patientName: patKey,
        phone: entry.patientPhone,
        address: entry.patientAddress,
        billsCount: 0,
        unitsDispensed: 0,
        totalValue: 0,
      };
    }
    patientDispenseMap[patKey].billsCount += 1;
    patientDispenseMap[patKey].unitsDispensed += entry.quantity;
    patientDispenseMap[patKey].totalValue += entry.totalPrice;

    // Drug grouping
    const drugKey = entry.drugName;
    if (!drugDispenseMap[drugKey]) {
      drugDispenseMap[drugKey] = {
        drugName: drugKey,
        genericName: entry.genericName,
        scheduleType: entry.scheduleType,
        unitsDispensed: 0,
        dispenseCount: 0,
        totalValue: 0,
      };
    }
    drugDispenseMap[drugKey].dispenseCount += 1;
    drugDispenseMap[drugKey].unitsDispensed += entry.quantity;
    drugDispenseMap[drugKey].totalValue += entry.totalPrice;
  }

  return {
    summary: {
      totalEntries: registerEntries.length,
      totalDispensedQty,
      scheduleH1Count: countScheduleH1,
      scheduleHCount: countScheduleH,
      scheduleXCount: countScheduleX,
      nrxCount: countNrx,
    },
    doctorBreakdown: Object.values(doctorDispenseMap).sort((a, b) => b.unitsDispensed - a.unitsDispensed),
    patientBreakdown: Object.values(patientDispenseMap).sort((a, b) => b.unitsDispensed - a.unitsDispensed),
    drugBreakdown: Object.values(drugDispenseMap).sort((a, b) => b.unitsDispensed - a.unitsDispensed),
    entries: filtered,
  };
}

module.exports = {
  getScheduleDrugReport,
};
