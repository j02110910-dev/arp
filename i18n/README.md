# i18n - Internationalization Support for ARP

Internationalization module for the ARP project supporting English, Chinese, and Japanese.

## Quick Start

```typescript
import i18n from './i18n';

// Basic usage - uses ARP_LANG env var or defaults to 'en'
const msg = i18n('alert.loop_detected');

// With language specified
const msgZh = i18n('alert.loop_detected', 'zh');

// With template variables
const msgWithVars = i18n('error.load_failed', 'en', { resource: 'config.yaml' });
```

## Language Detection

The language is determined in this order:
1. Explicitly passed `lang` parameter to `i18n()` function
2. `ARP_LANG` environment variable (if set to 'en', 'zh', or 'ja')
3. Default: `'en'` (English)

```bash
# Set language to Chinese
export ARP_LANG=zh

# Set language to Japanese
export ARP_LANG=ja
```

## Supported Languages

- `en` - English (default)
- `zh` - Chinese (简体中文)
- `ja` - Japanese (日本語)

## Adding New Locale Files

1. Create a new JSON file in `locales/` directory:
   ```bash
   # Example: Adding German support
   touch locales/de.json
   ```

2. Add the translation keys following the same structure:
   ```json
   {
     "alert": {
       "loop_detected": "Schleife in Agent-Kommunikation erkannt",
       "timeout": "Zeitüberschreitung",
       ...
     },
     ...
   }
   ```

3. Update `index.ts` to import and register the new locale:
   ```typescript
   import de from './locales/de.json';
   
   type Locale = 'en' | 'zh' | 'ja' | 'de';
   const locales: Record<Locale, LocaleMessages> = { en, zh, ja, de };
   ```

## Message Key Structure

```
alert.loop_detected
verification.passed
guard.allowed
compression.context_compressed
dashboard.agent_count
error.load_failed
```

## Template Variables

Use `{varname}` syntax in translation strings:

```typescript
// In locale file:
"error.load_failed": "Failed to load {resource}"

// In code:
i18n('error.load_failed', 'en', { resource: 'config.yaml' });
// Returns: "Failed to load config.yaml"
```

## Integration Examples

### With Logger

```typescript
import i18n from './i18n';
import logger from './utils/logger';

function handleError(errorKey: string, vars?: Record<string, string>) {
  const message = i18n(errorKey, undefined, vars);
  logger.error(message);
}
```

### With Notifications

```typescript
import i18n from './i18n';

function notifyAlert(alertKey: string) {
  const message = i18n(alertKey);
  sendNotification({
    title: i18n('dashboard.health_status', undefined, { status: 'Alert' }),
    body: message
  });
}
```

### With Express/Response

```typescript
import i18n from './i18n';

app.get('/status', (req, res) => {
  const lang = req.headers['accept-language']?.split(',')[0] || 'en';
  res.json({
    message: i18n('verification.passed', lang)
  });
});
```

## Testing

Run tests with:

```bash
cd /mnt/c/Users/12476/Desktop/arp
npx ts-node i18n/test.ts
```

## File Structure

```
i18n/
├── index.ts           # Main i18n module
├── locales/
│   ├── en.json        # English translations
│   ├── zh.json        # Chinese translations
│   └── ja.json        # Japanese translations
├── README.md          # This file
└── test.ts            # Test suite
```
