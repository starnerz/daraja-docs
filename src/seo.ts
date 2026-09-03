/**
 * Search titles, kept apart from the sidebar labels.
 *
 * Starlight uses one `title` for the sidebar, the `<h1>` and the `<title>`.
 * Sidebar labels want to be short; `<title>` wants to carry the words people
 * actually type. Keys are route ids — the page slug, with `''` for the home
 * page. A page with no entry here keeps Starlight's default title.
 */
export const seoTitles: Record<string, string> = {
    '': 'Laravel M-Pesa Daraja Package — STK Push, C2B, B2C',

    'getting-started/introduction': 'M-Pesa in Laravel: what this package does',
    'getting-started/installation': 'Install M-Pesa Daraja in Laravel (5 minutes)',
    'getting-started/configuration': 'Configure M-Pesa Daraja credentials in Laravel',
    'getting-started/sandbox': 'Daraja sandbox credentials and test numbers',

    'apis/overview': 'Every Daraja API mapped to a Laravel method',
    'apis/mpesa-express': 'STK Push in Laravel — M-Pesa Express API guide',
    'apis/c2b': 'M-Pesa C2B in Laravel — register URLs, receive payments',
    'apis/b2c': 'M-Pesa B2C in Laravel — pay out to customers',
    'apis/b2b': 'M-Pesa B2B in Laravel — Pay Bill, Buy Goods, top up',
    'apis/account-services': 'M-Pesa balance, transaction status and reversals in Laravel',
    'apis/dynamic-qr': 'Generate M-Pesa QR codes in Laravel (Dynamic QR API)',
    'apis/standing-orders': 'M-Pesa Ratiba in Laravel — recurring payments API',
    'apis/bill-manager': 'M-Pesa Bill Manager in Laravel — invoices and reminders',
    'apis/pull-transactions': 'M-Pesa Pull Transactions in Laravel — recover missed callbacks',
    'apis/lipa-na-bonga': 'Lipa na Bonga Points in Laravel — Daraja API',

    tutorials: 'M-Pesa Laravel tutorials — build a working integration',
    'tutorials/stk-push': 'Accept M-Pesa payments in Laravel — the complete STK Push guide',
    'tutorials/callbacks-localhost': 'Test M-Pesa callbacks on localhost — ngrok and the alternatives',
    'tutorials/livewire-checkout': 'M-Pesa checkout with Livewire — a complete component',
    'tutorials/api-checkout': 'M-Pesa STK Push API for a Vue, React or Flutter front end',
    'tutorials/c2b-paybill': 'Receive M-Pesa Paybill payments in Laravel — the C2B tutorial',
    'tutorials/b2c-payouts': 'Send money with M-Pesa B2C in Laravel — payouts and refunds',

    'guides/callbacks': 'Handling M-Pesa callbacks in Laravel',
    'guides/reconciliation': 'Reconcile M-Pesa payments in Laravel — find missed callbacks',
    'guides/testing': 'Testing M-Pesa in Laravel without sandbox credentials',
    'guides/security-credentials': 'M-Pesa initiator password and security credential explained',
    'guides/going-live': 'Daraja go-live checklist — M-Pesa production credentials',

    'reference/configuration': 'Laravel Daraja configuration reference',
    'reference/events': 'Laravel Daraja events reference',
    'reference/exceptions': 'Laravel Daraja exceptions reference',
    'reference/commands': 'Laravel Daraja Artisan commands reference',
    'reference/error-codes': 'M-Pesa Daraja error codes explained (full list)',

    'upgrade/v4-to-v5': 'Upgrade Laravel Daraja 4.x to 5.0',

    changelog: 'Laravel Daraja changelog — every release',
    'legal/privacy': 'Privacy policy',
};

/**
 * The content collection calls the home page `index`; Starlight's routing
 * calls it `''`. Both reach this module, so settle on the routing form.
 */
export function routeId(id: string): string {
    return id === 'index' ? '' : id;
}

/** Route id to the OpenGraph image generated for it by `src/pages/og/`. */
export function ogImageId(id: string): string {
    return routeId(id) === '' ? 'index' : id;
}
