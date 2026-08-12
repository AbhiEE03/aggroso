/**
 * docSearch tool — keyword search over a seeded document set
 *
 * In a real system this would hit a vector DB or search index.
 * For this project, we use a hardcoded array of ~10 "product/QA docs"
 * and a naive relevance score (term frequency in title + body).
 *
 * Interface: (input) => { output, error }
 */

const SEEDED_DOCS = [
  {
    id: 'doc-001',
    title: 'How to reset your password',
    body: 'To reset your password, go to Settings > Security > Reset Password. You will receive an email with a reset link within 5 minutes.',
    tags: ['account', 'security', 'password'],
  },
  {
    id: 'doc-002',
    title: 'Billing and subscription plans',
    body: 'We offer three plans: Free, Pro ($29/month), and Enterprise (custom pricing). Billing is monthly. Annual billing gives a 20% discount.',
    tags: ['billing', 'pricing', 'subscription'],
  },
  {
    id: 'doc-003',
    title: 'How to export your data',
    body: 'Data can be exported in CSV or JSON format from the Settings > Data Export panel. Exports are processed within 2 hours for large accounts.',
    tags: ['data', 'export', 'settings'],
  },
  {
    id: 'doc-004',
    title: 'API rate limits',
    body: 'The API allows 1000 requests per minute on Pro plans and 100 on Free plans. Rate limit headers (X-RateLimit-Remaining) are included in every response.',
    tags: ['api', 'rate-limit', 'developers'],
  },
  {
    id: 'doc-005',
    title: 'Supported file formats for upload',
    body: 'Supported formats: PDF, DOCX, XLSX, PNG, JPG, CSV. Maximum file size is 50MB. Files are scanned for malware on upload.',
    tags: ['upload', 'files', 'formats'],
  },
  {
    id: 'doc-006',
    title: 'Two-factor authentication setup',
    body: 'Enable 2FA from Settings > Security. We support TOTP apps (Google Authenticator, Authy) and SMS. SMS 2FA requires a verified phone number.',
    tags: ['security', '2fa', 'authentication'],
  },
  {
    id: 'doc-007',
    title: 'Refund policy',
    body: 'Refunds are available within 14 days of purchase for annual plans. Monthly subscriptions are not refunded for partial months. Contact support to request a refund.',
    tags: ['billing', 'refund', 'policy'],
  },
  {
    id: 'doc-008',
    title: 'How to invite team members',
    body: 'Go to Settings > Team. Enter the email addresses of people to invite. They will receive an invitation email. Team members can be assigned roles: Admin, Editor, or Viewer.',
    tags: ['team', 'collaboration', 'invite'],
  },
  {
    id: 'doc-009',
    title: 'Webhook configuration',
    body: 'Webhooks notify your server when events occur. Configure endpoints at Settings > Webhooks. Supported events: user.created, payment.succeeded, export.completed.',
    tags: ['api', 'webhooks', 'developers'],
  },
  {
    id: 'doc-010',
    title: 'GDPR and data privacy',
    body: 'We are GDPR compliant. Data is stored in EU-West region by default. You can request a full data export or deletion from Settings > Privacy. DPA available on request.',
    tags: ['privacy', 'gdpr', 'compliance'],
  },
];

/**
 * Naive relevance scoring: count how many query terms appear in title + body.
 */
const scoreDoc = (doc, terms) => {
  const text = `${doc.title} ${doc.body} ${doc.tags.join(' ')}`.toLowerCase();
  return terms.reduce((score, term) => {
    const re = new RegExp(term.toLowerCase(), 'g');
    const matches = text.match(re);
    return score + (matches ? matches.length : 0);
  }, 0);
};

/**
 * @param {{ query: string, limit?: number }} input
 * @returns {{ output: { results: Array, totalFound: number } | null, error: string | null }}
 */
const docSearch = (input) => {
  const query = input?.query ?? String(input);
  const limit = Math.min(input?.limit ?? 3, 5);

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return { output: null, error: 'Input must have a "query" field with a non-empty string' };
  }

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2); // ignore very short words

  if (terms.length === 0) {
    return { output: null, error: 'Query is too short or contains only stop words' };
  }

  const scored = SEEDED_DOCS.map((doc) => ({
    ...doc,
    relevanceScore: scoreDoc(doc, terms),
  }))
    .filter((doc) => doc.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit)
    .map(({ relevanceScore, ...doc }) => ({ ...doc, relevanceScore }));

  return {
    output: {
      results: scored,
      totalFound: scored.length,
      query,
    },
    error: null,
  };
};

module.exports = { docSearch, SEEDED_DOCS };
