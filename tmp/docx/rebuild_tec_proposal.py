from pathlib import Path
import shutil
import zipfile

from docx import Document


SOURCE = Path(r"C:\Users\Weslley\Downloads\In9Mídia\Proposta_Comercial_Sinalizacao_Digital_NeoNews_Editavel.docx")
LOGO = Path(r"C:\Users\Weslley\Downloads\Conteúdo Tec Escola 2\ChatGPT Image 16 de set. de 2026, 15_16_01.png")
OUTPUT = Path(r"C:\Users\Weslley\Documents\Edu\edumanager-pro\output\Tec_Escola_Proposta_Comercial_Editavel.docx")
TEMP_DOCX = OUTPUT.with_suffix(".tmp.docx")


def set_paragraph_text(paragraph, text):
    if paragraph.runs:
        paragraph.runs[0].text = text
        for run in paragraph.runs[1:]:
            run.text = ""
    else:
        paragraph.add_run(text)


def set_cell_paragraph(cell, paragraph_index, text):
    set_paragraph_text(cell.paragraphs[paragraph_index], text)


def set_cell_title_and_body(cell, title, body):
    set_cell_paragraph(cell, 0, title)
    set_cell_paragraph(cell, 1, body)


doc = Document(SOURCE)

# Free-flowing paragraphs outside tables
paragraph_replacements = {
    5: "[Cidade], [data]",
    7: "A Tec Escola integra a gestão acadêmica, a comunicação e a aprendizagem em uma única plataforma. A solução aproxima direção, secretaria, professores, alunos e famílias, centralizando informações e facilitando a rotina da instituição.",
    10: "A escola pode combinar gestão acadêmica, comunicação institucional e conteúdos informativos, mantendo a rotina organizada e as informações acessíveis em um único ambiente.",
    13: "Sobre a Tec Escola",
    14: "A Tec Escola oferece uma plataforma de gestão acadêmica inteligente, com recursos para organizar a rotina escolar, apoiar a aprendizagem e aproximar toda a comunidade escolar. O projeto pode ser dimensionado de acordo com o perfil da instituição, a quantidade de alunos, os módulos contratados e as integrações necessárias.",
    17: "Abaixo apresentamos a estrutura comercial da solução. Os valores devem ser definidos de acordo com o plano contratado, a quantidade de alunos e turmas, os módulos selecionados e as integrações previstas no projeto.",
    18: "* O investimento da Tec Escola deve ser definido conforme o plano contratado, a quantidade de alunos e os módulos selecionados.",
    19: "** Implantação, suporte e integrações podem ser definidos conforme a necessidade do projeto. A proposta final deve considerar o escopo aprovado pela instituição.",
}
for index, text in paragraph_replacements.items():
    set_paragraph_text(doc.paragraphs[index], text)

# Cover
cover = doc.tables[0].cell(0, 1)
set_cell_paragraph(cover, 2, "Tec Escola\nGestão acadêmica inteligente")

# Product overview
solution = doc.tables[1].cell(0, 1)
set_cell_title_and_body(
    solution,
    "A solução",
    "Gestão acadêmica, comunicação e aprendizagem em uma única plataforma",
)

# How the platform works
steps = [
    ("Secretaria", "Cadastre alunos, turmas e organize a rotina acadêmica."),
    ("Professor", "Disponibilize atividades, notas, frequência e materiais."),
    ("Família", "Acompanhe boletins, avisos, comunicados e frequência."),
    ("Comunicação", "Exiba cardápios, avisos e informações na TV Escola."),
    ("Aprendizagem", "Apoie o estudo com ENEM, idiomas e Educação Inclusiva."),
]
for index, (title, body) in enumerate(steps):
    cell = doc.tables[2].cell(0, index)
    set_cell_paragraph(cell, 1, title)
    set_cell_paragraph(cell, 2, body)

# Main benefits
benefits = [
    ("1  Gestão acadêmica integrada", "Centralize matrículas, turmas, horários, notas e histórico escolar."),
    ("2  Comunicação escolar conectada", "Aproxime direção, secretaria, professores, alunos e famílias."),
    ("3  Menos papel, mais eficiência", "Digitalize avisos, atividades, cardápios e processos da rotina."),
    ("4  Acompanhamento da aprendizagem", "Apoie ENEM, línguas estrangeiras, inclusão e evolução pedagógica."),
]
for row_index, row in enumerate(doc.tables[3].rows):
    for col_index, cell in enumerate(row.cells):
        title, body = benefits[row_index * 2 + col_index]
        set_cell_paragraph(cell, 0, title)
        set_cell_paragraph(cell, 1, body)

# Resources
resources_header = doc.tables[4].cell(0, 1)
set_cell_paragraph(resources_header, 0, "Recursos da Tec Escola\nGestão acadêmica, comunicação e aprendizagem para a rotina da sua instituição")

resources = [
    ("Gestão acadêmica", "Administre matrículas, turmas, horários, frequência, notas e documentos em um só lugar."),
    ("Comunicação com famílias", "Compartilhe avisos, comunicados, boletins e informações importantes com mais agilidade."),
    ("Central de Estudos para o ENEM", "Ofereça temas dos últimos dez anos, redação, simulados e outros módulos de estudo."),
    ("Educação Inclusiva", "Disponibilize exercícios interativos e acompanhe a evolução pedagógica dos estudantes."),
    ("TV Escola", "Exiba cardápios, atividades do dia, avisos e comunicados em um mural digital, reduzindo o uso de papel."),
    ("Línguas estrangeiras", "Atividades de inglês, espanhol e coreano com guia para testar a fluência e aprender uma nova língua."),
    ("Apoio psicológico", "Chat para contato com o psicólogo da instituição mediante autorização dos pais ou responsáveis."),
    ("Integrações e acompanhamento", "Conecte recursos da escola e acompanhe informações importantes para apoiar melhores decisões."),
]
for row_index, row in enumerate(doc.tables[5].rows):
    for col_index, cell in enumerate(row.cells):
        title, body = resources[row_index * 2 + col_index]
        set_cell_paragraph(cell, 0, title)
        set_cell_paragraph(cell, 1, body)

# Investment section
investment_header = doc.tables[6].cell(0, 1)
set_cell_title_and_body(
    investment_header,
    "Investimento",
    "Investimento e condições comerciais da Tec Escola",
)

investment = doc.tables[7]
set_cell_paragraph(investment.cell(1, 0), 0, "Plano Tec Escola contratado *")
set_cell_paragraph(investment.cell(1, 1), 0, "[definir]")
set_cell_paragraph(investment.cell(2, 0), 0, "Quantidade de alunos / turmas **")
set_cell_paragraph(investment.cell(2, 1), 0, "[definir]")
set_cell_paragraph(investment.cell(3, 0), 0, "Implantação e configuração")
set_cell_paragraph(investment.cell(4, 0), 0, "Suporte e acompanhamento da solução")
set_cell_paragraph(investment.cell(5, 0), 0, "Atualizações da plataforma")
set_cell_paragraph(investment.cell(6, 0), 0, "TOTAL DO PLANO")

# Keep financial fields open for each proposal.
for row_index in (1, 2):
    set_cell_paragraph(investment.cell(row_index, 2), 0, "R$ [definir]")
    set_cell_paragraph(investment.cell(row_index, 3), 0, "R$ [definir]")
set_cell_paragraph(investment.cell(6, 3), 0, "R$ [definir]")

# Commercial conditions
conditions = doc.tables[8]
set_cell_paragraph(conditions.cell(0, 0), 0, "• Valores expressos em Reais (R$).")
set_cell_paragraph(conditions.cell(0, 0), 1, "• Forma de pagamento: [definir].")
set_cell_paragraph(conditions.cell(0, 1), 0, "• Validade da proposta: [definir].")
set_cell_paragraph(conditions.cell(0, 1), 1, "• Prazo e escopo de implantação: definidos conforme o projeto aprovado.")

# Footer in all footer variants, including first and even pages.
for section in doc.sections:
    footer_text = "Tec Escola  |  Gestão acadêmica inteligente  |  [Contato comercial]"
    for footer in (section.footer, section.first_page_footer, section.even_page_footer):
        for paragraph in footer.paragraphs:
            if paragraph.text.strip():
                set_paragraph_text(paragraph, footer_text)

doc.save(TEMP_DOCX)

# Replace the original cover logo while preserving the template's drawing size and layout.
with zipfile.ZipFile(TEMP_DOCX, "r") as source_zip, zipfile.ZipFile(OUTPUT, "w", zipfile.ZIP_DEFLATED) as target_zip:
    for item in source_zip.infolist():
        data = LOGO.read_bytes() if item.filename == "word/media/image1.png" else source_zip.read(item.filename)
        target_zip.writestr(item, data)

TEMP_DOCX.unlink()
print(OUTPUT)
