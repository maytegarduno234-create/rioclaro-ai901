"""Genera documentos de muestra FICTICIOS para la demo (facturas e imágenes)."""
import json, random, sys, io
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import fitz  # PyMuPDF

OUT = sys.argv[1]
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONTB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def invoice_pdf(path, vendor, vendor_addr, folio, date, items, tax_rate=0.16, total_override=None, accent=colors.HexColor("#1f4e5f")):
    c = canvas.Canvas(path, pagesize=letter)
    w, h = letter
    c.setFillColor(accent); c.rect(0, h-90, w, 90, fill=1, stroke=0)
    c.setFillColor(colors.white); c.setFont("Helvetica-Bold", 17); c.drawString(40, h-45, vendor)
    c.setFont("Helvetica", 9); c.drawString(40, h-62, vendor_addr)
    c.setFont("Helvetica-Bold", 20); c.drawRightString(w-40, h-45, "FACTURA")
    c.setFillColor(colors.black); c.setFont("Helvetica", 10)
    y = h-120
    c.drawString(40, y, f"Número de factura: {folio}"); c.drawRightString(w-40, y, f"Fecha de emisión: {date}")
    y -= 16; c.drawString(40, y, "Cliente: Distribuidora Río Claro, S.A. de C.V."); c.drawRightString(w-40, y, "Moneda: MXN")
    y -= 16; c.drawString(40, y, "Domicilio: Av. del Cauce 120, Río Claro"); c.drawRightString(w-40, y, "Condiciones: Crédito 30 días")
    y -= 34
    c.setFillColor(colors.HexColor("#eef2f3")); c.rect(40, y-4, w-80, 20, fill=1, stroke=0); c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 9)
    for x, t in [(46,"Cantidad"),(110,"Descripción"),(380,"Precio unitario"),(w-46,"Importe")]:
        (c.drawRightString if t=="Importe" else c.drawString)(x, y+2, t)
    c.setFont("Helvetica", 9); y -= 22; sub = 0
    for qty, desc, price in items:
        amt = qty*price; sub += amt
        c.drawString(46, y, str(qty)); c.drawString(110, y, desc); c.drawString(380, y, f"${price:,.2f}"); c.drawRightString(w-46, y, f"${amt:,.2f}")
        y -= 18
    tax = round(sub*tax_rate, 2); total = total_override if total_override else round(sub+tax, 2)
    y -= 10; c.line(330, y+8, w-40, y+8)
    for label, val, bold in [("Subtotal", sub, False), ("IVA 16%", tax, False), ("Total", total, True)]:
        c.setFont("Helvetica-Bold" if bold else "Helvetica", 11 if bold else 10)
        c.drawString(360, y-6, label); c.drawRightString(w-46, y-6, f"${val:,.2f}"); y -= 20
    c.setFont("Helvetica-Oblique", 8); c.setFillColor(colors.grey)
    c.drawString(40, 40, "Documento de demostración para el piloto AI-901 — datos ficticios, sin validez fiscal.")
    c.save()
    return round(sub,2), tax, total

def photo_from_pdf(pdf_path, jpg_path, angle=-4, blur=0.8, dark=0.9):
    doc = fitz.open(pdf_path); pix = doc[0].get_pixmap(dpi=110)
    img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    bg = Image.new("RGB", (img.width+160, img.height+160), (92, 84, 74))
    bg.paste(img, (80, 80))
    bg = bg.rotate(angle, expand=False, fillcolor=(92,84,74), resample=Image.BICUBIC)
    bg = bg.filter(ImageFilter.GaussianBlur(blur))
    px = bg.load()
    # iluminación irregular
    for yy in range(0, bg.height):
        f = dark + (1-dark)*yy/bg.height
        for xx in range(0, bg.width, 1):
            r,g,b = px[xx,yy]; px[xx,yy] = (int(r*f), int(g*f), int(b*f*0.97))
    bg.save(jpg_path, quality=72)

manifest = {"invoices": [], "images": []}
def add(file, title, expect):
    manifest["invoices"].append({"file": file, "title": title, "expected": expect})

s, t, tot = invoice_pdf(f"{OUT}/factura-lacteos-A10482.pdf", "Lácteos Valle Sereno, S.A. de C.V.", "Carretera a Valle Sereno km 4, Valle Alto · Proveedor PRV-014 (ficticio)", "A-10482", "28/10/2026",
    [(20,"Leche UHT entera 1 L (caja 12)",268.00),(8,"Queso fresco 400 g (caja 10)",575.00),(6,"Yogur natural 1 kg (caja 8)",300.00)])
add("factura-lacteos-A10482.pdf", "Lácteos Valle Sereno · A-10482 (PDF limpio)", "Validación automática")
invoice_pdf(f"{OUT}/factura-granos-GA-7731.pdf", "Comercializadora Granos del Altiplano, S.A. de C.V.", "Parque Industrial Altiplano 55, San Telmo · Proveedor PRV-022 (ficticio)", "GA-7731", "30/10/2026",
    [(30,"Arroz grano largo 1 kg (bulto 20)",431.00),(25,"Frijol negro 900 g (bulto 20)",505.00),(40,"Pasta para sopa 200 g (caja 50)",330.00)], accent=colors.HexColor("#5a4a2f"))
add("factura-granos-GA-7731.pdf", "Granos del Altiplano · GA-7731 (PDF limpio)", "Validación automática")
photo_from_pdf(f"{OUT}/factura-lacteos-A10482.pdf", f"{OUT}/foto-factura-lacteos-A10482.jpg")
add("foto-factura-lacteos-A10482.jpg", "Foto de la factura A-10482 (reenvío desde sucursal)", "Duplicado de folio → revisión")
invoice_pdf(f"{OUT}/factura-empaques-ER-2219.pdf", "Empaques Ríos Unidos, S.A.", "Calle Ribera 9, Las Palmas · Proveedor PRV-047 (ficticio)", "ER-2219", "02/11/2026",
    [(12,"Vaso desechable 10 oz (caja 1,000)",520.00),(10,"Plato desechable 9 in (caja 500)",370.00)], total_override=13980.00, accent=colors.HexColor("#3d5a3a"))
add("factura-empaques-ER-2219.pdf", "Empaques Ríos Unidos · ER-2219", "Total no cuadra → revisión")
invoice_pdf(f"{OUT}/factura-higiene-HT-0915.pdf", "Higiene Total del Golfo, S. de R.L.", "Blvd. Costero 300, Puerto Ámbar · Proveedor PRV-031 (ficticio)", "HT-0915", "03/11/2026",
    [(40,"Cloro 1 L (caja 15)",168.00),(18,"Detergente en polvo 1 kg (caja 10)",352.00),(10,"Jabón líquido 500 ml (caja 12)",420.00)], accent=colors.HexColor("#2f4a6b"))
photo_from_pdf(f"{OUT}/factura-higiene-HT-0915.pdf", f"{OUT}/foto-factura-higiene-HT-0915.jpg", angle=7, blur=1.6, dark=0.7)
import os; os.remove(f"{OUT}/factura-higiene-HT-0915.pdf")
add("foto-factura-higiene-HT-0915.jpg", "Higiene Total · HT-0915 (foto inclinada y oscura)", "Confianza variable")
invoice_pdf(f"{OUT}/factura-solponiente-SP-311.pdf", "Distribuciones Sol Poniente (proveedor no registrado)", "Domicilio no verificado · datos ficticios", "SP-311", "04/11/2026",
    [(15,"Aceite vegetal 1 L (caja 12)",402.00)], accent=colors.HexColor("#6b3a2f"))
add("factura-solponiente-SP-311.pdf", "Sol Poniente · SP-311", "Proveedor no registrado → revisión")

# Imágenes para visión
def label_image(path):
    img = Image.new("RGB", (1000, 700), (232, 226, 214)); d = ImageDraw.Draw(img)
    d.rounded_rectangle((120, 80, 880, 620), 30, fill=(250, 248, 240), outline=(60, 90, 100), width=6)
    f1 = ImageFont.truetype(FONTB, 58); f2 = ImageFont.truetype(FONT, 32); f3 = ImageFont.truetype(FONTB, 34)
    d.text((170, 120), "LECHE UHT ENTERA", font=f1, fill=(31, 78, 95))
    d.text((170, 200), "Contenido: 1 L  ·  Caja con 12 piezas", font=f2, fill=(40,40,40))
    d.text((170, 260), "Lote: LV-2610-118", font=f2, fill=(40,40,40))
    d.text((170, 310), "Caducidad: 12/11/2026", font=f3, fill=(170, 40, 30))
    d.text((170, 370), "SKU interno: LAC-3001", font=f2, fill=(40,40,40))
    d.text((170, 430), "Mantener en lugar fresco y seco", font=f2, fill=(40,40,40))
    d.text((170, 540), "Producto de demostración · marca ficticia", font=ImageFont.truetype(FONT, 22), fill=(120,120,120))
    img = img.rotate(-3, fillcolor=(200,195,185)).filter(ImageFilter.GaussianBlur(0.6)); img.save(path, quality=85)

def shelf_image(path):
    random.seed(4)
    img = Image.new("RGB", (1100, 760), (214, 208, 196)); d = ImageDraw.Draw(img)
    fb = ImageFont.truetype(FONTB, 22); fs = ImageFont.truetype(FONT, 18)
    names = [("ACEITE 1L", (196,150,40)), ("ARROZ 1KG", (230,230,225)), ("FRIJOL NEGRO", (60,40,40)), ("CLORO 1L", (60,120,190)), ("DETERGENTE", (40,140,120)), ("AGUA 600ML", (120,180,220))]
    for row, y in enumerate([60, 300, 540]):
        d.rectangle((30, y+170, 1070, y+190), fill=(110, 80, 50))
        x = 50
        for i in range(6):
            n, col = names[(row*2+i) % len(names)]
            if row == 1 and i in (2,3):
                x += 170; continue  # hueco: desabasto
            d.rectangle((x, y, x+150, y+168), fill=col, outline=(30,30,30), width=3)
            d.text((x+10, y+70), n, font=fb, fill=(255,255,255) if sum(col)<450 else (20,20,20))
            x += 170
        d.text((40, y+192), f"Pasillo 3 · Nivel {row+1}", font=fs, fill=(40,40,40))
    d.text((620, 390), "ESPACIO VACÍO", font=fb, fill=(150, 40, 30))
    img.filter(ImageFilter.GaussianBlur(0.5)).save(path, quality=85)

label_image(f"{OUT}/etiqueta-producto.jpg"); shelf_image(f"{OUT}/producto-anaquel.jpg")
manifest["images"] = [
    {"file": "etiqueta-producto.jpg", "title": "Etiqueta de producto con lote y caducidad"},
    {"file": "producto-anaquel.jpg", "title": "Anaquel con huecos de inventario"},
    {"file": "foto-factura-higiene-HT-0915.jpg", "title": "Factura fotografiada con celular"},
]
json.dump(manifest, open(f"{OUT}/manifest.json", "w"), ensure_ascii=False, indent=2)
print("ok", tot)
