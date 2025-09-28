#!/usr/bin/env node
const crypto = require('crypto');

const vendor = process.argv[2];
const tenant = process.env.TENANT_ID || 'demo-tenant';
const secret = process.env.WEBHOOK_SECRET || 'sandbox-secret';
const negative = process.argv.includes('--negative');

if (!vendor) {
  console.error('Usage: webhook-simulator <vendor> [--negative]');
  process.exit(1);
}

const fixtures = {
  amc: {
    body: {
      loanId: '11111111-1111-1111-1111-111111111111',
      orderId: 'AMC-123',
      status: negative ? 'in_review' : 'delivered',
      eta: new Date(Date.now() + 86400000).toISOString(),
      documents: [
        { code: 'APPRAISAL_REPORT', url: 'https://example.com/appraisal.pdf', checksum: 'abc123' },
      ],
    },
  },
  flood: {
    body: {
      loanId: '11111111-1111-1111-1111-111111111111',
      determination: negative ? 'zone_a' : 'zone_x',
      reportUrl: 'https://example.com/flood.pdf',
      checksum: 'def456',
    },
  },
  mi: {
    body: {
      loanId: '11111111-1111-1111-1111-111111111111',
      quoteId: 'MI-123',
      premiumCents: 14500,
      status: negative ? 'declined' : 'issued',
    },
  },
  title: {
    body: {
      loanId: '11111111-1111-1111-1111-111111111111',
      orderId: 'TITLE-123',
      status: negative ? 'in_curative' : 'clear',
      curativeTasks: [],
      documents: [
        { code: 'TITLE_COMMITMENT', url: 'https://example.com/title.pdf', checksum: 'ghi789' },
      ],
    },
  },
};

if (!fixtures[vendor]) {
  console.error(`Unknown vendor ${vendor}`);
  process.exit(1);
}

const timestamp = Date.now();
const nonce = crypto.randomBytes(12).toString('hex');
const bodyString = JSON.stringify(fixtures[vendor].body);
const digest = crypto.createHash('sha256').update(bodyString).digest('hex');
const base = `${timestamp}.${digest}`;
const signature = crypto.createHmac('sha256', secret).update(base).digest('hex');

const payload = {
  headers: {
    'X-Haizel-Vendor': vendor,
    'X-Haizel-Tenant': tenant,
    'X-Timestamp': String(timestamp),
    'X-Nonce': nonce,
    'X-Signature': negative ? signature.replace(/.$/, '0') : signature,
  },
  body: fixtures[vendor].body,
};

process.stdout.write(JSON.stringify(payload, null, 2));
