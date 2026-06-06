/**
 * @lozzalingo/email - Shared HTML Email Template Builder
 * Configurable colors, brand name, and layout
 */

function buildBaseStyles(style = {}) {
  const primary = style.primary || '#3b82f6';
  const headerBg = style.headerBg || '#1f2937';

  return `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .container { background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; overflow: hidden; }
    .header { background: ${headerBg}; color: #fff; padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 32px; }
    .content h2 { margin: 0 0 16px 0; font-size: 20px; color: #1f2937; }
    .content p { margin: 16px 0; color: #4b5563; }
    .button { display: inline-block; background: ${primary}; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 16px 0; }
    .footer { background: #f9fafb; padding: 24px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e5e5; }
    .summary { background: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid ${primary}; }
    .summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e5e5; }
    .summary-row:last-child { border-bottom: none; font-weight: 600; padding-top: 12px; }
    .features { background: #f9fafb; padding: 20px; border-radius: 6px; margin: 20px 0; }
    .features ul { margin: 0; padding-left: 20px; }
    .features li { padding: 4px 0; color: #4b5563; }
    .warning { background: #fef3c7; padding: 12px 16px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #f59e0b; }
    .warning p { margin: 0; color: #92400e; font-size: 13px; }
  `;
}

function buildEmailTemplate({ title, body, brandName, style }) {
  return `<!DOCTYPE html>
<html>
<head><style>${buildBaseStyles(style)}</style></head>
<body>
  <div class="container">
    <div class="header"><h1>${title}</h1></div>
    <div class="content">${body}</div>
    <div class="footer"><p>${brandName}</p></div>
  </div>
</body>
</html>`;
}

module.exports = { buildBaseStyles, buildEmailTemplate };
