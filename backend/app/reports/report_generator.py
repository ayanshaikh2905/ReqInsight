import io
import csv
import json
from typing import Dict, Any, List
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable
)


class ReportGenerator:
    """
    Generates professional academic and executive reports for ReqInsight AI:
      - PDF (formatted with ReportLab)
      - JSON
      - CSV
    """

    @staticmethod
    def generate_pdf(analysis_data: Dict[str, Any]) -> bytes:
        """
        Builds a comprehensive PDF report.
        """
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,
            leftMargin=36,
            topMargin=36,
            bottomMargin=36
        )

        styles = getSampleStyleSheet()
        primary_color = colors.HexColor("#312e81")
        secondary_color = colors.HexColor("#4f46e5")
        text_dark = colors.HexColor("#1e293b")
        text_muted = colors.HexColor("#64748b")

        title_style = ParagraphStyle(
            "ReportTitle",
            parent=styles["Heading1"],
            fontSize=22,
            leading=26,
            textColor=primary_color,
            fontName="Helvetica-Bold",
            spaceAfter=6
        )
        subtitle_style = ParagraphStyle(
            "ReportSubtitle",
            parent=styles["Normal"],
            fontSize=11,
            leading=15,
            textColor=secondary_color,
            fontName="Helvetica",
            spaceAfter=14
        )
        heading2_style = ParagraphStyle(
            "SectionHeading",
            parent=styles["Heading2"],
            fontSize=14,
            leading=18,
            textColor=primary_color,
            fontName="Helvetica-Bold",
            spaceBefore=12,
            spaceAfter=6
        )
        body_style = ParagraphStyle(
            "ReportBody",
            parent=styles["Normal"],
            fontSize=9,
            leading=13,
            textColor=text_dark
        )
        bold_cell_style = ParagraphStyle(
            "BoldCell",
            parent=body_style,
            fontName="Helvetica-Bold"
        )

        elements = []

        # 1. Header & Metadata
        elements.append(Paragraph("ReqInsight AI — Software Requirement Analysis Report", title_style))
        elements.append(Paragraph(
            f"<b>Document:</b> {analysis_data.get('document_name', 'SRS Document')} &nbsp;|&nbsp; "
            f"<b>Date:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')} &nbsp;|&nbsp; "
            f"<b>Evaluation Engine:</b> NLP & LLM Academic Pipeline",
            subtitle_style
        ))
        elements.append(HRFlowable(width="100%", thickness=1.5, color=primary_color, spaceAfter=14))

        # 2. Executive Summary Metrics Table
        summary = analysis_data.get("summary", {})
        summary_rows = [
            [
                Paragraph("<b>Total Requirements:</b>", body_style),
                Paragraph(str(summary.get("total_requirements", 0)), bold_cell_style),
                Paragraph("<b>Avg Quality Score:</b>", body_style),
                Paragraph(f"{summary.get('average_quality_score', 0)}/100", bold_cell_style)
            ],
            [
                Paragraph("<b>Functional Requirements:</b>", body_style),
                Paragraph(str(summary.get("functional_count", 0)), body_style),
                Paragraph("<b>Non-Functional:</b>", body_style),
                Paragraph(str(summary.get("non_functional_count", 0)), body_style)
            ],
            [
                Paragraph("<b>Potential Ambiguities:</b>", body_style),
                Paragraph(str(summary.get("ambiguous_count", 0)), body_style),
                Paragraph("<b>Incomplete Requirements:</b>", body_style),
                Paragraph(str(summary.get("incomplete_count", 0)), body_style)
            ],
            [
                Paragraph("<b>Potential Duplicates:</b>", body_style),
                Paragraph(str(summary.get("duplicate_pairs_count", 0)), body_style),
                Paragraph("<b>Detected Conflicts:</b>", body_style),
                Paragraph(str(summary.get("conflict_pairs_count", 0)), body_style)
            ]
        ]
        sum_table = Table(summary_rows, colWidths=[140, 110, 140, 150])
        sum_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(Paragraph("Executive Summary & Statistics", heading2_style))
        elements.append(sum_table)
        elements.append(Spacer(1, 14))

        # 3. Requirement Inventory Table
        elements.append(Paragraph("Requirement Quality & Issue Inventory", heading2_style))
        requirements = analysis_data.get("requirements", [])
        
        req_table_data = [
            [
                Paragraph("<b>ID</b>", bold_cell_style),
                Paragraph("<b>Requirement Statement</b>", bold_cell_style),
                Paragraph("<b>Type</b>", bold_cell_style),
                Paragraph("<b>Score</b>", bold_cell_style),
                Paragraph("<b>Detected Smells / Issues</b>", bold_cell_style)
            ]
        ]

        for req in requirements[:40]:  # limit to 40 in summary table for layout
            smell_labels = [s["smell"] for s in req.get("smells", [])]
            smells_str = ", ".join(smell_labels) if smell_labels else "None (Clean)"

            req_table_data.append([
                Paragraph(req.get("id", ""), bold_cell_style),
                Paragraph(req.get("text", "")[:120] + ("..." if len(req.get("text", "")) > 120 else ""), body_style),
                Paragraph(req.get("type", ""), body_style),
                Paragraph(f"{req.get('quality_score', 0)}", bold_cell_style),
                Paragraph(smells_str, body_style)
            ])

        req_table = Table(req_table_data, colWidths=[55, 230, 80, 45, 130])
        req_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#e0e7ff")),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(req_table)
        elements.append(Spacer(1, 14))

        # 4. Detailed Findings & Recommended Improvements
        elements.append(Paragraph("Actionable Recommendations & Generated Artifacts", heading2_style))
        for req in requirements[:6]:  # Show top key examples
            box_content = [
                [Paragraph(f"<b>{req.get('id')}: {req.get('text')}</b>", bold_cell_style)],
                [Paragraph(f"<b>Improved IEEE 830:</b> {req.get('improved_text')}", body_style)],
                [Paragraph(f"<b>User Story:</b> {req.get('user_story')}", body_style)],
                [Paragraph(f"<b>Acceptance Criteria:</b><br/>{req.get('acceptance_criteria').replace(chr(10), '<br/>')}", body_style)],
                [Paragraph(f"<b>Recommendation:</b> {req.get('recommendation')}", subtitle_style)]
            ]
            t = Table(box_content, colWidths=[540])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
                ('PADDING', (0, 0), (-1, -1), 6),
            ]))
            elements.append(t)
            elements.append(Spacer(1, 8))

        doc.build(elements)
        return buffer.getvalue()

    @staticmethod
    def generate_json(analysis_data: Dict[str, Any]) -> str:
        """Serializes full analysis output to clean JSON."""
        return json.dumps(analysis_data, indent=2)

    @staticmethod
    def generate_csv(analysis_data: Dict[str, Any]) -> str:
        """Exports requirement rows to CSV format."""
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "ID",
            "Statement",
            "Type",
            "Confidence",
            "Quality Score",
            "Clarity",
            "Completeness",
            "Specificity",
            "Consistency",
            "Testability",
            "Uniqueness",
            "Is Ambiguous",
            "Ambiguity Explanation",
            "Is Incomplete",
            "Incompleteness Explanation",
            "Topic",
            "Improved Statement",
            "User Story",
            "Recommendation"
        ])

        for req in analysis_data.get("requirements", []):
            scores = req.get("scores", {})
            writer.writerow([
                req.get("id"),
                req.get("text"),
                req.get("type"),
                req.get("confidence"),
                req.get("quality_score"),
                scores.get("clarity"),
                scores.get("completeness"),
                scores.get("specificity"),
                scores.get("consistency"),
                scores.get("testability"),
                scores.get("uniqueness"),
                req.get("is_ambiguous"),
                req.get("ambiguity_explanation") or "",
                req.get("is_incomplete"),
                req.get("incompleteness_explanation") or "",
                req.get("topic"),
                req.get("improved_text"),
                req.get("user_story"),
                req.get("recommendation")
            ])

        return output.getvalue()
