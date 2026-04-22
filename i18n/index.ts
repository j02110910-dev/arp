import en from './locales/en.json';
import zh from './locales/zh.json';
import ja from './locales/ja.json';

type Locale = 'en' | 'zh' | 'ja';

type LocaleMessages = typeof en;

const locales: Record<Locale, LocaleMessages> = { en, zh, ja };

const supportedLangs: Locale[] = ['en', 'zh', 'ja'];

/**
 * Get the current language from environment variable ARP_LANG
 * Falls back to 'en' if not set or not supported
 */
export function getLang(): Locale {
  const envLang = process.env.ARP_LANG;
  if (envLang && supportedLangs.includes(envLang as Locale)) {
    return envLang as Locale;
  }
  return 'en';
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): string | undefined {
  const keys = path.split('.');
  let current: any = obj;
  for (const key of keys) {
    if (current === undefined || current === null) return undefined;
    current = current[key];
  }
  return typeof current === 'string' ? current : undefined;
}

/**
 * Replace template variables in the format {varname} with actual values
 */
function replaceVars(tpl: string, vars?: Record<string, string>): string {
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

/**
 * Get a translated message by key
 * @param key - The message key to look up (dot notation: 'alert.loop_detected')
 * @param lang - The language code ('en', 'zh', 'ja'), defaults to getLang()
 * @param vars - Optional variables to replace in the template
 * @returns The translated string, or the key itself if not found
 */
export function i18n(key: string, lang?: string, vars?: Record<string, string>): string {
  const effectiveLang = (lang && supportedLangs.includes(lang as Locale)) ? lang as Locale : getLang();
  const messages = locales[effectiveLang];

  // Try to get from target language first
  let template = getNestedValue(messages, key);
  if (template !== undefined) {
    return replaceVars(template, vars);
  }

  // Fallback to English if key not found in target language
  template = getNestedValue(locales.en, key);
  if (template !== undefined) {
    return replaceVars(template, vars);
  }

  // Return key itself if not found in any locale
  return key;
}

/**
 * Get all available languages
 */
export function getSupportedLangs(): Locale[] {
  return [...supportedLangs];
}

export default i18n;
