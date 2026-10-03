import React, { useState } from 'react';
import { X, Printer, Share2, FileDown, Check } from 'lucide-react';
import { Recu } from '../types';
import { formatDateTime, formatFCFA, formatNumber } from '../utils/formatters';
import { pdfService } from '../services/pdfService';
import { Button } from './Button';

interface ReceiptModalProps {
  recu: Recu | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ recu, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!recu) return null;

  const isSale = recu.type_operation !== 'ENTREE';

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    const shareText = [
      '==============================',
      isSale ? '        REÇU DE VENTE         ' : "     BON D'ENTRÉE / ACHAT     ",
      '==============================',
      `Reçu N° : ${recu.numero_recu}`,
      `Date : ${formatDateTime(recu.date_recu)}`,
      `${isSale ? 'Client' : 'Fournisseur'} : ${recu.partenaire_nom}`,
      `Contact : ${recu.partenaire_contact || '-'}`,
      '------------------------------',
      `Produit : ${recu.produit_nom}`,
      `Quantité : ${formatNumber(recu.quantite)} ${recu.unite || ''}`,
      `Prix unitaire : ${formatFCFA(recu.prix_unitaire)}`,
      `Prix total : ${formatFCFA(recu.prix_total)}`,
      '------------------------------',
      `TOTAL GÉNÉRAL : ${formatFCFA(recu.total_general)}`,
      '==============================',
    ].join('\n');

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Reçu ${recu.numero_recu}`,
          text: shareText,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden my-auto">
        {/* Top bar (hidden when printing) */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between no-print">
          <span className="text-xs font-semibold text-slate-700">Aperçu du Reçu</span>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Receipt Body */}
        <div className="p-6 bg-white" id="printable-receipt">
          <div className="text-center border-b border-dashed border-slate-300 pb-3">
            <p className="text-sm font-mono font-bold text-[#047857]">
              {isSale ? 'REÇU DE VENTE' : "BON D'ENTRÉE / ACHAT"}
            </p>
          </div>

          <div className="py-4 border-b border-dashed border-slate-300 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Numéro du reçu :</span>
              <span className="font-mono font-semibold text-slate-900">{recu.numero_recu}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date :</span>
              <span className="font-mono text-slate-800">{formatDateTime(recu.date_recu)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">{isSale ? 'Client :' : 'Fournisseur :'}</span>
              <span className="font-semibold text-slate-900">{recu.partenaire_nom}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Contact :</span>
              <span className="font-mono text-slate-800">{recu.partenaire_contact || '-'}</span>
            </div>
          </div>

          <div className="py-4 border-b border-dashed border-slate-300 space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Produit :</span>
              <span className="font-semibold text-slate-900 text-right">{recu.produit_nom}</span>
            </div>
            {recu.categorie_nom && (
              <div className="flex justify-between">
                <span className="text-slate-500">Catégorie :</span>
                <span className="text-slate-700">{recu.categorie_nom}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Quantité :</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {formatNumber(recu.quantite)} {recu.unite || ''}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Prix unitaire :</span>
              <span className="font-mono text-slate-800 tabular-nums">{formatFCFA(recu.prix_unitaire)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Prix total :</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {formatFCFA(recu.prix_total)}
              </span>
            </div>
          </div>

          <div className="mt-4 p-3.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-between">
            <span className="text-xs font-bold text-[#065F46]">TOTAL GÉNÉRAL</span>
            <span className="text-base font-mono font-bold text-[#047857] tabular-nums">
              {formatFCFA(recu.total_general)}
            </span>
          </div>

          <p className="mt-4 text-center text-[11px] text-slate-400">
            Merci de votre confiance
          </p>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-2 no-print">
          <Button
            variant="primary"
            size="sm"
            onClick={() => pdfService.exportReceiptToPDF(recu)}
            icon={<FileDown className="w-4 h-4" />}
          >
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            icon={<Printer className="w-4 h-4" />}
          >
            Imprimer
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleShare}
            icon={copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
          >
            {copied ? 'Copié' : 'Partager'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            icon={<X className="w-4 h-4" />}
          >
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
};
