import React, { useState } from 'react';
import {
  RefreshCw,
  Trash2,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { MySQLStatusData } from '../types';
import { apiClient } from '../api/client';
import { formatDateTime } from '../utils/formatters';
import { usePrivacyMask } from '../utils/privacy';
import { Button } from '../components/Button';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface SettingsScreenProps {
  mysqlStatus: MySQLStatusData | null;
  onRefreshAll: () => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  mysqlStatus,
  onRefreshAll,
  onNotify,
}) => {
  const [verifying, setVerifying] = useState(false);
  const [showAdvancedDanger, setShowAdvancedDanger] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { isMasked, toggleMask } = usePrivacyMask();

  const handleVerifySync = async () => {
    setVerifying(true);
    try {
      await apiClient.verifyAndSyncMySQL();
      await onRefreshAll();
      onNotify('Données synchronisées');
    } catch (err: any) {
      onNotify(err?.message || 'Erreur de synchronisation', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleConfirmReset = async () => {
    setResetting(true);
    try {
      await apiClient.resetDatabase();
      await onRefreshAll();
      setConfirmResetOpen(false);
      setShowAdvancedDanger(false);
      onNotify('Données réinitialisées');
    } catch (err: any) {
      onNotify(err?.message || 'Erreur réinitialisation', 'error');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200/90 rounded-2xl divide-y divide-slate-100 overflow-hidden">
        {/* 1. Protection & Masquage des Données Sensibles */}
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] text-[#047857] flex items-center justify-center shrink-0">
              {isMasked ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Masquage des éléments sensibles
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                    isMasked
                      ? 'bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {isMasked ? 'Activé' : 'Désactivé'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Masque les montants financiers, totaux de ventes, achats et données sensibles sur l'interface.
              </p>
            </div>
          </div>

          <Button
            variant={isMasked ? 'primary' : 'outline'}
            size="sm"
            className="w-full sm:w-auto"
            onClick={toggleMask}
            icon={isMasked ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          >
            {isMasked ? 'Afficher les montants' : 'Masquer les montants'}
          </Button>
        </div>

        {/* 2. Synchronisation des données (sans exposer d'informations techniques sensibles) */}
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] text-[#047857] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Synchronisation des données
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0]">
                  <CheckCircle2 className="w-3 h-3" />
                  Synchronisé
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Dernière vérification :{' '}
                {mysqlStatus?.last_verified ? formatDateTime(mysqlStatus.last_verified) : 'En direct'}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            loading={verifying}
            onClick={handleVerifySync}
            icon={<RefreshCw className="w-4 h-4 text-[#047857]" />}
          >
            Synchroniser maintenant
          </Button>
        </div>

        {/* 3. Zone d'administration protégée (Masquée par défaut) */}
        <div className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-slate-900 truncate">
                  Zone d'administration sécurisée
                </h2>
                <p className="text-xs text-slate-500 truncate">
                  Les éléments sensibles d'administration sont masqués par défaut
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvancedDanger((v) => !v)}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer shrink-0"
            >
              {showAdvancedDanger ? 'Masquer' : 'Déverrouiller'}
            </button>
          </div>

          {showAdvancedDanger && (
            <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-red-800">
                  Réinitialisation générale des données
                </p>
                <p className="text-[11px] text-red-600 mt-0.5">
                  Efface toutes les opérations enregistrées après confirmation.
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setConfirmResetOpen(true)}
                icon={<Trash2 className="w-4 h-4" />}
              >
                Réinitialiser
              </Button>
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmResetOpen}
        title="Réinitialiser toutes les données"
        message="Confirmez-vous la suppression de tous les produits, ventes, entrées, stocks, clients, fournisseurs et reçus ? Cette opération est irréversible."
        confirmLabel="Tout effacer"
        loading={resetting}
        onConfirm={handleConfirmReset}
        onCancel={() => setConfirmResetOpen(false)}
      />
    </div>
  );
};
