import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronRight, ChevronLeft, X } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface TourStep {
  /** CSS selector for the element to highlight */
  target: string;
  /** Translation key for the title */
  titleKey: string;
  /** Description text */
  description: string;
  /** Preferred placement of the tooltip */
  placement?: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "[data-tour='sidebar']",
    titleKey: "tour.collectionsSidebar",
    description:
      "This is where all your API collections live. Open a folder, create collections, and organize requests into folders. You can search and drag to reorder.",
    placement: "right",
  },
  {
    target: "[data-tour='environment']",
    titleKey: "tour.environmentSelector",
    description:
      "Switch between environments (dev, staging, prod) here. Each environment has its own variables like base URLs and API keys. Use {{variableName}} in your requests to reference them.",
    placement: "bottom",
  },
  {
    target: "[data-tour='tabs']",
    titleKey: "tour.requestTabs",
    description:
      "Work on multiple requests at once, just like browser tabs. Drag to reorder, and a dot means unsaved changes.",
    placement: "bottom",
  },
  {
    target: "[data-tour='url-bar']",
    titleKey: "tour.urlBar",
    description:
      "Enter your API endpoint here. Pick the HTTP method on the left — GET fetches data, POST creates, PUT/PATCH updates, DELETE removes. Press Ctrl+Enter to send.",
    placement: "bottom",
  },
  {
    target: "[data-tour='tab-params']",
    titleKey: "tour.queryParameters",
    description:
      "Query parameters are key-value pairs appended to the URL (e.g. ?page=1&limit=10). Add them here instead of typing them manually in the URL — it's cleaner and easier to toggle on/off.",
    placement: "bottom",
  },
  {
    target: "[data-tour='tab-headers']",
    titleKey: "tour.requestHeaders",
    description:
      "HTTP headers are metadata sent with your request. Common ones include Content-Type (what format your data is in), Authorization (your credentials), and Accept (what format you want back).",
    placement: "bottom",
  },
  {
    target: "[data-tour='tab-body']",
    titleKey: "tour.requestBody",
    description:
      "The body is the data you send with POST/PUT/PATCH requests. Choose a format — JSON is the most common for APIs. GET and DELETE requests typically don't have a body.",
    placement: "bottom",
  },
  {
    target: "[data-tour='tab-auth']",
    titleKey: "tour.authentication",
    description:
      "Most APIs require authentication. Choose your method — Bearer Token is the most common (paste your token), or use Basic Auth (username/password), API Key, OAuth 2.0, and more.",
    placement: "bottom",
  },
  {
    target: "[data-tour='tab-scripts']",
    titleKey: "tour.scripts",
    description:
      "Write JavaScript that runs before sending (pre-request) or after receiving (post-response). Use scripts to set variables dynamically, chain requests, or transform data.",
    placement: "bottom",
  },
  {
    target: "[data-tour='tab-tests']",
    titleKey: "tour.testsAssertions",
    description:
      "Write tests to automatically verify your API responses — check status codes, response body values, headers, and response times. Tests run after every request.",
    placement: "bottom",
  },
  {
    target: "[data-tour='response-panel']",
    titleKey: "tour.responseViewer",
    description:
      "After sending a request, the response appears here — the body (with syntax highlighting), headers, cookies, status code, timing, and test results.",
    placement: "left",
  },
  {
    target: "[data-tour='send-btn']",
    titleKey: "tour.sendFirstRequest",
    description:
      "You're all set! Click Send or press Ctrl+Enter to fire off your request. Try the sample requests in the sidebar to get started.",
    placement: "bottom",
  },
];

interface TooltipPosition {
  top: number;
  left: number;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function GuidedTour({ onComplete }: { onComplete: () => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({ top: 0, left: 0 });
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentStep = TOUR_STEPS[step];

  const positionTooltip = useCallback(() => {
    if (!currentStep) return;

    const el = document.querySelector(currentStep.target);
    if (!el) {
      // If element not found, skip to next step or end
      if (step < TOUR_STEPS.length - 1) {
        setStep((s) => s + 1);
      } else {
        onComplete();
      }
      return;
    }

    const rect = el.getBoundingClientRect();
    const padding = 8;

    setSpotlight({
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    });

    const tooltipWidth = 320;
    const tooltipEl = tooltipRef.current;
    const tooltipHeight = tooltipEl ? tooltipEl.offsetHeight : 180;
    const gap = 16;
    const placement = currentStep.placement || "bottom";

    let top = 0;
    let left = 0;

    switch (placement) {
      case "bottom":
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "top":
        top = rect.top - tooltipHeight - gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "right":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + gap;
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - gap;
        break;
    }

    // Clamp to viewport
    top = Math.max(8, Math.min(top, window.innerHeight - tooltipHeight - 8));
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipWidth - 8));

    setTooltipPos({ top, left });
    setVisible(true);
  }, [currentStep, step, onComplete]);

  useEffect(() => {
    // Small delay so elements are rendered, then reposition for accurate height
    const timer1 = setTimeout(positionTooltip, 100);
    const timer2 = setTimeout(positionTooltip, 250);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [positionTooltip]);

  useEffect(() => {
    const handleResize = () => positionTooltip();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [positionTooltip]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onComplete();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        if (step < TOUR_STEPS.length - 1) setStep((s) => s + 1);
        else onComplete();
      } else if (e.key === "ArrowLeft") {
        if (step > 0) setStep((s) => s - 1);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [step, onComplete]);

  if (!visible || !currentStep) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Dark overlay with spotlight cutout */}
      <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {spotlight && (
              <rect
                x={spotlight.left}
                y={spotlight.top}
                width={spotlight.width}
                height={spotlight.height}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.65)"
          mask="url(#tour-mask)"
        />
      </svg>

      {/* Spotlight border */}
      {spotlight && (
        <div
          className="absolute rounded-lg border-2 border-blue-500 transition-all duration-300"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            pointerEvents: "none",
            boxShadow: "0 0 0 4px rgba(59,130,246,0.2)",
          }}
        />
      )}

      {/* Click blocker */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute z-10 w-80 rounded-lg border border-(--color-border) bg-(--color-surface) p-4 shadow-2xl transition-all duration-300"
        style={{ top: tooltipPos.top, left: tooltipPos.left }}
      >
        {/* Close button */}
        <button
          onClick={onComplete}
          className="absolute right-2 top-2 rounded p-1 text-(--color-text-dimmed) hover:bg-(--color-elevated) hover:text-(--color-text-secondary)"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Step counter */}
        <div className="mb-1 text-xs text-(--color-text-dimmed)">
          {step + 1} {t("tour.of")} {TOUR_STEPS.length}
        </div>

        {/* Content */}
        <h3 className="mb-1 text-sm font-semibold text-(--color-text-primary)">
          {t(currentStep.titleKey)}
        </h3>
        <p className="mb-4 text-xs leading-relaxed text-(--color-text-secondary)">
          {currentStep.description}
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={onComplete}
            className="text-xs text-(--color-text-dimmed) hover:text-(--color-text-secondary)"
          >
            {t("tour.skip")}
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1 rounded bg-(--color-elevated) px-3 py-1.5 text-xs text-(--color-text-secondary) hover:bg-(--color-border)"
              >
                <ChevronLeft className="h-3 w-3" />
                {t("tour.back")}
              </button>
            )}
            <button
              onClick={() => {
                if (step < TOUR_STEPS.length - 1) setStep((s) => s + 1);
                else onComplete();
              }}
              className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500"
            >
              {step < TOUR_STEPS.length - 1 ? (
                <>
                  {t("tour.next")}
                  <ChevronRight className="h-3 w-3" />
                </>
              ) : (
                t("common.getStarted")
              )}
            </button>
          </div>
        </div>

        {/* Progress dots */}
        <div className="mt-3 flex justify-center gap-1">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step
                  ? "w-4 bg-blue-500"
                  : i < step
                    ? "w-1.5 bg-blue-500/50"
                    : "w-1.5 bg-(--color-border)"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
