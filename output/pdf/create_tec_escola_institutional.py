from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image, KeepTogether
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "pdf" / "tec-escola-apresentacao-institucional.pdf"
LOGO = ROOT / "public" / "media" / "tec-escola-favicon.png"

PAGE_W, PAGE_H = landscape(A4)
NAVY = colors.HexColor("#08286d")
BLUE = colors.HexColor("#116ee8")
CYAN = colors.HexColor("#31c6d9")
MINT = colors.HexColor("#a9eee4")
INK = colors.HexColor("#172b55")
MUTED = colors.HexColor("#5e7199")
PALE = colors.HexColor("#eef8fc")
WHITE = colors.white

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverTitle", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=32, leading=35, textColor=WHITE, spaceAfter=10))
styles.add(ParagraphStyle(name="CoverSub", parent=styles["BodyText"], fontName="Helvetica", fontSize=15, leading=21, textColor=colors.HexColor("#dcecff")))
styles.add(ParagraphStyle(name="Kicker", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=BLUE, spaceAfter=7))
styles.add(ParagraphStyle(name="H1x", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=25, leading=29, textColor=NAVY, spaceAfter=9))
styles.add(ParagraphStyle(name="H2x", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=14, leading=17, textColor=NAVY, spaceAfter=5))
styles.add(ParagraphStyle(name="Bodyx", parent=styles["BodyText"], fontName="Helvetica", fontSize=11, leading=16, textColor=INK, spaceAfter=6))
styles.add(ParagraphStyle(name="Smallx", parent=styles["BodyText"], fontName="Helvetica", fontSize=9, leading=12, textColor=MUTED))
styles.add(ParagraphStyle(name="CardTitle", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=NAVY, spaceAfter=5))
styles.add(ParagraphStyle(name="CardBody", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.5, leading=13, textColor=INK))
styles.add(ParagraphStyle(name="Quote", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=18, leading=23, textColor=NAVY, alignment=TA_CENTER))

def P(text, style="Bodyx"):
    return Paragraph(text, styles[style])

def card(title, body, accent=BLUE, width=78*mm, height=42*mm):
    t = Table([[P(title, "CardTitle")], [P(body, "CardBody")]], colWidths=[width], rowHeights=[None, height-12*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), WHITE),
        ("BOX", (0,0), (-1,-1), 0.7, colors.HexColor("#d8e7f5")),
        ("LINEBEFORE", (0,0), (0,-1), 4, accent),
        ("LEFTPADDING", (0,0), (-1,-1), 9), ("RIGHTPADDING", (0,0), (-1,-1), 9),
        ("TOPPADDING", (0,0), (-1,-1), 8), ("BOTTOMPADDING", (0,0), (-1,-1), 7),
    ]))
    return t

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#d6e8f4")); canvas.setLineWidth(0.5)
    canvas.line(18*mm, 12*mm, PAGE_W-18*mm, 12*mm)
    canvas.setFont("Helvetica", 8); canvas.setFillColor(MUTED)
    canvas.drawString(18*mm, 7*mm, "Tec Escola | Gestão acadêmica conectada")
    canvas.drawRightString(PAGE_W-18*mm, 7*mm, f"{doc.page:02d}")
    canvas.restoreState()

def cover(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY); canvas.rect(0,0,PAGE_W,PAGE_H,fill=1,stroke=0)
    canvas.setFillColor(BLUE); canvas.circle(PAGE_W-10*mm, PAGE_H+3*mm, 76*mm, fill=1, stroke=0)
    canvas.setFillColor(CYAN); canvas.circle(14*mm, -8*mm, 48*mm, fill=1, stroke=0)
    canvas.restoreState()

def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(OUT), pagesize=landscape(A4), leftMargin=18*mm, rightMargin=18*mm, topMargin=17*mm, bottomMargin=17*mm)
    story = []
    # 1. Cover
    story += [Spacer(1, 18*mm), Image(str(LOGO), width=24*mm, height=24*mm), Spacer(1, 8*mm), P("TEC ESCOLA", "CoverTitle"), P("Gestão acadêmica conectada para escolas mais organizadas, sustentáveis e próximas.", "CoverSub"), Spacer(1, 18*mm), P("APRESENTAÇÃO INSTITUCIONAL", "Kicker"), P("Uma experiência integrada para alunos, professores, famílias e secretaria.", "CoverSub"), PageBreak()]
    # 2. Positioning
    story += [P("O que é o Tec Escola", "Kicker"), P("Uma plataforma para simplificar a rotina escolar", "H1x"), P("O Tec Escola é uma plataforma de gestão escolar que reúne informação acadêmica, comunicação e organização em um só ambiente. A proposta é tornar o acompanhamento mais claro para as famílias e os processos mais ágeis para a escola.", "Bodyx"), Spacer(1, 4*mm)]
    row = [[card("Mais clareza", "Informações acadêmicas organizadas para que cada pessoa encontre o que precisa no momento certo.", BLUE), card("Mais agilidade", "Menos retrabalho para professores e secretaria, com processos digitais e comunicação centralizada.", CYAN), card("Mais conexão", "Uma jornada integrada entre escola, alunos e responsáveis, com acesso online e linguagem simples.", NAVY)]]
    t = Table(row, colWidths=[80*mm,80*mm,80*mm], hAlign="LEFT"); t.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"), ("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),5)])); story += [t, Spacer(1, 10*mm), P("A tecnologia entra como apoio à rotina: menos dispersão, mais previsibilidade e uma visão comum da vida escolar.", "Quote"), PageBreak()]
    # 3. Modules
    story += [P("Recursos em um só lugar", "Kicker"), P("Do acompanhamento pedagógico à secretaria", "H1x"), P("O sistema pode ser apresentado por módulos, de acordo com a realidade e as prioridades de cada instituição.", "Bodyx"), Spacer(1, 3*mm)]
    modules = [[card("Aluno e família", "Grade de horários, notas, boletim, frequência, histórico, avisos e comunicados acessíveis online.", BLUE), card("Professor", "Publicação de notas, atividades, instruções, indicações de livros e materiais de apoio.", CYAN), card("Secretaria", "Organização de informações, documentos, históricos escolares e comunicação com as famílias.", NAVY)], [card("Conteúdos e ENEM", "Central de estudos e conteúdos para apoiar a aprendizagem e o acompanhamento pedagógico.", BLUE), card("Comunicação escolar", "Avisos e informações importantes em um canal mais direto, organizado e rastreável.", CYAN), card("Educação inclusiva", "Recursos e materiais que apoiam práticas pedagógicas mais acessíveis e participativas.", NAVY)]]
    mt = Table(modules, colWidths=[80*mm,80*mm,80*mm], rowHeights=[47*mm,47*mm]); mt.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"), ("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),5), ("TOPPADDING",(0,1),(-1,1),7)])); story += [mt, PageBreak()]
    # 4. Journey
    story += [P("Uma experiência para cada público", "Kicker"), P("Cada pessoa acompanha a escola do seu jeito", "H1x"), P("O Tec Escola organiza os pontos de contato da comunidade escolar para que a informação circule com mais segurança e praticidade.", "Bodyx"), Spacer(1, 4*mm)]
    journey = [[P("ALUNO", "Kicker"), P("PROFESSOR", "Kicker"), P("FAMÍLIA", "Kicker"), P("SECRETARIA", "Kicker")], [P("Consulta sua rotina, horários, notas, boletim, atividades e orientações.", "Bodyx"), P("Registra avaliações e compartilha atividades, livros, instruções e conteúdos.", "Bodyx"), P("Acompanha frequência, histórico, boletim, avisos e comunicados.", "Bodyx"), P("Centraliza documentos, informações acadêmicas e comunicação com a comunidade.", "Bodyx")]]
    jt = Table(journey, colWidths=[62*mm]*4, rowHeights=[12*mm, 36*mm]); jt.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),PALE), ("BOX",(0,0),(-1,-1),0.7,colors.HexColor("#cfe4f4")), ("INNERGRID",(0,0),(-1,-1),0.5,colors.HexColor("#d9e9f4")), ("VALIGN",(0,0),(-1,-1),"TOP"), ("LEFTPADDING",(0,0),(-1,-1),10), ("RIGHTPADDING",(0,0),(-1,-1),10), ("TOPPADDING",(0,0),(-1,-1),8)])); story += [jt, Spacer(1, 15*mm), P("Quando todos acessam a mesma informação, a escola ganha tempo para se dedicar ao que realmente importa: ensinar, acompanhar e cuidar.", "Quote"), PageBreak()]
    # 5. TV Escola
    story += [P("Comunicação que aparece", "Kicker"), P("TV Escola: um mural digital para a rotina", "H1x"), P("A TV Escola transforma telas da instituição em um canal vivo de comunicação. A escola pode dividir a tela em diferentes áreas e exibir conteúdos conforme o momento e o público.", "Bodyx"), Spacer(1, 3*mm)]
    tv = [[card("Informação do dia", "Cardápio e lanche da cantina, horários, avisos rápidos e orientações para alunos e famílias.", BLUE), card("Comunicação interna", "Comunicados, eventos, campanhas educativas, liberações de turma e mensagens institucionais.", CYAN)], [card("Mais sustentabilidade", "A comunicação digital ajuda a reduzir impressões e o uso de papel em avisos recorrentes.", NAVY), card("Conteúdo organizado", "Programação de diferentes mensagens em uma mesma tela, com mais visibilidade e consistência.", BLUE)]]
    tvt = Table(tv, colWidths=[122*mm,122*mm], rowHeights=[45*mm,45*mm]); tvt.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"), ("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),6), ("TOPPADDING",(0,1),(-1,1),8)])); story += [tvt, Spacer(1, 11*mm), P("Uma escola mais sustentável também é uma escola que comunica melhor.", "Quote"), PageBreak()]
    # 6. Closing
    story += [Spacer(1, 8*mm), Image(str(LOGO), width=20*mm, height=20*mm), Spacer(1, 7*mm), P("Tec Escola", "H1x"), P("Gestão acadêmica conectada para uma escola mais simples, próxima e preparada.", "Bodyx"), Spacer(1, 8*mm), card("Próximo passo", "Podemos realizar uma apresentação por Meet ou presencialmente para demonstrar os recursos, entender a realidade da instituição e avaliar os melhores caminhos de implantação.", BLUE, width=156*mm, height=43*mm), Spacer(1, 12*mm), P("Vamos conversar sobre a realidade da sua escola?", "Quote"), Spacer(1, 10*mm), P("Tec Escola | Apresentação institucional", "Smallx")]
    doc.build(story, onFirstPage=cover, onLaterPages=footer)

if __name__ == "__main__":
    build()
