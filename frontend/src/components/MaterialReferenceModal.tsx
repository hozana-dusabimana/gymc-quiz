import type { AnswerReference } from '@/types';
import { Modal } from './common';

export function MaterialReferenceModal({
  reference,
  onClose,
}: {
  reference: AnswerReference;
  onClose: () => void;
}) {
  return (
    <Modal
      title={reference.kind === 'online' ? 'Additional online reference' : 'Course material reference'}
      icon={reference.kind === 'online' ? 'public' : 'auto_stories'}
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div className="flex items-center gap-2 text-slate-800 font-semibold min-w-0">
            <span className="material-symbols-outlined text-amber-600 text-base">description</span>
            <span className="truncate">{reference.title}</span>
          </div>
          {reference.page != null && (
            <span className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 font-bold shrink-0">
              Page / slide {reference.page}
            </span>
          )}
        </div>

        {reference.snippet && (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-800 text-slate-300 px-4 py-2 text-[11px] font-mono flex items-center justify-between">
              <span>Excerpt</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="material-symbols-outlined text-sm">verified</span> From your course material
              </span>
            </div>
            <blockquote className="p-4 bg-slate-900 text-slate-200 text-xs leading-relaxed border-l-4 border-amber-500">
              “{reference.snippet}”
            </blockquote>
          </div>
        )}

        {reference.url && (
          <a
            href={reference.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold"
          >
            <span className="material-symbols-outlined text-sm">open_in_new</span>
            Open source
          </a>
        )}
      </div>
    </Modal>
  );
}
