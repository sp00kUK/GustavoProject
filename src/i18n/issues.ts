import type { ValidationIssue } from '../types';
import type { I18nValue, TranslationKey } from './index';

/**
 * Translate a kernel-produced validation issue.
 *
 * The geometry kernel is deliberately locale-free - it deals in codes and
 * numeric detail, never in presentation - so the message it carries is an
 * English developer-facing fallback. The UI resolves the code against the
 * dictionary and formats the numbers for the active locale, which is why a
 * Spanish user sees "0,80 mm" and not "0.80 mm".
 */
export function translateIssue(i18n: I18nValue, issue: ValidationIssue): string {
  const { t, n } = i18n;
  const detail = issue.detail ?? {};

  // A couple of codes have variant wording chosen by a discriminator in detail.
  const key: TranslationKey =
    issue.code === 'DEPTH_BREACHES_BORE'
      ? (`issue.DEPTH_BREACHES_BORE_${detail.target === 'centre' ? 'centre' : 'bore'}` as TranslationKey)
      : (`issue.${issue.code}` as TranslationKey);

  const translated = t(key, formatDetail(detail, n));
  // `t` echoes the key back when it is unknown, which is the signal to fall
  // through to whatever the kernel said rather than showing a raw code.
  return translated === key ? issue.message : translated;
}

function formatDetail(
  detail: Record<string, number | string>,
  n: I18nValue['n'],
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(detail)) {
    if (typeof value !== 'number') {
      out[name] = value;
      continue;
    }
    // Counts stay as integers; measurements get two decimals.
    out[name] = Number.isInteger(value) && name === 'count' ? value : n(value, 2);
  }
  return out;
}
