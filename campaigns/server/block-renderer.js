/**
 * Campaign Block Renderer
 *
 * Converts an array of content blocks into email-safe inline-styled HTML.
 * Supports 7 block types mirroring the Python framework's campaign editor.
 */

/**
 * Render an array of content blocks to HTML.
 *
 * @param {Array} blocks - Array of block objects
 * @param {object} variables - Key-value map for {{VAR}} substitution
 * @param {object} style - Email style overrides { primary, headerBg, headerText, accent }
 * @returns {string} Rendered HTML fragment (no wrapper)
 */
function renderBlocks(blocks, variables = {}, style = {}) {
  if (!blocks || !Array.isArray(blocks)) return "";

  const colours = {
    primary: style.primary || "#3b82f6",
    headerBg: style.headerBg || "#1f2937",
    headerText: style.headerText || "#ffffff",
    text: style.text || "#333333",
    textSecondary: style.textSecondary || "#6b7280",
    accent: style.accent || "#f59e0b",
    cardBg: style.cardBg || "#ffffff",
    highlightBg: style.highlightBg || "#f3f4f6",
    border: style.border || "#e5e5e5",
  };

  const parts = blocks.map((block) => renderBlock(block, variables, colours));
  return parts.join("\n");
}

/**
 * Render a single block.
 */
function renderBlock(block, variables, colours) {
  const type = block.type || "paragraph";

  switch (type) {
    case "heading":
      return renderHeading(block, variables, colours);
    case "paragraph":
      return renderParagraph(block, variables, colours);
    case "image":
      return renderImage(block, variables);
    case "code_box":
      return renderCodeBox(block, variables, colours);
    case "button":
      return renderButton(block, variables, colours);
    case "note":
      return renderNote(block, variables);
    case "divider":
      return renderDivider(colours);
    default:
      console.warn(`[Campaigns] Unknown block type: ${type}`);
      return "";
  }
}

function renderHeading(block, variables, colours) {
  const text = substituteVars(block.text || "", variables);
  const subtitle = block.subtitle
    ? substituteVars(block.subtitle, variables)
    : "";

  let html = `<div style="background:${colours.headerBg}; color:${colours.headerText}; padding:24px 32px; text-align:center;">`;
  html += `<h2 style="margin:0; font-size:22px; font-weight:600; color:${colours.headerText};">${text}</h2>`;
  if (subtitle) {
    html += `<p style="margin:8px 0 0 0; font-size:14px; color:${colours.headerText}; opacity:0.85;">${subtitle}</p>`;
  }
  html += `</div>`;
  return html;
}

function renderParagraph(block, variables, colours) {
  let content = substituteVars(block.content || "", variables);
  content = parseInlineMarkdown(content);
  return `<p style="margin:16px 0; color:${colours.text}; font-size:15px; line-height:1.7;">${content}</p>`;
}

function renderImage(block, variables) {
  const url = substituteVars(block.url || "", variables);
  const alt = substituteVars(block.alt || "", variables);
  const borderColour = block.border_color || "transparent";
  const linkUrl = block.link_url
    ? substituteVars(block.link_url, variables)
    : null;

  const imgStyle = `max-width:100%; width:280px; border-radius:6px; border:2px solid ${borderColour}; display:block; margin:0 auto;`;
  const imgTag = `<img src="${url}" alt="${escapeHtml(alt)}" style="${imgStyle}" />`;

  if (linkUrl) {
    return `<div style="text-align:center; margin:20px 0;"><a href="${linkUrl}" target="_blank">${imgTag}</a></div>`;
  }
  return `<div style="text-align:center; margin:20px 0;">${imgTag}</div>`;
}

function renderCodeBox(block, variables, colours) {
  const label = substituteVars(block.label || "", variables);
  const code = substituteVars(block.code || "", variables);

  return `<div style="background:${colours.highlightBg}; border:1px solid ${colours.border}; border-radius:8px; padding:20px; text-align:center; margin:20px 0;">
    <p style="margin:0 0 8px 0; font-size:12px; text-transform:uppercase; letter-spacing:1px; color:${colours.textSecondary};">${escapeHtml(label)}</p>
    <p style="margin:0; font-size:24px; font-weight:700; font-family:'Courier New',monospace; color:${colours.accent}; letter-spacing:2px;">${escapeHtml(code)}</p>
  </div>`;
}

function renderButton(block, variables, colours) {
  const text = substituteVars(block.text || "Click here", variables);
  const url = substituteVars(block.url || "#", variables);
  const bgColour = block.bg_color || colours.primary;
  const textColour = block.text_color || "#ffffff";
  const borderColour = block.border_color || bgColour;

  // Table-based centering for maximum email client compatibility
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px auto;">
    <tr>
      <td style="border-radius:6px; background:${bgColour}; border:2px solid ${borderColour};">
        <a href="${url}" target="_blank" style="display:inline-block; padding:12px 28px; font-size:15px; font-weight:600; color:${textColour}; text-decoration:none; border-radius:6px;">${escapeHtml(text)}</a>
      </td>
    </tr>
  </table>`;
}

function renderNote(block, variables) {
  const text = substituteVars(block.text || "", variables);
  const colour = block.color || "#6b7280";

  return `<div style="border-left:3px solid ${colour}; padding:8px 16px; margin:20px 0;">
    <p style="margin:0; font-size:13px; color:${colour}; line-height:1.6;">${parseInlineMarkdown(text)}</p>
  </div>`;
}

function renderDivider(colours) {
  return `<hr style="border:none; border-top:1px solid ${colours.border}; margin:24px 0;" />`;
}

/**
 * Replace {{VAR_NAME}} placeholders with values.
 */
function substituteVars(text, variables) {
  if (!text) return "";
  return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables[varName] !== undefined ? variables[varName] : match;
  });
}

/**
 * Convert **bold** and *italic* markdown to HTML tags.
 */
function parseInlineMarkdown(text) {
  if (!text) return "";
  // Bold first (greedy), then italic
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
  return text;
}

/**
 * Escape HTML entities.
 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = { renderBlocks, substituteVars };
