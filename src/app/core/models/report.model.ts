import { MiniProfile } from '../repositories/repository.types';

/** Motifs de signalement, dans l'ordre affiché. Les clés sont vérifiées par le serveur. */
export const REPORT_REASONS = [
  { value: 'harcelement', label: 'Harcèlement ou menaces' },
  { value: 'comportement', label: 'Comportement inapproprié' },
  { value: 'faux_profil', label: 'Faux profil' },
  { value: 'contenu_choquant', label: 'Photo ou message choquant' },
  { value: 'arnaque', label: "Arnaque ou demande d'argent" },
  { value: 'mineur', label: 'Membre de moins de 18 ans' },
  { value: 'autre', label: 'Autre' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['value'];

export function reportReasonLabel(value: string): string {
  return REPORT_REASONS.find((r) => r.value === value)?.label ?? value;
}

export interface Report {
  id: string;
  created_at: string;
  reason: string;
  details: string | null;
  reporter: MiniProfile | null;
  target: MiniProfile | null;
  target_user_id: string;
}
