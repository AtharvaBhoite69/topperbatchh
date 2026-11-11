import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api, { documents as docApi } from '../../services/api';
import ComicButton from '../../components/ui/ComicButton';
import {
  ArrowLeft,
  Bot,
  Bookmark,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

const PDFJS_SCRIPT_SRC = '/pdfjs/pdf.min.js';
const PDFJS_WORKER_SRC = '/pdfjs/pdf.worker.min.js';

let pdfJsLoadPromise = null;

/**
 * Dynamically load Mozilla PDF.js (v3.11.174) from same-origin static assets.
 * Compatible with all iOS Safari, macOS Safari, Android, and desktop browsers.
 */
function loadPdfJs() {
  if (window.pdfjsLib) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
    return Promise.resolve(window.pdfjsLib);
  }

  if (pdfJsLoadPromise) return pdfJsLoadPromise;

  pdfJsLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${PDFJS_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
          resolve(window.pdfjsLib);
        } else {
          reject(new Error('PDF.js failed to initialize.'));
        }
      });
      existing.addEventListener('error', () => reject(new Error('Failed to load PDF engine.')));
      return;
    }

    const script = document.createElement('script');
    script.src = PDFJS_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
        resolve(window.pdfjsLib);
      } else {
        reject(new Error('PDF.js failed to initialize.'));
      }
    };
    script.onerror = () => {
      pdfJsLoadPromise = null;
      reject(new Error('Failed to load PDF engine script.'));
    };
    document.head.appendChild(script);
  });

  return pdfJsLoadPromise;
}

/**
 * Single PDF page canvas rendered lazily when near the scroll viewport
 * so multi-page PDFs stay fast and avoid iOS Safari canvas memory limits.
 */
const PdfPageCanvas = ({
  pdfDoc,
  pageNumber,
  containerWidth,
  zoom,
  totalPages,
  user,
  onVisible,
}) => {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);

  const [inView, setInView] = useState(pageNumber <= 3);
  const [rendering, setRendering] = useState(false);
  const [renderedSize, setRenderedSize] = useState({
    width: Math.max(280, Math.floor((containerWidth || 720) * zoom)),
    height: Math.floor(Math.max(280, (containerWidth || 720) * zoom) * 1.414),
  });

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            if (entry.intersectionRatio >= 0.35) {
              onVisible?.(pageNumber);
            }
          } else if (totalPages > 20) {
            // Release off-screen canvas memory on very large PDFs for iOS stability
            const rect = entry.boundingClientRect;
            if (Math.abs(rect.top) > window.innerHeight * 6) {
              setInView(false);
            }
          }
        }
      },
      {
        rootMargin: '900px 0px',
        threshold: [0, 0.35],
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber, totalPages, onVisible]);

  useEffect(() => {
    if (!pdfDoc || !inView) return;

    let cancelled = false;

    const renderPage = async () => {
      setRendering(true);
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        const unscaledViewport = page.getViewport({ scale: 1 });
        const targetCssWidth = Math.max(260, (containerWidth - 32) * zoom);
        const scale = targetCssWidth / unscaledViewport.width;
        const viewport = page.getViewport({ scale });

        // Cap DPR at 2 to stay sharp on iPhone/MacBook Retina without blowing canvas memory
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        const cssWidth = Math.floor(viewport.width);
        const cssHeight = Math.floor(viewport.height);
        setRenderedSize({ width: cssWidth, height: cssHeight });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const ctx = canvas.getContext('2d', { alpha: false });
        canvas.width = Math.floor(cssWidth * dpr);
        canvas.height = Math.floor(cssHeight * dpr);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (_) {}
        }

        const task = page.render({
          canvasContext: ctx,
          viewport,
        });
        renderTaskRef.current = task;
        await task.promise;
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn(`PDF page ${pageNumber} render notice:`, err?.message || err);
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    };

    renderPage();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (_) {}
      }
    };
  }, [pdfDoc, pageNumber, inView, containerWidth, zoom]);

  return (
    <div
      ref={wrapperRef}
      id={`pdf-page-${pageNumber}`}
      className="relative mx-auto bg-white border-2 border-ink shadow-[4px_4px_0px_#171510] overflow-hidden select-none"
      style={{
        width: `${renderedSize.width}px`,
        minHeight: `${renderedSize.height}px`,
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Per-page Dynamic Student Watermark */}
      <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden grid grid-cols-2 gap-12 p-6 opacity-[0.07] select-none">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="transform -rotate-45 font-mono text-[10px] sm:text-xs font-black text-ink whitespace-nowrap self-center justify-self-center"
          >
            {user?.full_name} ({user?.email}) • TOPPERBATCH
          </div>
        ))}
      </div>

      {inView ? (
        <canvas
          ref={canvasRef}
          className="block relative z-10 pointer-events-none"
          onContextMenu={(e) => e.preventDefault()}
        />
      ) : (
        <div
          className="flex items-center justify-center text-xs font-mono text-olive-dark"
          style={{ height: `${renderedSize.height}px` }}
        >
          Page {pageNumber} of {totalPages}
        </div>
      )}

      {rendering && (
        <div className="absolute top-2 right-2 z-30 bg-cream/90 border border-ink px-2 py-0.5 rounded text-[10px] font-mono text-ink flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Pg {pageNumber}</span>
        </div>
      )}

      <div className="bg-ink text-cream font-mono text-[10px] px-2.5 py-1 flex items-center justify-between border-t border-ink relative z-20">
        <span>PAGE {pageNumber}</span>
        <span>
          {pageNumber} / {totalPages}
        </span>
      </div>
    </div>
  );
};

export const PDFViewer = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  // PDF.js state
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState('');
  const [containerWidth, setContainerWidth] = useState(800);

  const scrollContainerRef = useRef(null);

  // Measure scroll viewport width responsively for mobile & desktop fit-to-width
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const updateWidth = () => {
      if (el.clientWidth > 0) {
        setContainerWidth(Math.min(el.clientWidth, 960));
      }
    };

    updateWidth();
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateWidth);
      ro.observe(el);
    }
    window.addEventListener('resize', updateWidth);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [loading]);

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const res = await docApi.get(id);
        if (res.data?.success && res.data?.document) {
          setDoc(res.data.document);
          setIsSaved(res.data.document.is_saved === 1);
        }
      } catch (err) {
        toast.error('Document not accessible or does not exist.');
        navigate('/question-bank');
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
  }, [id, navigate]);

  // Load PDF bytes and parse with PDF.js so ALL pages render cleanly on iOS & macOS
  useEffect(() => {
    if (!doc) return;

    let cancelled = false;
    let loadedDocument = null;

    const loadPdf = async () => {
      setPdfLoading(true);
      setPdfError('');

      try {
        const [pdfjsLib, urlRes] = await Promise.all([
          loadPdfJs(),
          api.get(`/documents/${id}/view`, { params: { format: 'url' } }),
        ]);

        if (cancelled) return;

        let pdfData;
        if (urlRes.data?.isSignedUrl && urlRes.data?.url) {
          const fileResp = await fetch(urlRes.data.url);
          if (!fileResp.ok) {
            throw new Error(`Storage returned HTTP ${fileResp.status}`);
          }
          const buffer = await fileResp.arrayBuffer();
          pdfData = new Uint8Array(buffer);
        } else {
          const streamResp = await api.get(`/documents/${id}/view`, {
            responseType: 'arraybuffer',
          });
          pdfData = new Uint8Array(streamResp.data);
        }

        if (cancelled) return;

        const loadingTask = pdfjsLib.getDocument({
          data: pdfData,
        });

        loadedDocument = await loadingTask.promise;
        if (cancelled) {
          loadedDocument.destroy();
          return;
        }

        setPdfDoc(loadedDocument);
        setNumPages(loadedDocument.numPages || 1);
        setCurrentPage(1);
      } catch (err) {
        if (!cancelled) {
          console.error('PDF load error:', err);
          setPdfError(err?.message || 'Unable to render this PDF.');
        }
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
      if (loadedDocument) {
        try {
          loadedDocument.destroy();
        } catch (_) {}
      }
    };
  }, [doc, id]);

  const handleToggleSave = async () => {
    try {
      if (isSaved) {
        await docApi.unsave(id);
        setIsSaved(false);
        toast.success('Removed from saved items.');
      } else {
        await docApi.save(id);
        setIsSaved(true);
        toast.success('Saved to your vault!');
      }
    } catch (err) {
      toast.error('Could not update saved status.');
    }
  };

  const jumpToPage = useCallback(
    (page) => {
      const clamped = Math.max(1, Math.min(numPages || 1, page));
      setCurrentPage(clamped);
      const target = document.getElementById(`pdf-page-${clamped}`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [numPages]
  );

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <div className="font-comic text-2xl text-ink animate-bounce">
          ⚡ LOADING SECURE DOCUMENT VAULT...
        </div>
      </div>
    );
  }

  if (!doc) return null;

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] space-y-3 select-none">
      {/* Top Controls Bar */}
      <div className="comic-box bg-white p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-2.5 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/question-bank">
            <ComicButton variant="white" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
              BACK
            </ComicButton>
          </Link>
          <div className="text-left min-w-0">
            <h1 className="font-heading text-base sm:text-xl uppercase tracking-wide text-ink truncate max-w-[200px] sm:max-w-md">
              {doc.title}
            </h1>
            <div className="font-mono text-[10px] sm:text-[11px] text-olive-dark truncate">
              {doc.subject_name || 'General'} {doc.unit_name ? `• ${doc.unit_name}` : ''} • Sem {doc.semester_id || 'All'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleSave}
            className={`p-2 rounded border-2 border-ink shadow-[2px_2px_0px_#171510] font-comic text-xs uppercase flex items-center gap-1.5 transition-colors ${
              isSaved ? 'bg-punch-red text-cream' : 'bg-cream text-ink hover:bg-comic-yellow'
            }`}
          >
            <Bookmark className="w-4 h-4 fill-current" />
            <span className="hidden sm:inline">{isSaved ? 'SAVED' : 'BOOKMARK'}</span>
          </button>

          <Link to={`/ai-chat?doc=${doc.id}`}>
            <ComicButton variant="yellow" size="sm" icon={<Bot className="w-4 h-4" />}>
              <span className="hidden sm:inline">ASK AI ABOUT THIS PDF</span>
              <span className="sm:hidden">ASK AI</span>
            </ComicButton>
          </Link>
        </div>
      </div>

      {/* Security Deterrent Notice + Multi-Page Navigation & Zoom Toolbar */}
      <div className="bg-comic-yellow/30 border-2 border-ink px-3 py-1.5 rounded text-[11px] font-mono text-ink flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
        <span className="flex items-center gap-1.5 font-bold truncate">
          <ShieldAlert className="w-3.5 h-3.5 text-punch-red flex-shrink-0" />
          <span className="truncate">VAULT: {user?.email}</span>
        </span>

        {numPages > 0 && (
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            {/* Page Controls */}
            <div className="flex items-center gap-1 bg-white border-2 border-ink rounded px-1.5 py-0.5">
              <button
                type="button"
                onClick={() => jumpToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-0.5 disabled:opacity-30 hover:text-punch-red"
                title="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-bold px-1">
                {currentPage} / {numPages}
              </span>
              <button
                type="button"
                onClick={() => jumpToPage(currentPage + 1)}
                disabled={currentPage >= numPages}
                className="p-0.5 disabled:opacity-30 hover:text-punch-red"
                title="Next Page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-white border-2 border-ink rounded px-1.5 py-0.5">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
                className="p-0.5 hover:text-punch-red"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-bold min-w-[34px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.2, +(z + 0.15).toFixed(2)))}
                className="p-0.5 hover:text-punch-red"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              {zoom !== 1 && (
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  className="p-0.5 hover:text-punch-red border-l border-ink/20 pl-1"
                  title="Reset Zoom"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Scrollable Multi-Page Canvas PDF Container (fixes iPhone / MacBook Safari page-1-only iframe bug) */}
      <div
        ref={scrollContainerRef}
        className="comic-box relative flex-1 bg-olive-dark/15 overflow-y-auto overflow-x-auto p-3 sm:p-6 border-[3px] border-ink shadow-[6px_6px_0px_#171510]"
        style={{ WebkitOverflowScrolling: 'touch' }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {pdfLoading ? (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center gap-3 text-ink">
            <Loader2 className="w-8 h-8 animate-spin text-punch-red" />
            <div className="font-comic text-base sm:text-lg uppercase tracking-wider">
              RENDERING ALL PDF PAGES...
            </div>
            <p className="font-mono text-xs text-olive-dark">
              Preparing mobile & desktop high-res canvas view
            </p>
          </div>
        ) : pdfError ? (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center gap-3 text-center p-4">
            <AlertCircle className="w-10 h-10 text-punch-red" />
            <h3 className="font-heading text-xl uppercase text-ink">COULD NOT DISPLAY PDF</h3>
            <p className="font-sans text-xs text-olive-dark max-w-md">{pdfError}</p>
            <ComicButton variant="yellow" size="sm" onClick={() => window.location.reload()}>
              RETRY LOADING PDF
            </ComicButton>
          </div>
        ) : (
          <div className="space-y-5 pb-8">
            {Array.from({ length: numPages }, (_, idx) => idx + 1).map((pageNum) => (
              <PdfPageCanvas
                key={pageNum}
                pdfDoc={pdfDoc}
                pageNumber={pageNum}
                containerWidth={containerWidth}
                zoom={zoom}
                totalPages={numPages}
                user={user}
                onVisible={setCurrentPage}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFViewer;
