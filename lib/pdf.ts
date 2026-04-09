/**
 * ============================================================
 * Vertex Suite — Professional Tally-Style A4 Invoice PDF
 * Reads from InvoiceSettings (stored in profile) for all
 * customization options. Clean black-and-white output.
 * ============================================================
 */
import { jsPDF } from 'jspdf'
import { numberToWords, formatNumber, getStateName } from '@/lib/gst'
import type { Invoice, InvoiceItem, Profile, InvoiceSettings } from '@/lib/types'
import { DEFAULT_INVOICE_SETTINGS } from '@/lib/types'
import { format } from 'date-fns'

// ── A4 Constants (mm) — Tally-standard margins ───────────────
const A4 = { w: 210, h: 297 }
const A5 = { w: 148, h: 210 }

const TALLY_MARGIN = { top: 8, right: 8, bottom: 8, left: 8 }

// Column widths as fractions of content width
const COL_FRACS = [0.06, 0.34, 0.10, 0.08, 0.14, 0.06, 0.22]
const ROW  = 5.5      // item row height
const THIN = 0.15
const THICK = 0.35

interface PDFInvoiceData {
  invoice: Invoice
  items: InvoiceItem[]
  profile: Profile
  titleOverride?: string  // optional override for purchase bills
}

// ── Helpers ──────────────────────────────────────────────────
function fmtINR(n: number): string {
  return 'Rs.' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtNum(n: number): string {
  return formatNumber(n)
}

function hline(doc: jsPDF, x: number, y: number, w: number) {
  doc.setLineWidth(THIN)
  doc.line(x, y, x + w, y)
}

function vline(doc: jsPDF, x: number, y1: number, y2: number) {
  doc.setLineWidth(THIN)
  doc.line(x, y1, x, y2)
}

function box(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setLineWidth(THIN)
  doc.rect(x, y, w, h)
}

function textR(doc: jsPDF, text: string, x: number, y: number) {
  doc.text(text, x, y, { align: 'right' })
}

function textC(doc: jsPDF, text: string, x: number, y: number) {
  doc.text(text, x, y, { align: 'center' })
}

// Compress and convert an image URL to a base64 data URL (max 200x80 for logos)
async function loadImageAsBase64(url: string, maxW = 200, maxH = 80): Promise<string | null> {
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
      img.src = url
    })
    // Scale down
    let w = img.width, h = img.height
    if (w > maxW) { h = h * (maxW / w); w = maxW }
    if (h > maxH) { w = w * (maxH / h); h = maxH }
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', 0.7)
  } catch {
    return null
  }
}

// ── Main Export ──────────────────────────────────────────────
export async function downloadInvoicePDF(data: PDFInvoiceData) {
  const { invoice, items, profile, titleOverride } = data
  const s: InvoiceSettings = {
    branding: { ...DEFAULT_INVOICE_SETTINGS.branding, ...(profile.invoice_settings?.branding || {}) },
    layout: { ...DEFAULT_INVOICE_SETTINGS.layout, ...(profile.invoice_settings?.layout || {}) },
    printing: { ...DEFAULT_INVOICE_SETTINGS.printing, ...(profile.invoice_settings?.printing || {}) },
  }

  const title = titleOverride || s.branding.title || 'TAX INVOICE'
  const isInter = invoice.supply_type === 'interstate'

  // Paper size
  const paper = s.printing.paperSize === 'a5' ? A5 : A4
  const M = TALLY_MARGIN
  const PW = paper.w
  const PH = paper.h
  const CW = PW - M.left - M.right
  const COLS = COL_FRACS.map(r => r * CW)

  const FIRST_ITEMS = s.printing.paperSize === 'a5' ? 6 : (s.printing.compactMode ? 15 : 12)
  const NEXT_ITEMS  = s.printing.paperSize === 'a5' ? 12 : (s.printing.compactMode ? 28 : 25)

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: s.printing.paperSize === 'a5' ? 'a5' : 'a4'
  })

  doc.setTextColor(0, 0, 0)
  doc.setDrawColor(0, 0, 0)

  // Pre-load logo if needed
  let logoData: string | null = null
  if (s.branding.showLogo && profile.logo_url) {
    logoData = await loadImageAsBase64(profile.logo_url)
  }

  // ── Paginate items ─────────────────────────────────────────
  const pages: InvoiceItem[][] = []
  if (items.length <= FIRST_ITEMS) {
    pages.push(items)
  } else {
    pages.push(items.slice(0, FIRST_ITEMS))
    let rest = items.slice(FIRST_ITEMS)
    while (rest.length > 0) {
      pages.push(rest.slice(0, NEXT_ITEMS))
      rest = rest.slice(NEXT_ITEMS)
    }
  }

  const totalPages = pages.length

  for (let pg = 0; pg < totalPages; pg++) {
    if (pg > 0) doc.addPage()
    doc.setTextColor(0, 0, 0)
    doc.setDrawColor(0, 0, 0)

    const pgItems = pages[pg]
    const isFirst = pg === 0
    const isLast  = pg === totalPages - 1
    let y = M.top

    // ═══ OUTER BORDER ═══
    doc.setLineWidth(THICK)
    doc.rect(M.left, M.top, CW, PH - M.top - M.bottom)
    doc.setLineWidth(THIN)

    // ═══ TITLE BAR ═══
    const titleH = 7
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    textC(doc, title, PW / 2, y + 5)
    if (s.branding.subtitle) {
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      textC(doc, s.branding.subtitle, PW / 2, y + 9)
    }
    y += titleH
    hline(doc, M.left, y, CW)

    // ═══ HEADER (First Page) ═══
    if (isFirst) {
      const leftW = CW * 0.58
      const rightW = CW - leftW
      const hdrTop = y

      // ── LEFT: Seller ──
      let ly = y + 3.5
      doc.setFontSize(6.5)
      doc.setFont('helvetica', 'bold')
      doc.text('Consignor (Seller)', M.left + 2, ly)
      ly += 4

      // Logo
      if (logoData) {
        try {
          doc.addImage(logoData, 'JPEG', M.left + 2, ly - 1, 22, 10)
          doc.setFontSize(9.5)
          doc.setFont('helvetica', 'bold')
          doc.text(profile.business_name || '', M.left + 26, ly + 4)
          ly += 11
        } catch {
          doc.setFontSize(9.5)
          doc.text(profile.business_name || '', M.left + 2, ly)
          ly += 4
        }
      } else {
        doc.setFontSize(9.5)
        doc.text(profile.business_name || '', M.left + 2, ly)
        ly += 4
      }

      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      if (profile.address) {
        const addrLines = doc.splitTextToSize(profile.address, leftW - 6)
        doc.text(addrLines, M.left + 2, ly)
        ly += addrLines.length * 3
      }
      doc.text(`${profile.city || ''}, ${profile.state_name || ''} - ${profile.pincode || ''}`, M.left + 2, ly)
      ly += 3.5

      if (s.layout.showGSTIN) {
        doc.text('GSTIN/UIN: ', M.left + 2, ly)
        doc.setFont('helvetica', 'bold')
        doc.text(profile.gstin || 'N/A', M.left + 2 + doc.getTextWidth('GSTIN/UIN: '), ly)
        doc.setFont('helvetica', 'normal')
        ly += 3.5
      }

      doc.text(`State Name: ${profile.state_name || ''}, Code: ${profile.state_code || ''}`, M.left + 2, ly)
      ly += 3.5

      if (s.layout.showPAN && profile.pan) {
        doc.text(`PAN: ${profile.pan}`, M.left + 2, ly)
        ly += 3.5
      }

      if (profile.phone) {
        doc.text(`Contact: ${profile.phone}`, M.left + 2, ly)
        ly += 3.5
      }

      const hdrH = ly - hdrTop + 1

      // ── RIGHT: Invoice Details ──
      const rx = M.left + leftW
      const detailRows: [string, string][] = [
        ['Invoice No.', invoice.invoice_number],
        ['Dated', format(new Date(invoice.invoice_date), 'dd-MMM-yyyy')],
        ['Mode/Terms of Payment', invoice.payment_method || ''],
        ['Place of Supply', getStateName(invoice.customer_state_code) + ' (' + (invoice.customer_state_code || '') + ')'],
      ]
      if (s.layout.showBuyerOrderNo && invoice.buyer_order_no) {
        detailRows.push(['Buyer\'s Order No.', invoice.buyer_order_no])
      }
      if (s.layout.showTransportDetails) {
        if (invoice.transport_mode) detailRows.push(['Transport Mode', invoice.transport_mode])
        if (invoice.vehicle_no) detailRows.push(['Vehicle No.', invoice.vehicle_no])
      }

      const dRowH = hdrH / detailRows.length
      for (let i = 0; i < detailRows.length; i++) {
        const dy = hdrTop + i * dRowH
        hline(doc, rx, dy, rightW)
        doc.setFontSize(6)
        doc.setFont('helvetica', 'normal')
        doc.text(detailRows[i][0], rx + 2, dy + 3)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.text(detailRows[i][1] || '', rx + 2, dy + dRowH - 1.5)
      }

      vline(doc, rx, hdrTop, hdrTop + hdrH)
      hline(doc, M.left, hdrTop + hdrH, CW)
      y = hdrTop + hdrH

      // ── CONSIGNEE (Buyer) ──
      if (s.layout.showBuyerAddress) {
        const buyTop = y
        let by = y + 3.5
        doc.setFontSize(6.5)
        doc.setFont('helvetica', 'bold')
        doc.text('Consignee (Buyer)', M.left + 2, by)
        by += 4
        doc.setFontSize(9)
        doc.text(invoice.customer_name || 'Walk-in Customer', M.left + 2, by)
        by += 3.5
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        if (s.layout.showGSTIN && invoice.customer_gstin) {
          doc.text('GSTIN/UIN: ', M.left + 2, by)
          doc.setFont('helvetica', 'bold')
          doc.text(invoice.customer_gstin, M.left + 2 + doc.getTextWidth('GSTIN/UIN: '), by)
          doc.setFont('helvetica', 'normal')
          by += 3.5
        }
        if (invoice.customer_state_code) {
          doc.text(`State Code: ${invoice.customer_state_code}`, M.left + 2, by)
          by += 3.5
        }

        // Shipping address (if different)
        if (s.layout.showShippingAddress && invoice.shipping_address) {
          const shippingX = M.left + leftW
          vline(doc, shippingX, buyTop, by - buyTop + buyTop + 1)
          doc.setFontSize(6.5)
          doc.setFont('helvetica', 'bold')
          doc.text('Ship To', shippingX + 2, buyTop + 3.5)
          doc.setFontSize(7)
          doc.setFont('helvetica', 'normal')
          let sy = buyTop + 7.5
          doc.text(invoice.shipping_address, shippingX + 2, sy)
          sy += 3.5
          if (invoice.shipping_city || invoice.shipping_state) {
            doc.text(`${invoice.shipping_city || ''}, ${invoice.shipping_state || ''} - ${invoice.shipping_pincode || ''}`, shippingX + 2, sy)
          }
        }

        const buyH = by - buyTop + 1
        hline(doc, M.left, buyTop + buyH, CW)
        y = buyTop + buyH
      }

    } else {
      // ── Continuation page header ──
      let ly = y + 4
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text(`${title}  \u2014  ${invoice.invoice_number}`, M.left + 2, ly)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      textR(doc, `Page ${pg + 1} of ${totalPages}   |   ${format(new Date(invoice.invoice_date), 'dd-MMM-yyyy')}`, M.left + CW - 2, ly)
      ly += 5
      hline(doc, M.left, ly, CW)
      y = ly
    }

    // ═══ ITEMS TABLE ═══
    const thY = y
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')

    // Build headers based on settings
    let headers = ['S.No.', 'Description of Goods']
    let colWidths = [COLS[0], COLS[1]]
    if (s.layout.showHSN) { headers.push('HSN/SAC'); colWidths.push(COLS[2]) }
    headers.push('Qty', 'Rate', 'per', 'Amount')
    colWidths.push(COLS[3], COLS[4], COLS[5], COLS[6])
    if (!s.layout.showHSN) {
      // redistribute HSN space to description
      colWidths[1] += COLS[2]
    }

    let cx = M.left
    for (let i = 0; i < headers.length; i++) {
      const alignIdx = s.layout.showHSN ? i : (i >= 2 ? i + 1 : i)
      const a = [3,4,6].includes(alignIdx) ? 'right' : [0,2,5].includes(alignIdx) ? 'center' : 'left'
      const tx = a === 'right' ? cx + colWidths[i] - 2 : a === 'center' ? cx + colWidths[i] / 2 : cx + 2
      doc.text(headers[i], tx, y + ROW - 1.5, { align: a as any })
      cx += colWidths[i]
    }
    y += ROW
    hline(doc, M.left, y, CW)

    const tableTopY = thY

    // Global item index
    let gIdx = 0
    for (let p = 0; p < pg; p++) gIdx += pages[p].length

    // Item rows
    doc.setFontSize(7)
    for (let i = 0; i < pgItems.length; i++) {
      const item = pgItems[i]
      cx = M.left

      const baseCells: { t: string; a: 'left' | 'center' | 'right'; bold?: boolean }[] = [
        { t: String(gIdx + i + 1), a: 'center' },
        { t: item.product_name.length > 45 ? item.product_name.slice(0, 43) + '..' : item.product_name, a: 'left', bold: true },
      ]
      if (s.layout.showHSN) baseCells.push({ t: item.hsn_code || '', a: 'center' })
      baseCells.push(
        { t: `${item.quantity} ${item.unit || ''}`.trim(), a: 'right' },
        { t: fmtNum(item.unit_price), a: 'right' },
        { t: item.unit || 'pcs', a: 'center' },
        { t: fmtNum(item.total_amount), a: 'right' },
      )

      for (let c = 0; c < baseCells.length; c++) {
        doc.setFont('helvetica', baseCells[c].bold ? 'bold' : 'normal')
        const tx = baseCells[c].a === 'right' ? cx + colWidths[c] - 2
                 : baseCells[c].a === 'center' ? cx + colWidths[c] / 2
                 : cx + 2
        doc.text(baseCells[c].t, tx, y + ROW - 1.5, { align: baseCells[c].a })
        cx += colWidths[c]
      }
      y += ROW
    }

    // Spacer rows to fill
    let tableBottomY: number
    if (isLast) {
      const footerH = s.printing.compactMode ? 45 : 60
      const target = PH - M.bottom - footerH
      while (y + ROW <= target) y += ROW
      tableBottomY = y
    } else {
      const target = PH - M.bottom - 8
      while (y + ROW <= target) y += ROW
      tableBottomY = y
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(6.5)
      textC(doc, 'Continued on next page...', PW / 2, y + 4)
    }

    // Close items area
    hline(doc, M.left, tableBottomY, CW)
    let vx = M.left
    for (let i = 0; i < colWidths.length - 1; i++) {
      vx += colWidths[i]
      vline(doc, vx, tableTopY, tableBottomY)
    }

    // ═══ FOOTER (last page) ═══
    if (isLast) {
      y = tableBottomY

      // ── TOTALS (Items Total, Discount, Grand Total) ──
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      const labelX = M.left + colWidths.slice(0, colWidths.length - 1).reduce((a, b) => a + b, 0)
      
      const itemsSubtotal = items.reduce((s, i) => s + i.total_amount, 0)
      const hasDiscount = (invoice.cash_discount || 0) > 0

      if (hasDiscount) {
        // Show Item Subtotal
        textR(doc, 'Total (Tax Incl.)', labelX - 2, y + ROW - 1.5)
        textR(doc, formatNumber(itemsSubtotal), M.left + CW - 2, y + ROW - 1.5)
        vline(doc, labelX, y, y + ROW)
        y += ROW
        hline(doc, M.left, y, CW)

        // Show Discount Row
        doc.setTextColor(200, 0, 0) // Reddish for discount
        textR(doc, 'Less: Cash Discount', labelX - 2, y + ROW - 1.5)
        textR(doc, '(-) ' + formatNumber(invoice.cash_discount || 0), M.left + CW - 2, y + ROW - 1.5)
        vline(doc, labelX, y, y + ROW)
        y += ROW
        hline(doc, M.left, y, CW)
        doc.setTextColor(0, 0, 0)
      }

      // Final Grand Total
      doc.setFontSize(8.5)
      textR(doc, 'Total Payable', labelX - 2, y + ROW - 1.5)
      textR(doc, 'Rs.' + formatNumber(invoice.grand_total), M.left + CW - 2, y + ROW - 1.5)
      vline(doc, labelX, y, y + ROW)
      y += ROW
      hline(doc, M.left, y, CW)

      // ── BOTTOM 2-COL ──
      const botTop = y
      const leftW  = CW * 0.62
      const rightW = CW - leftW
      let lby = y + 3.5

      // Amount in words
      if (s.layout.showAmountInWords) {
        doc.setFontSize(6.5)
        doc.setFont('helvetica', 'bold')
        doc.text('Amount Chargeable (in words)', M.left + 2, lby)
        lby += 4
        doc.setFontSize(7.5)
        const words = `Indian Rupees ${numberToWords(invoice.grand_total)}`
        const wLines = doc.splitTextToSize(words, leftW - 6)
        doc.text(wLines, M.left + 2, lby)
        lby += wLines.length * 3.5 + 2
      }

      // Tax breakdown
      if (s.layout.showTaxBreakdown) {
        hline(doc, M.left, lby, leftW)
        lby += 1
        doc.setFontSize(6)
        doc.setFont('helvetica', 'bold')
        const tty = lby

        if (isInter) {
          const tc = [leftW * 0.28, leftW * 0.16, leftW * 0.28, leftW * 0.28]
          const th = ['Taxable Value', 'IGST %', 'IGST Amt', 'Total Tax']
          let tx = M.left
          for (let i = 0; i < tc.length; i++) {
            box(doc, tx, tty, tc[i], 5)
            doc.text(th[i], tx + 1.5, tty + 3.5)
            tx += tc[i]
          }
          tx = M.left
          const pct = invoice.subtotal > 0 ? ((invoice.igst_amount / invoice.subtotal) * 100).toFixed(1) : '0'
          const vals = [fmtNum(invoice.subtotal), `${pct}%`, fmtNum(invoice.igst_amount), fmtNum(invoice.total_gst)]
          doc.setFont('helvetica', 'normal')
          for (let i = 0; i < tc.length; i++) {
            box(doc, tx, tty + 5, tc[i], 5)
            textR(doc, vals[i], tx + tc[i] - 1.5, tty + 8.5)
            tx += tc[i]
          }
          lby = tty + 12
        } else {
          const tc = [leftW * 0.20, leftW * 0.11, leftW * 0.18, leftW * 0.11, leftW * 0.18, leftW * 0.22]
          const th = ['Taxable Val', 'CGST%', 'CGST Amt', 'SGST%', 'SGST Amt', 'Total Tax']
          let tx = M.left
          for (let i = 0; i < tc.length; i++) {
            box(doc, tx, tty, tc[i], 5)
            doc.setFontSize(5.5)
            doc.text(th[i], tx + 1, tty + 3.5)
            tx += tc[i]
          }
          tx = M.left
          const cp = invoice.subtotal > 0 ? ((invoice.cgst_amount / invoice.subtotal) * 100).toFixed(1) : '0'
          const sp = invoice.subtotal > 0 ? ((invoice.sgst_amount / invoice.subtotal) * 100).toFixed(1) : '0'
          const vals = [fmtNum(invoice.subtotal), `${cp}%`, fmtNum(invoice.cgst_amount), `${sp}%`, fmtNum(invoice.sgst_amount), fmtNum(invoice.total_gst)]
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(6)
          for (let i = 0; i < tc.length; i++) {
            box(doc, tx, tty + 5, tc[i], 5)
            textR(doc, vals[i], tx + tc[i] - 1.5, tty + 8.5)
            tx += tc[i]
          }
          lby = tty + 12
        }
      }

      // Bank details
      if (s.layout.showBankDetails && profile.bank_name) {
        lby += 2
        hline(doc, M.left, lby, leftW)
        lby += 3.5
        doc.setFontSize(6)
        doc.setFont('helvetica', 'bold')
        doc.text("Company's Bank Details", M.left + 2, lby)
        lby += 3
        doc.setFont('helvetica', 'normal')
        doc.text(`Bank Name  :  ${profile.bank_name}`, M.left + 2, lby)
        lby += 3
        doc.text(`A/c No.      :  ${profile.bank_account || ''}`, M.left + 2, lby)
        lby += 3
        doc.text(`Branch & IFSC Code  :  ${profile.bank_ifsc || ''}`, M.left + 2, lby)
        lby += 3
      }

      const botH = Math.max(lby - botTop + 2, 30)

      vline(doc, M.left + leftW, botTop, botTop + botH)
      hline(doc, M.left, botTop + botH, CW)

      // ── Right: E&OE + Signatory ──
      doc.setFontSize(6.5)
      doc.setFont('helvetica', 'normal')
      textR(doc, 'E. & O.E.', M.left + CW - 3, botTop + 4)

      if (s.branding.showSignature) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.5)
        textR(doc, `for ${profile.business_name || ''}`, M.left + CW - 3, botTop + botH - 14)

        // Signature image if available
        if (s.branding.showDigitalSignature && profile.signature_url) {
          try {
            const sigData = await loadImageAsBase64(profile.signature_url, 120, 40)
            if (sigData) {
              doc.addImage(sigData, 'JPEG', M.left + leftW + rightW - 35, botTop + botH - 25, 30, 10)
            }
          } catch { /* skip */ }
        }

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        textR(doc, 'Authorised Signatory', M.left + CW - 3, botTop + botH - 3)
      }

      // Computer Generated footer
      doc.setFontSize(6)
      doc.setFont('helvetica', 'italic')
      textC(doc, 'This is a Computer Generated Invoice', PW / 2, botTop + botH + 4)
    }
  }

  // ── Save ───────────────────────────────────────────────────
  const filename = `${invoice.invoice_number.replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`
  doc.save(filename)
}
