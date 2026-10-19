import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { cents, euro, totalCents, type InvoiceInput } from "./schema";

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\t/g, "    ").split(/\r\n?|\n/)) {
    let line = "";
    for (const char of paragraph) {
      if (font.widthOfTextAtSize(line + char, size) > width) {
        const space = line.lastIndexOf(" ");
        if (space > line.length / 2) {
          lines.push(line.slice(0, space));
          line = line.slice(space + 1) + char;
        } else {
          lines.push(line);
          line = char;
        }
      } else line += char;
    }
    lines.push(line);
  }
  return lines;
}
const date = (v: string) => v.split("-").reverse().join(".");
export async function renderInvoice(
  input: InvoiceInput,
  number: string,
  issuedDate: string,
  logo: Uint8Array,
) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Rechnung ${number} - ${input.title}`);
  doc.setAuthor("LIGHTSIGNAL GBR");
  doc.setCreationDate(new Date(`${issuedDate}T12:00:00Z`));
  doc.setModificationDate(new Date(`${issuedDate}T12:00:00Z`));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const image = await doc.embedPng(logo);
  let page = doc.addPage([595.28, 841.89]);
  let y = 0;
  const draw = (t: string, x: number, top: number, size = 10, heavy = false) =>
    page.drawText(t, { x, y: 841.89 - top, size, font: heavy ? bold : font });
  const block = (
    t: string,
    x: number,
    top: number,
    width: number,
    size = 10,
    leading = 14,
  ) => {
    const lines = wrap(t, font, size, width);
    lines.forEach((line, i) => draw(line, x, top + i * leading, size));
    return lines.length * leading;
  };
  const footer = () => {
    page.drawLine({
      start: { x: 48, y: 95 },
      end: { x: 547, y: 95 },
      thickness: 0.5,
      color: rgb(0.6, 0.6, 0.6),
    });
    block(
      "LIGHTSIGNAL GBR\nOliver Schöfberger & Daniel Ecklkofer\nSt.-Emmeram-Str. 2\n84332 Hebertsfelden",
      48,
      765,
      190,
      8,
      11,
    );
    block(
      "Tel.: +49 175 6836506\nSteuernummer: 11316700308\nlightsignal.dj@gmail.com",
      255,
      765,
      150,
      8,
      11,
    );
    block(
      "VR-Bank Rottal-Inn eG\nBIC: GENODEF1PFK\nIBAN:\nDE16740618130005498473",
      420,
      765,
      130,
      8,
      10,
    );
    draw(`Seite ${doc.getPageCount()}`, 505, 829, 8);
  };
  const newPage = () => {
    footer();
    page = doc.addPage([595.28, 841.89]);
    draw(`LIGHTSIGNAL GBR · Rechnung ${number}`, 48, 48, 11, true);
    y = 85;
  };
  const ensure = (height: number) => {
    if (y + height > 720) newPage();
  };
  draw("Daniel Ecklkofer & Oliver Schöfberger GBR", 48, 49, 8);
  draw("St.-Emmeram-Str. 2 · 84332 Hebertsfelden", 48, 61, 8);
  page.drawImage(image, { x: 390, y: 738, width: 145, height: 65 });
  block(
    "LIGHTSIGNAL GBR\nSt.-Emmeram-Str. 2\n84332 Hebertsfelden\n\nTel.: +49 175 6836506\nlightsignal.dj@gmail.com",
    390,
    123,
    160,
    9,
    13,
  );
  const recipientHeight = block(input.recipient, 48, 115, 300, 11, 15);
  const heading = Math.max(259, 115 + recipientHeight + 30);
  draw("Rechnung", 48, heading, 22, true);
  draw(`Rechnung Nr. ${number}`, 48, heading + 32, 11);
  draw(`Datum: ${date(issuedDate)}`, 410, heading + 32, 10);
  y = heading + 60;
  y += block(input.title, 48, y, 495, 11, 15) + 5;
  draw(`Leistungsdatum: ${date(input.serviceDate)}`, 48, y, 10);
  y += 30;
  const header = () => {
    page.drawRectangle({
      x: 48,
      y: 841.89 - y - 16,
      width: 499,
      height: 23,
      color: rgb(0.91, 0.91, 0.91),
    });
    [
      ["Pos.", 54],
      ["Leistung", 85],
      ["Einzelpreis", 345],
      ["Anzahl", 424],
      ["Gesamtpreis", 475],
    ].forEach(([t, x]) => draw(String(t), Number(x), y + 8, 9, true));
    y += 35;
  };
  header();
  input.items.forEach((item, index) => {
    const lines = wrap(item.description, font, 9.5, 246);
    let offset = 0;
    do {
      if (y + 40 > 710) {
        newPage();
        header();
      }
      const available = Math.max(1, Math.floor((710 - y - 14) / 13));
      const segment = lines.slice(offset, offset + available);
      draw(`${index + 1}${offset ? " …" : ""}`, 54, y, 9.5);
      segment.forEach((line, i) => draw(line, 85, y + i * 13, 9.5));
      if (!offset) {
        draw(euro(cents(item.unitPrice)), 345, y, 8);
        draw(String(item.quantity), 425, y, 8);
        const total = euro(cents(item.unitPrice) * BigInt(item.quantity));
        draw(total, 541 - font.widthOfTextAtSize(total, 8), y, 8);
      }
      y += Math.max(32, segment.length * 13 + 14);
      offset += segment.length;
      if (offset < lines.length) {
        newPage();
        header();
      }
    } while (offset < lines.length);
    page.drawLine({
      start: { x: 48, y: 841.89 - y + 8 },
      end: { x: 547, y: 841.89 - y + 8 },
      thickness: 0.4,
      color: rgb(0.8, 0.8, 0.8),
    });
  });
  ensure(55);
  y += 12;
  draw(`Gesamtbetrag: ${euro(totalCents(input.items))}`, 340, y, 12, true);
  y += 35;
  const payment =
    input.payment === "TRANSFER_OPEN"
      ? `Bitte überweisen Sie den Betrag von ${euro(totalCents(input.items))} innerhalb von ${input.dueDays} Tagen auf das unten angegebene Bankkonto. Als Verwendungszweck bitte die Rechnungsnummer angeben.`
      : `Der Betrag von ${euro(totalCents(input.items))} wurde am ${date(input.paidAt)} ${input.payment === "CASH_PAID" ? "bar" : "per Überweisung"} erhalten. Die Rechnung ist bezahlt.`;
  const notice =
    "Es wird gemäß §19 Abs. 1 Umsatzsteuergesetz keine Umsatzsteuer erhoben. Die aufgeführten Dienstleistungen haben Sie gemäß unserer AGB erhalten. Das Leistungsdatum ist oben angegeben.";
  for (const text of [payment, notice]) {
    const height = wrap(text, font, 10, 499).length * 14 + 20;
    ensure(height);
    y += block(text, 48, y, 499, 10, 14) + 20;
  }
  footer();
  if (number === "VORSCHAU") {
    for (const p of doc.getPages())
      p.drawText("VORSCHAU - keine ausgestellte Rechnung", {
        x: 48,
        y: 102,
        size: 9,
        font: bold,
        color: rgb(0.65, 0.12, 0.12),
      });
  }
  return doc.save();
}
