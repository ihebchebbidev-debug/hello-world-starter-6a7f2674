/**
 * Translate an error from the HTTP helper (services/api.js) into a
 * human-readable French message via i18n. Always returns a non-empty string.
 *
 * Mirrors ecobus_driver-main/src/utils/errors.js.
 */
export function humanizeError(err, t) {
  const tr = (key, fallback) => {
    const v = t ? t(key) : null;
    return v && v !== key ? v : fallback;
  };

  if (!err) return tr('errors.unknown', 'Une erreur est survenue.');

  if (err.network) return tr('errors.network', 'Pas de connexion. Vérifiez votre réseau.');

  switch (err.status) {
    case 400:
    case 422:
      return err.message || tr('errors.invalidInput', 'Données invalides.');
    case 401:
      return tr('errors.unauthorized', 'Session expirée. Veuillez vous reconnecter.');
    case 403:
      return tr('errors.forbidden', 'Action non autorisée.');
    case 404:
      return tr('errors.notFound', 'Ressource introuvable.');
    case 409:
      return err.message || tr('errors.conflict', 'Conflit : opération impossible.');
    case 429:
      return tr('errors.rateLimited', 'Trop de tentatives. Réessayez plus tard.');
    case 500:
    case 502:
    case 503:
    case 504:
      return tr('errors.server', 'Erreur serveur. Réessayez plus tard.');
    default:
      return err.message || tr('errors.unknown', 'Une erreur est survenue.');
  }
}
