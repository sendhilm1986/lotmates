/**
 * "Download your data": a readable PDF and a ZIP of spreadsheet files (CSV).
 * Both are built in the browser from the /me/export response, and the libraries
 * load only when someone asks for a download.
 */

const BRAND = [31, 92, 69]; // #1F5C45
const INK = [29, 59, 48];
const MUTED = [98, 112, 106];
const LINE = [223, 229, 224];
const TINT = [243, 246, 242];
const TURMERIC = [224, 165, 38];

const ROLE = { Customer_c: 'Neighbour', Vendor_c: 'Vendor partner', Ambassador_c: 'Community ambassador', Admin_c: 'Lotmates team' };

const name = (v) => (v && typeof v === 'object' ? v.Name ?? '' : v ?? '');
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const inr = (v) => (num(v) === null ? '—' : `₹${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
const day = (v) => {
  if (!v) return '';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
};
const isoDay = (v) => {
  if (!v) return '';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00` : v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const fileStem = () => `lotmates-my-data-${today()}`;

function refundText(b) {
  if (b.refundStatus_c === 'Due') return `${inr(b.refundDue_c)} due`;
  if (b.refundStatus_c === 'Paid') return `${inr(b.refundDue_c)} refunded`;
  return '—';
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function profileRows(data) {
  const p = data.profile ?? {};
  const rows = [
    ['Name', [p.firstName, p.lastName].filter(Boolean).join(' ')],
    ['Email', p.email],
    ['Phone', p.phone || 'Not added'],
    ['Account', ROLE[p.profile] ?? ''],
    ['Member since', day(p.memberSince)],
  ];
  if (p.profile === 'Customer_c') {
    rows.push(['Community', name(p.community) || 'Not added']);
    rows.push(['Flat or house number', p.address || 'Not added']);
  }
  if (p.vendor) {
    rows.push(['Business', p.vendor.Name]);
    rows.push(['Business status', p.vendor.status ?? '']);
  }
  if (p.communities?.length) rows.push(['Communities you represent', p.communities.map((c) => c.Name).join(', ')]);
  if (p.deletionRequested) rows.push(['Account deletion', `Requested on ${day(p.deletionRequested)}`]);
  return rows;
}

// ---------- PDF ----------

async function fontBase64(url) {
  const buf = await fetch(url).then((r) => {
    if (!r.ok) throw new Error('Could not load the document fonts.');
    return r.arrayBuffer();
  });
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function downloadPdf(data) {
  const [{ jsPDF }, autoTableMod, sg4, sg6, bg7] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    fontBase64('/fonts/pdf/sg-400.ttf'),
    fontBase64('/fonts/pdf/sg-600.ttf'),
    fontBase64('/fonts/pdf/bg-700.ttf'),
  ]);
  const autoTable = autoTableMod.default ?? autoTableMod.autoTable;

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  doc.addFileToVFS('sg-400.ttf', sg4);
  doc.addFont('sg-400.ttf', 'SG', 'normal');
  doc.addFileToVFS('sg-600.ttf', sg6);
  doc.addFont('sg-600.ttf', 'SG', 'bold');
  doc.addFileToVFS('bg-700.ttf', bg7);
  doc.addFont('bg-700.ttf', 'BG', 'normal');

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  const p = data.profile ?? {};
  const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ') || p.email || 'You';

  // Brand mark: two rings with a turmeric centre, then the wordmark.
  const mark = (x, y) => {
    doc.setFillColor(...TURMERIC);
    doc.ellipse(x + 7, y, 4.2, 8.6, 'F');
    doc.setDrawColor(...BRAND);
    doc.setLineWidth(1.9);
    doc.circle(x + 2.6, y, 9.6, 'S');
    doc.circle(x + 11.4, y, 9.6, 'S');
    doc.setFont('BG', 'normal');
    doc.setFontSize(17);
    doc.setTextColor(...BRAND);
    doc.text('lotmates', x + 27, y + 5.5);
  };

  mark(M + 7, M + 8);
  doc.setFont('SG', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text('lotmates.in', W - M, M + 11, { align: 'right' });

  let y = M + 64;
  doc.setFont('BG', 'normal');
  doc.setFontSize(26);
  doc.setTextColor(...INK);
  doc.text('Your Lotmates data', M, y);
  y += 20;
  doc.setFont('SG', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...MUTED);
  doc.text(`Prepared for ${fullName} on ${day(today())}`, M, y);
  y += 26;

  // Headline figures.
  const bookings = data.bookings ?? [];
  const payouts = data.payouts ?? [];
  let figures = null;
  if (p.profile === 'Customer_c' || bookings.length) {
    const live = bookings.filter((b) => b.status_c !== 'Cancelled' || num(b.amountPaid_c));
    const paid = live.reduce((s, b) => s + (num(b.amountPaid_c) ?? 0), 0);
    const back = bookings.reduce((s, b) => s + (b.refundStatus_c === 'Paid' ? num(b.refundDue_c) ?? 0 : 0), 0);
    const due = bookings.reduce((s, b) => s + (b.refundStatus_c === 'Due' ? num(b.refundDue_c) ?? 0 : 0), 0);
    figures = [
      ['Bookings', String(bookings.length)],
      ['Paid', inr(paid)],
      ['Refunded', inr(back)],
      ['Refund due', inr(due)],
    ];
  } else if (p.profile === 'Vendor_c') {
    const net = payouts.filter((x) => x.status_c === 'Paid').reduce((s, x) => s + (num(x.net_c) ?? 0), 0);
    const pending = payouts.filter((x) => x.status_c !== 'Paid').reduce((s, x) => s + (num(x.net_c) ?? 0), 0);
    figures = [
      ['Payouts', String(payouts.length)],
      ['Paid to you', inr(net)],
      ['On its way', inr(pending)],
    ];
  }
  if (figures) {
    const boxH = 58;
    doc.setFillColor(...TINT);
    doc.roundedRect(M, y, W - M * 2, boxH, 12, 12, 'F');
    const colW = (W - M * 2) / figures.length;
    figures.forEach(([label, value], i) => {
      const x = M + colW * i + 16;
      if (i > 0) {
        doc.setDrawColor(...LINE);
        doc.setLineWidth(0.8);
        doc.line(M + colW * i, y + 12, M + colW * i, y + boxH - 12);
      }
      doc.setFont('SG', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text(label, x, y + 21);
      doc.setFont('BG', 'normal');
      doc.setFontSize(15);
      doc.setTextColor(...INK);
      doc.text(value, x, y + 41);
    });
    y += boxH + 30;
  }

  const heading = (title, note) => {
    if (y > H - 140) {
      doc.addPage();
      y = M + 10;
    }
    doc.setFont('BG', 'normal');
    doc.setFontSize(14);
    doc.setTextColor(...INK);
    doc.text(title, M, y);
    if (note) {
      doc.setFont('SG', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text(note, W - M, y, { align: 'right' });
    }
    y += 10;
  };

  const base = {
    margin: { left: M, right: M, bottom: 64 },
    theme: 'plain',
    styles: { font: 'SG', fontStyle: 'normal', fontSize: 9, textColor: INK, cellPadding: { top: 7, bottom: 7, left: 0, right: 8 }, overflow: 'linebreak', lineColor: LINE },
    headStyles: { font: 'SG', fontStyle: 'normal', fontSize: 8.5, textColor: MUTED, cellPadding: { top: 6, bottom: 6, left: 0, right: 8 } },
    didDrawCell: (h) => {
      if (h.section === 'body' || h.section === 'head') {
        doc.setDrawColor(...LINE);
        doc.setLineWidth(0.6);
        doc.line(h.cell.x, h.cell.y + h.cell.height, h.cell.x + h.cell.width, h.cell.y + h.cell.height);
      }
    },
  };
  const table = (opts) => {
    autoTable(doc, { ...base, startY: y, ...opts });
    y = doc.lastAutoTable.finalY + 30;
  };
  const empty = (text) => {
    doc.setFont('SG', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text(text, M, y + 14);
    y += 40;
  };

  heading('Your details');
  table({
    body: profileRows(data),
    columnStyles: { 0: { cellWidth: 150, textColor: MUTED }, 1: { fontStyle: 'bold' } },
  });

  if (p.profile === 'Customer_c' || bookings.length) {
    heading('Bookings', bookings.length ? `${bookings.length} in all` : null);
    if (!bookings.length) empty('No bookings yet.');
    else
      table({
        head: [['Booking', 'Deal', 'Booked on', 'Homes', 'Paid', 'Refund', 'Status']],
        body: bookings.map((b) => [b.Name ?? '', name(b.deal_c), day(b.CreatedOn), String(b.homes_c ?? 1), inr(b.amountPaid_c), refundText(b), b.status_c ?? '']),
        columnStyles: { 0: { cellWidth: 58 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 64 }, 3: { cellWidth: 36, halign: 'right' }, 4: { cellWidth: 56, halign: 'right' }, 5: { cellWidth: 76, halign: 'right' }, 6: { cellWidth: 58 } },
        didParseCell: (h) => {
          if (h.section === 'head' && [3, 4, 5].includes(h.column.index)) h.cell.styles.halign = 'right';
        },
      });
  }

  if (payouts.length) {
    heading('Payouts', `${payouts.length} in all`);
    table({
      head: [['Deal', 'Gross', 'Commission', 'Net', 'Status', 'Paid on']],
      body: payouts.map((x) => [name(x.deal_c), inr(x.gross_c), inr(x.commission_c), inr(x.net_c), x.status_c ?? '', day(x.paidOn_c)]),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    });
  }

  const reviews = data.reviews ?? [];
  if (reviews.length || p.profile === 'Customer_c') {
    heading('Reviews');
    if (!reviews.length) empty('No reviews yet.');
    else
      table({
        head: [['Deal', 'Rating', 'What you wrote', 'Date']],
        body: reviews.map((r) => [name(r.deal_c), r.rating_c ? `${r.rating_c} of 5` : '', r.comment_c ?? '', day(r.CreatedOn)]),
        columnStyles: { 0: { cellWidth: 130 }, 1: { cellWidth: 50 }, 3: { cellWidth: 64 } },
      });
  }

  const complaints = data.complaints ?? [];
  if (complaints.length) {
    heading('Complaints');
    table({
      head: [['Deal', 'What happened', 'Status', 'Date']],
      body: complaints.map((c) => [name(c.deal_c), c.details_c ?? '', c.status_c ?? '', day(c.CreatedOn)]),
      columnStyles: { 0: { cellWidth: 130 }, 2: { cellWidth: 60 }, 3: { cellWidth: 64 } },
    });
  }

  const proposals = data.proposals ?? [];
  if (proposals.length) {
    heading('Proposals');
    table({
      head: [['Idea', 'Community', 'Homes interested', 'Status']],
      body: proposals.map((x) => [x.Name ?? '', name(x.community_c), String(x.homesInterested_c ?? ''), x.status_c ?? '']),
    });
  }

  // Footer on every page.
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.6);
    doc.line(M, H - 44, W - M, H - 44);
    doc.setFont('SG', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text('A copy of the personal data Lotmates holds about you. Not a tax invoice.', M, H - 28);
    doc.text(`Page ${i} of ${pages}`, W - M, H - 28, { align: 'right' });
  }

  doc.setProperties({ title: `Your Lotmates data, ${fullName}`, author: 'Lotmates', creator: 'lotmates.in' });
  doc.save(`${fileStem()}.pdf`);
}

// ---------- CSV (zipped) ----------

const cell = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (header, rows) => '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';

export async function downloadCsvZip(data) {
  const { zipSync, strToU8 } = await import('fflate');
  const files = {};
  const add = (filename, header, rows) => {
    files[filename] = strToU8(csv(header, rows));
  };

  add('profile.csv', ['Field', 'Value'], profileRows(data));

  const bookings = data.bookings ?? [];
  add(
    'bookings.csv',
    ['Booking ref', 'Deal', 'Community', 'Booked on', 'Homes', 'Price per home paid (INR)', 'Amount paid (INR)', 'Final price per home (INR)', 'Refund (INR)', 'Refund status', 'Payment status', 'Booking status', 'Preferred date', 'Preferred time', 'Address', 'Phone', 'Payment reference', 'Notes'],
    bookings.map((b) => [b.Name, name(b.deal_c), name(b.community_c), isoDay(b.CreatedOn), b.homes_c, num(b.unitPrice_c), num(b.amountPaid_c), num(b.finalPrice_c), num(b.refundDue_c), b.refundStatus_c, b.paymentStatus_c, b.status_c, isoDay(b.preferredDate_c), b.preferredSlot_c, b.address_c, b.phone_c, b.paymentRef_c, b.notes_c]),
  );
  add(
    'reviews.csv',
    ['Deal', 'Vendor', 'Rating (of 5)', 'Comment', 'Date'],
    (data.reviews ?? []).map((r) => [name(r.deal_c), name(r.vendor_c), r.rating_c, r.comment_c, isoDay(r.CreatedOn)]),
  );
  add(
    'complaints.csv',
    ['Reference', 'Deal', 'Vendor', 'Details', 'Status', 'Response', 'Resolution', 'Date'],
    (data.complaints ?? []).map((c) => [c.Name, name(c.deal_c), name(c.vendor_c), c.details_c, c.status_c, c.response_c, c.resolution_c, isoDay(c.CreatedOn)]),
  );
  if ((data.proposals ?? []).length) {
    add(
      'proposals.csv',
      ['Idea', 'Category', 'Community', 'Homes interested', 'Notes', 'Status', 'Team note', 'Date'],
      data.proposals.map((x) => [x.Name, x.category_c, name(x.community_c), x.homesInterested_c, x.notes_c, x.status_c, x.adminNote_c, isoDay(x.CreatedOn)]),
    );
  }
  if ((data.payouts ?? []).length) {
    add(
      'payouts.csv',
      ['Reference', 'Deal', 'Gross (INR)', 'Commission (INR)', 'Net (INR)', 'Status', 'Paid on', 'Bank reference'],
      data.payouts.map((x) => [x.Name, name(x.deal_c), num(x.gross_c), num(x.commission_c), num(x.net_c), x.status_c, isoDay(x.paidOn_c), x.reference_c]),
    );
  }
  files['README.txt'] = strToU8(
    `Your Lotmates data, exported on ${today()}.\r\n\r\nEach .csv file opens in Excel, Google Sheets or Numbers. Amounts are in Indian rupees.\r\nQuestions: ${window.location.origin}/contact\r\n`,
  );

  const zipped = zipSync(files, { level: 6 });
  saveBlob(new Blob([zipped], { type: 'application/zip' }), `${fileStem()}.zip`);
}
