import React, { useState } from 'react';
import { Copy, Check, Terminal, Lightbulb, Target, FileText, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export const FormattedMessage = ({ content, isStreaming }) => {
  const [copiedCodeIdx, setCopiedCodeIdx] = useState(null);

  if (!content) {
    return isStreaming ? (
      <span className="inline-block w-2.5 h-4 bg-punch-red animate-pulse" />
    ) : null;
  }

  const copyCode = (codeText, idx) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCodeIdx(idx);
    toast.success('Copied diagram / code!');
    setTimeout(() => setCopiedCodeIdx(null), 2000);
  };

  // Split by fenced code blocks (``` ... ```)
  const segments = content.split(/(```[\s\S]*?```)/g);

  // Helper to render inline markdown (bold, formulas, citations)
  const renderInline = (text) => {
    if (!text) return null;

    // Split by bold (**bold**) and math ($...$)
    const parts = text.split(/(\*\*.*?\*\*|\$.*?\$)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-extrabold text-ink bg-comic-yellow/30 px-1 py-0.5 rounded">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('$') && part.endsWith('$')) {
        return (
          <code key={i} className="font-mono text-xs bg-cream px-1.5 py-0.5 rounded border border-ink/40 text-punch-red font-bold">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return (
    <div className="space-y-3 font-sans text-xs sm:text-sm text-ink leading-relaxed">
      {segments.map((segment, segIdx) => {
        // 1. Code Block / ASCII Diagram
        if (segment.startsWith('```') && segment.endsWith('```')) {
          const lines = segment.slice(3, -3).trim().split('\n');
          const firstLine = lines[0].trim();
          const hasLang = /^[a-zA-Z0-9_-]+$/.test(firstLine);
          const lang = hasLang ? firstLine : 'DIAGRAM';
          const codeBody = (hasLang ? lines.slice(1) : lines).join('\n');

          return (
            <div
              key={segIdx}
              className="my-3 rounded-md border-[2.5px] border-ink bg-[#171510] text-[#70E000] overflow-hidden shadow-[4px_4px_0px_#171510]"
            >
              {/* Terminal Title Bar */}
              <div className="bg-[#242018] px-3 py-1.5 border-b-2 border-ink flex items-center justify-between text-[11px] font-mono text-cream select-none">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-punch-red inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-comic-yellow inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-victory-green inline-block" />
                  <span className="ml-2 font-bold uppercase tracking-wider text-[10px] text-comic-yellow">
                    📊 {lang.toUpperCase()} // VISUAL SCHEMATIC
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => copyCode(codeBody, segIdx)}
                  className="hover:text-comic-yellow flex items-center gap-1 text-[10px] transition-colors"
                >
                  {copiedCodeIdx === segIdx ? (
                    <>
                      <Check className="w-3 h-3 text-victory-green" />
                      <span className="text-victory-green font-bold">COPIED</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>COPY</span>
                    </>
                  )}
                </button>
              </div>

              {/* Code / ASCII Diagram Body */}
              <pre className="p-3.5 overflow-x-auto text-[11px] sm:text-xs font-mono leading-tight tracking-tight whitespace-pre">
                {codeBody}
              </pre>
            </div>
          );
        }

        // 2. Prose / Markdown blocks
        const paragraphs = segment.split(/\n\s*\n/g);

        return paragraphs.map((para, pIdx) => {
          const trimmed = para.trim();
          if (!trimmed) return null;

          // Special Callout: Scoring Tip
          if (trimmed.includes('9-Pointer') || trimmed.includes('Scoring Tip')) {
            return (
              <div
                key={`${segIdx}-${pIdx}`}
                className="my-3 p-3 rounded-md bg-comic-yellow/30 border-2 border-ink border-l-[6px] border-l-punch-red shadow-[3px_3px_0px_#171510]"
              >
                <div className="flex items-center gap-1.5 font-comic text-xs uppercase text-punch-red font-bold mb-1">
                  <Target className="w-4 h-4 text-punch-red" />
                  <span>UNIVERSITY EXAM 9-POINTER HACK</span>
                </div>
                <div className="text-xs sm:text-sm font-medium text-ink">
                  {renderInline(trimmed.replace(/^.*Scoring Tip[:\*]*/i, '').trim())}
                </div>
              </div>
            );
          }

          // Special Callout: Intuitive Summary
          if (trimmed.includes('Intuitive Summary') || trimmed.includes('In Plain Words')) {
            return (
              <div
                key={`${segIdx}-${pIdx}`}
                className="my-3 p-3 rounded-md bg-cream border-2 border-ink border-l-[6px] border-l-victory-green shadow-[3px_3px_0px_#171510]"
              >
                <div className="flex items-center gap-1.5 font-comic text-xs uppercase text-victory-green font-bold mb-1">
                  <Lightbulb className="w-4 h-4 text-victory-green" />
                  <span>INTUITIVE CONCEPT (PLAIN ENGLISH)</span>
                </div>
                <div className="text-xs sm:text-sm font-medium text-ink">
                  {renderInline(trimmed.replace(/^.*(Intuitive Summary|In Plain Words)[:\*]*/i, '').trim())}
                </div>
              </div>
            );
          }

          // Headings
          if (trimmed.startsWith('### ') || trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
            const headingText = trimmed.replace(/^#+\s*/, '');
            return (
              <div key={`${segIdx}-${pIdx}`} className="pt-2 pb-1 border-b-2 border-ink/20">
                <h4 className="font-heading text-sm sm:text-base uppercase tracking-wider text-ink flex items-center gap-1.5 font-black">
                  <span className="text-punch-red">⚡</span>
                  {renderInline(headingText)}
                </h4>
              </div>
            );
          }

          // Bullet List or Step
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || /^\d+\.\s/.test(trimmed)) {
            const listItems = trimmed.split('\n');
            return (
              <div key={`${segIdx}-${pIdx}`} className="space-y-1.5 my-2">
                {listItems.map((item, itemIdx) => {
                  const cleaned = item.replace(/^[-*]\s+|\d+\.\s+/, '').trim();
                  return (
                    <div key={itemIdx} className="flex items-start gap-2">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-punch-red mt-2 flex-shrink-0" />
                      <div className="flex-1">{renderInline(cleaned)}</div>
                    </div>
                  );
                })}
              </div>
            );
          }

          // Normal Paragraph
          return (
            <p key={`${segIdx}-${pIdx}`} className="leading-relaxed">
              {renderInline(trimmed)}
            </p>
          );
        });
      })}

      {isStreaming && (
        <span className="inline-block w-2.5 h-4 ml-1 bg-punch-red animate-pulse align-middle" />
      )}
    </div>
  );
};

export default FormattedMessage;

