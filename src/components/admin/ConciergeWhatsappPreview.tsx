import type { ConciergeBrandedPreview } from "@/lib/conciergeTemplateAdmin";

export function ConciergeWhatsappPreview({ preview }: { preview: ConciergeBrandedPreview }) {
  return (
    <div className="mx-auto max-w-sm rounded-[2rem] border-8 border-slate-900 bg-slate-100 p-2 shadow-lg">
      <div className="overflow-hidden rounded-[1.5rem] bg-[var(--cc-whatsapp-preview-canvas)]">
        {preview.whatsappHeaderUrl && (
          <img
            src={preview.whatsappHeaderUrl}
            alt="Cloud & Core"
            className="h-36 w-full object-cover"
          />
        )}
        <div className="space-y-3 p-4">
          <div
            dir={preview.dir}
            lang={preview.locale}
            className="rounded-lg rounded-tl-none bg-white p-3 text-sm leading-6 text-slate-800 shadow-sm"
          >
            {preview.body}
          </div>
          {preview.action && (
            <a
              href={preview.action.url}
              className="block rounded-lg bg-[var(--cc-whatsapp-action)] px-4 py-2 text-center text-sm font-medium text-slate-900"
            >
              {preview.action.label}
            </a>
          )}
          {preview.whatsappFooter && (
            <p className="text-center text-xs text-slate-500">{preview.whatsappFooter}</p>
          )}
        </div>
      </div>
    </div>
  );
}
