import {
  DEFAULT_EXAM_PAPER_THEME,
  ensureVariantBlocks,
  type ExamBlockStyle,
  type ExamMetadata,
  type ExamPaperBlock,
  type ExamPaperTheme,
  type MixedExamQuestion,
  type MixedExamVariant,
} from '@/lib/examMixer';
import {
  escapeHtml,
  isSafeImageDataUrl,
  plainTextToHtml,
  sanitizeExamHtml,
} from '@/lib/examRichText';

function blockStyleToCss(style?: ExamBlockStyle): string {
  if (!style) return '';
  const parts: string[] = [];
  if (style.textAlign) parts.push(`text-align:${style.textAlign}`);
  if (style.color) parts.push(`color:${style.color}`);
  if (style.backgroundColor && style.backgroundColor !== 'transparent') {
    parts.push(`background-color:${style.backgroundColor};padding:6pt 8pt;border-radius:4pt`);
  }
  if (style.fontSizePt) parts.push(`font-size:${style.fontSizePt}pt`);
  return parts.join(';');
}

function renderOptionsHtml(
  question: MixedExamQuestion,
  showAnswers: boolean,
  theme: ExamPaperTheme
): string {
  const maxLen = Math.max(...question.options.map((o) => o.text.length), 0);
  const cols =
    theme.optionColumns === 'auto'
      ? maxLen <= 38 && question.options.length <= 4
        ? 2
        : 1
      : theme.optionColumns;

  if (cols === 4 && question.options.length <= 4) {
    const cells = question.options.map((opt) => {
      const style =
        showAnswers && opt.isCorrect ? 'font-weight:bold;text-decoration:underline;' : '';
      const optHtml = sanitizeExamHtml(opt.textHtml ?? plainTextToHtml(opt.text));
      return `<td style="width:25%;padding:2pt 6pt 2pt 0;vertical-align:top;${style}"><strong>${opt.letter}.</strong> ${optHtml}</td>`;
    });
    return `<table style="width:100%;border-collapse:collapse;margin:3pt 0 8pt 12pt;"><tr>${cells.join('')}</tr></table>`;
  }

  if (cols === 2) {
    const rows: string[] = [];
    for (let i = 0; i < question.options.length; i += 2) {
      const left = question.options[i];
      const right = question.options[i + 1];
      const leftStyle =
        showAnswers && left.isCorrect ? 'font-weight:bold;text-decoration:underline;' : '';
      const rightStyle =
        right && showAnswers && right.isCorrect ? 'font-weight:bold;text-decoration:underline;' : '';
      const leftHtml = sanitizeExamHtml(left.textHtml ?? plainTextToHtml(left.text));
      const rightHtml = right
        ? sanitizeExamHtml(right.textHtml ?? plainTextToHtml(right.text))
        : '';

      rows.push(`
        <tr>
          <td style="width:50%;padding:2pt 8pt 2pt 0;vertical-align:top;${leftStyle}">
            <strong>${left.letter}.</strong> ${leftHtml}
          </td>
          <td style="width:50%;padding:2pt 0;vertical-align:top;${rightStyle}">
            ${right ? `<strong>${right.letter}.</strong> ${rightHtml}` : ''}
          </td>
        </tr>
      `);
    }
    return `<table style="width:100%;border-collapse:collapse;margin:3pt 0 8pt 12pt;">${rows.join('')}</table>`;
  }

  const lines = question.options.map((opt) => {
    const style =
      showAnswers && opt.isCorrect ? 'font-weight:bold;text-decoration:underline;' : '';
    const optHtml = sanitizeExamHtml(opt.textHtml ?? plainTextToHtml(opt.text));
    return `<div style="margin:2pt 0 2pt 14pt;${style}"><strong>${opt.letter}.</strong> ${optHtml}</div>`;
  });
  return `<div style="margin-bottom:8pt;">${lines.join('')}</div>`;
}

function renderPaperBlockHtml(
  block: ExamPaperBlock,
  variantCode: string,
  showAnswers: boolean,
  theme: ExamPaperTheme
): string {
  const wrapperCss = blockStyleToCss(block.style);
  const accent = theme.accentColor || '#000000';

  if (block.type === 'header') {
    const school = sanitizeExamHtml(block.schoolHtml);
    const dept = sanitizeExamHtml(block.departmentHtml);
    const title = sanitizeExamHtml(block.examTitleHtml);
    const subject = sanitizeExamHtml(block.subjectHtml);
    const duration = sanitizeExamHtml(block.durationHtml);

    return `
      <table style="width:100%;border-collapse:collapse;margin-bottom:10pt;${wrapperCss}">
        <tr>
          <td style="width:48%;text-align:center;vertical-align:top;">
            <div style="font-weight:bold;font-size:11pt;text-transform:uppercase;color:${escapeHtml(accent)};">${school}</div>
            ${dept ? `<div style="font-weight:bold;font-size:11pt;text-transform:uppercase;margin-top:2pt;">${dept}</div>` : ''}
            <div style="margin-top:4pt;">----------------</div>
          </td>
          <td style="width:52%;text-align:center;vertical-align:top;">
            <div style="font-weight:bold;font-size:12pt;text-transform:uppercase;color:${escapeHtml(accent)};">${title}</div>
            ${subject ? `<div style="font-weight:bold;font-size:11.5pt;margin-top:3pt;">${subject}</div>` : ''}
            ${duration ? `<div style="font-size:11pt;margin-top:2pt;">${duration}</div>` : ''}
          </td>
        </tr>
      </table>
    `;
  }

  if (block.type === 'student_info') {
    const studentLine = sanitizeExamHtml(block.studentLineHtml);
    const notes = sanitizeExamHtml(block.notesHtml);
    const radius =
      theme.codeBoxStyle === 'rounded' || theme.codeBoxStyle === 'filled' ? '6pt' : '0';
    const boxBg = theme.codeBoxStyle === 'filled' ? '#f1f5f9' : 'transparent';

    return `
      <div style="margin-bottom:10pt;break-inside:avoid;page-break-inside:avoid;${wrapperCss}">
        <table style="width:100%;border-collapse:collapse;margin-bottom:6pt;">
          <tr>
            <td style="vertical-align:middle;font-size:11.5pt;">${studentLine}</td>
            <td style="width:118pt;text-align:center;vertical-align:middle;">
              <div style="border:1.5pt solid ${escapeHtml(accent)};border-radius:${radius};background:${boxBg};padding:6pt 10pt;font-weight:bold;font-size:12pt;color:${escapeHtml(accent)};">
                ${escapeHtml(block.codeLabelPrefix || 'MÃ ĐỀ:')} ${escapeHtml(variantCode)}
              </div>
            </td>
          </tr>
        </table>
        ${
          notes
            ? `<div style="font-size:10.5pt;border-bottom:0.75pt solid #000;padding-bottom:6pt;">${notes}</div>`
            : `<div style="border-bottom:0.75pt solid #000;"></div>`
        }
      </div>
    `;
  }

  if (block.type === 'section_text') {
    const content = sanitizeExamHtml(block.contentHtml);
    const imgHtml = isSafeImageDataUrl(block.imageUrl)
      ? `<div style="margin-top:6pt;text-align:center;"><img src="${block.imageUrl}" alt="Minh họa" style="max-width:420pt;max-height:240pt;height:auto;" /></div>`
      : '';
    return `
      <div style="margin:10pt 0 8pt 0;page-break-inside:avoid;${wrapperCss}">
        <div>${content}</div>
        ${imgHtml}
      </div>
    `;
  }

  if (block.type === 'question') {
    const q = block.question;
    const promptHtml = sanitizeExamHtml(q.promptHtml ?? plainTextToHtml(q.prompt));
    const imgHtml = isSafeImageDataUrl(q.imageUrl)
      ? `<div style="margin:4pt 0 6pt 12pt;"><img src="${q.imageUrl}" alt="Hình câu ${q.number}" style="max-width:380pt;max-height:220pt;height:auto;" /></div>`
      : '';

    return `
      <table style="width:100%;border-collapse:collapse;margin-bottom:6pt;page-break-inside:avoid;${wrapperCss}">
        <tr style="page-break-inside:avoid;">
          <td style="padding:0;vertical-align:top;">
            <div style="margin-bottom:2pt;">
              <strong style="color:${escapeHtml(accent)};">Câu ${q.number}:</strong> ${promptHtml}
            </div>
            ${imgHtml}
            ${renderOptionsHtml(q, showAnswers, theme)}
          </td>
        </tr>
      </table>
    `;
  }

  if (block.type === 'score_box') {
    const c1 = sanitizeExamHtml(block.scoreNumHtml);
    const c2 = sanitizeExamHtml(block.scoreTextHtml);
    const c3 = sanitizeExamHtml(block.examiner1Html);
    const c4 = sanitizeExamHtml(block.examiner2Html);
    const c5 = sanitizeExamHtml(block.codeSlotHtml);
    const cols = block.showCodeSlot ? [c1, c2, c3, c4, c5] : [c1, c2, c3, c4];
    const widthPct = Math.floor(100 / cols.length);
    const headerCells = cols
      .map(
        (html) =>
          `<th style="border:1pt solid #000;padding:4pt 6pt;text-align:center;font-weight:bold;width:${widthPct}%;">${html}</th>`
      )
      .join('');
    const emptyCells = cols
      .map(() => `<td style="border:1pt solid #000;height:46pt;vertical-align:top;">&nbsp;</td>`)
      .join('');

    return `
      <div style="margin:8pt 0 10pt 0;page-break-inside:avoid;${wrapperCss}">
        <table style="width:100%;border-collapse:collapse;font-size:10.5pt;">
          <thead><tr>${headerCells}</tr></thead>
          <tbody><tr>${emptyCells}</tr></tbody>
        </table>
      </div>
    `;
  }

  if (block.type === 'essay_section') {
    const titleHtml = sanitizeExamHtml(block.titleHtml);
    const noteHtml = block.showNote && block.noteHtml ? sanitizeExamHtml(block.noteHtml) : '';
    const itemsHtml = block.items
      .map((item) => {
        const promptHtml = sanitizeExamHtml(item.promptHtml);
        const imgHtml = isSafeImageDataUrl(item.imageUrl)
          ? `<div style="margin:4pt 0 6pt 12pt;"><img src="${item.imageUrl}" alt="Minh họa tự luận" style="max-width:380pt;max-height:220pt;height:auto;" /></div>`
          : '';
        const count = Math.max(0, Math.min(30, item.lineCount ?? 0));
        const linesHtml =
          count > 0
            ? Array.from(
                { length: count },
                () =>
                  `<div style="border-bottom:1pt dotted #555;height:20pt;margin-bottom:2pt;">&nbsp;</div>`
              ).join('')
            : '';
        return `
          <div style="margin-top:8pt;margin-bottom:10pt;page-break-inside:avoid;">
            <div style="margin-bottom:4pt;">${promptHtml}</div>
            ${imgHtml}
            ${linesHtml}
          </div>
        `;
      })
      .join('');

    return `
      <div style="margin:12pt 0 12pt 0;${wrapperCss}">
        ${titleHtml ? `<div style="margin-bottom:4pt;">${titleHtml}</div>` : ''}
        ${noteHtml ? `<div style="margin-bottom:6pt;font-size:10.5pt;">${noteHtml}</div>` : ''}
        ${itemsHtml}
      </div>
    `;
  }

  if (block.type === 'essay_lines') {
    const titleHtml = sanitizeExamHtml(block.titleHtml);
    const count = Math.max(1, Math.min(30, block.lineCount || 8));
    const linesHtml = Array.from(
      { length: count },
      () => `<div style="border-bottom:1pt dotted #555;height:20pt;margin-bottom:2pt;">&nbsp;</div>`
    ).join('');

    return `
      <div style="margin:10pt 0 12pt 0;${wrapperCss}">
        ${titleHtml ? `<div style="margin-bottom:4pt;font-weight:bold;">${titleHtml}</div>` : ''}
        ${linesHtml}
      </div>
    `;
  }

  // footer
  const endHtml = sanitizeExamHtml(block.endTextHtml);
  const leftRole = sanitizeExamHtml(block.leftRoleHtml);
  const rightRole = sanitizeExamHtml(block.rightRoleHtml);
  return `
    <table style="width:100%;border-collapse:collapse;margin-top:12pt;page-break-inside:avoid;${wrapperCss}">
      <tr style="page-break-inside:avoid;">
        <td style="padding:0;vertical-align:top;">
          ${endHtml ? `<div style="text-align:center;margin-bottom:12pt;">${endHtml}</div>` : ''}
          ${
            block.showSignatures
              ? `<table style="width:100%;border-collapse:collapse;margin-top:8pt;">
                  <tr>
                    <td style="width:50%;text-align:center;vertical-align:top;padding-bottom:44pt;">${leftRole}</td>
                    <td style="width:50%;text-align:center;vertical-align:top;padding-bottom:44pt;">${rightRole}</td>
                  </tr>
                </table>`
              : ''
          }
        </td>
      </tr>
    </table>
  `;
}

const WORD_ONLY_PAGE_BREAK_HTML =
  '<!--[if gte mso 9]><br clear="all" style="page-break-before:always;mso-special-character:line-break;" /><![endif]-->';

export function distributeCopiesEvenly(
  codes: readonly string[],
  totalCopies: number
): Record<string, number> {
  const result: Record<string, number> = {};
  if (codes.length === 0) return result;
  const safeTotal = Math.max(0, Math.min(2000, Math.floor(totalCopies)));
  const base = Math.floor(safeTotal / codes.length);
  const remainder = safeTotal % codes.length;
  codes.forEach((code, idx) => {
    result[code] = base + (idx < remainder ? 1 : 0);
  });
  return result;
}

function renderSingleVariantHtml(
  metadata: ExamMetadata,
  variant: MixedExamVariant,
  showAnswers: boolean,
  pageBreakBefore: boolean,
  theme: ExamPaperTheme
): string {
  const blocks = ensureVariantBlocks(variant, metadata);
  const contentHtml = blocks
    .map((blk) => renderPaperBlockHtml(blk, variant.code, showAnswers, theme))
    .join('');

  return `
    ${pageBreakBefore ? WORD_ONLY_PAGE_BREAK_HTML : ''}
    <div class="exam-sheet${pageBreakBefore ? ' exam-sheet-break' : ''}">
      ${contentHtml}
    </div>
  `;
}

function renderAnswerKeyMatrixHtml(
  metadata: ExamMetadata,
  variants: MixedExamVariant[],
  pageBreakBefore: boolean
): string {
  const maxQuestions = Math.max(...variants.map((v) => v.questions.length), 0);
  const headerCells = variants
    .map(
      (v) =>
        `<th style="border:1pt solid #000;padding:4pt 6pt;background:#f1f5f9;font-weight:bold;">Mã ${escapeHtml(v.code)}</th>`
    )
    .join('');

  const bodyRows: string[] = [];
  for (let qNum = 1; qNum <= maxQuestions; qNum += 1) {
    const cells = variants
      .map(
        (v) =>
          `<td style="border:1pt solid #000;padding:3pt 6pt;text-align:center;font-weight:bold;">${escapeHtml(
            v.answerKey[qNum] ?? ''
          )}</td>`
      )
      .join('');
    bodyRows.push(`
      <tr>
        <td style="border:1pt solid #000;padding:3pt 6pt;text-align:center;">Câu ${qNum}</td>
        ${cells}
      </tr>
    `);
  }

  return `
    ${pageBreakBefore ? WORD_ONLY_PAGE_BREAK_HTML : ''}
    <div class="exam-sheet${pageBreakBefore ? ' exam-sheet-break' : ''}">
      <div style="text-align:center;margin-bottom:12pt;">
        <div style="font-weight:bold;font-size:12pt;text-transform:uppercase;">
          ${escapeHtml(metadata.schoolName || 'TRƯỜNG CAO ĐẲNG VIỆT MỸ HÀ NỘI')}
        </div>
        <div style="font-weight:bold;font-size:13pt;text-transform:uppercase;margin-top:4pt;">
          BẢNG ĐÁP ÁN TỔNG HỢP
        </div>
        ${
          metadata.subject
            ? `<div style="font-size:11.5pt;margin-top:3pt;">Môn: <strong>${escapeHtml(metadata.subject)}</strong></div>`
            : ''
        }
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11pt;">
        <thead>
          <tr>
            <th style="border:1pt solid #000;padding:4pt 6pt;background:#f1f5f9;width:70pt;">Câu</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>${bodyRows.join('')}</tbody>
      </table>
    </div>
  `;
}

export function buildExamPrintHtml(
  metadata: ExamMetadata,
  variants: MixedExamVariant[],
  options: {
    showAnswersInExam?: boolean;
    includeAnswerKeyPage?: boolean;
    answerKeyOnly?: boolean;
    theme?: ExamPaperTheme;
    copiesByCode?: Record<string, number>;
  } = {}
): string {
  const {
    showAnswersInExam = false,
    includeAnswerKeyPage = true,
    answerKeyOnly = false,
    theme = DEFAULT_EXAM_PAPER_THEME,
    copiesByCode,
  } = options;

  let bodyHtml = '';
  if (answerKeyOnly) {
    bodyHtml = renderAnswerKeyMatrixHtml(metadata, variants, false);
  } else {
    const expanded: MixedExamVariant[] = [];
    const includedUnique: MixedExamVariant[] = [];
    for (const variant of variants) {
      const count = copiesByCode
        ? Math.max(0, Math.min(200, Math.floor(copiesByCode[variant.code] ?? 0)))
        : 1;
      if (count > 0) {
        includedUnique.push(variant);
        for (let c = 0; c < count; c += 1) {
          expanded.push(variant);
        }
      }
    }

    bodyHtml = expanded
      .map((variant, idx) =>
        renderSingleVariantHtml(metadata, variant, showAnswersInExam, idx > 0, theme)
      )
      .join('');
    if (includeAnswerKeyPage && includedUnique.length > 0) {
      bodyHtml += renderAnswerKeyMatrixHtml(metadata, includedUnique, expanded.length > 0);
    }
  }

  const fontStack =
    theme.fontFamily === 'Times New Roman'
      ? '"Times New Roman", Times, serif'
      : theme.fontFamily === 'Georgia'
        ? 'Georgia, "Times New Roman", serif'
        : `"${theme.fontFamily}", Arial, sans-serif`;

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="vi">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(metadata.examTitle || 'Đề thi trắc nghiệm')}</title>
  <style>
    @page {
      size: A4;
      margin: 1.5cm 1.5cm 1.5cm 2.0cm;
    }
    @page WordSection1 {
      size: 595.3pt 841.9pt;
      margin: 1.5cm 1.5cm 1.5cm 2.0cm;
      mso-header-margin: 1cm;
      mso-footer-margin: 1cm;
    }
    div.WordSection1 {
      page: WordSection1;
    }
    .exam-sheet {
      display: block;
    }
    .exam-sheet-break {
      break-before: page;
      page-break-before: always;
    }
    body {
      font-family: ${fontStack};
      font-size: ${theme.baseFontSizePt || 12.5}pt;
      line-height: ${theme.lineHeight || 1.4};
      color: #000;
      margin: 0;
      padding: 0;
    }
    p {
      margin: 0;
    }
    table {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="WordSection1">
    ${bodyHtml}
  </div>
</body>
</html>`;
}

function buildSafeFileSlug(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'de-thi-trac-nghiem';
}

export function downloadExamsAsWord(
  metadata: ExamMetadata,
  variants: MixedExamVariant[],
  options: {
    showAnswersInExam?: boolean;
    includeAnswerKeyPage?: boolean;
    answerKeyOnly?: boolean;
    fileSuffix?: string;
    theme?: ExamPaperTheme;
    copiesByCode?: Record<string, number>;
  } = {}
): void {
  if (variants.length === 0) return;
  const html = buildExamPrintHtml(metadata, variants, options);
  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const slug = buildSafeFileSlug(metadata.subject || metadata.examTitle);
  const suffix = options.fileSuffix
    ? `-${options.fileSuffix}`
    : options.answerKeyOnly
      ? '-bang-dap-an'
      : variants.length === 1
        ? `-ma-${variants[0].code}`
        : `-${variants.length}-ma-de`;

  link.href = url;
  link.download = `${slug}${suffix}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printExamsInNewWindow(
  metadata: ExamMetadata,
  variants: MixedExamVariant[],
  options: {
    showAnswersInExam?: boolean;
    includeAnswerKeyPage?: boolean;
    answerKeyOnly?: boolean;
    theme?: ExamPaperTheme;
    copiesByCode?: Record<string, number>;
  } = {}
): boolean {
  if (variants.length === 0) return false;
  const html = buildExamPrintHtml(metadata, variants, options);
  const printWin = window.open('', '_blank', 'width=960,height=780');
  if (!printWin) return false;
  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
  printWin.focus();
  window.setTimeout(() => {
    printWin.print();
  }, 250);
  return true;
}
