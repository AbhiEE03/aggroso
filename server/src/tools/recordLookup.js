/**
 * recordLookup tool — lookup against a seeded structured records collection
 *
 * Simulates looking up "customer" or "task" records by ID or field match.
 * In a real system this would query a database. Here we use a hardcoded array.
 *
 * Interface: (input) => { output, error }
 */

const SEEDED_RECORDS = [
  {
    id: 'cust-001',
    type: 'customer',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    plan: 'Pro',
    status: 'active',
    joinedAt: '2024-01-15',
    country: 'US',
  },
  {
    id: 'cust-002',
    type: 'customer',
    name: 'Bob Smith',
    email: 'bob@example.com',
    plan: 'Free',
    status: 'active',
    joinedAt: '2024-03-22',
    country: 'UK',
  },
  {
    id: 'cust-003',
    type: 'customer',
    name: 'Carol White',
    email: 'carol@example.com',
    plan: 'Enterprise',
    status: 'active',
    joinedAt: '2023-11-01',
    country: 'CA',
  },
  {
    id: 'cust-004',
    type: 'customer',
    name: 'David Lee',
    email: 'david@example.com',
    plan: 'Pro',
    status: 'suspended',
    joinedAt: '2024-02-10',
    country: 'AU',
  },
  {
    id: 'task-001',
    type: 'task',
    title: 'Review Q3 invoices',
    assignee: 'alice@example.com',
    status: 'pending',
    priority: 'high',
    dueDate: '2026-08-20',
  },
  {
    id: 'task-002',
    type: 'task',
    title: 'Update API documentation',
    assignee: 'bob@example.com',
    status: 'in_progress',
    priority: 'medium',
    dueDate: '2026-08-25',
  },
  {
    id: 'task-003',
    type: 'task',
    title: 'Security audit',
    assignee: 'carol@example.com',
    status: 'completed',
    priority: 'critical',
    dueDate: '2026-08-10',
  },
  {
    id: 'inv-001',
    type: 'invoice',
    customerId: 'cust-001',
    amount: 290,
    currency: 'USD',
    status: 'paid',
    issuedAt: '2026-07-01',
  },
  {
    id: 'inv-002',
    type: 'invoice',
    customerId: 'cust-003',
    amount: 1200,
    currency: 'USD',
    status: 'overdue',
    issuedAt: '2026-07-01',
  },
  {
    id: 'inv-003',
    type: 'invoice',
    customerId: 'cust-002',
    amount: 0,
    currency: 'USD',
    status: 'free_tier',
    issuedAt: '2026-07-01',
  },
];

/**
 * @param {{ id?: string, type?: string, field?: string, value?: string }} input
 * @returns {{ output: { records: Array, totalFound: number } | null, error: string | null }}
 */
const recordLookup = (input) => {
  if (!input || typeof input !== 'object') {
    return { output: null, error: 'Input must be an object with at least one of: id, type, field+value' };
  }

  const { id, type, field, value } = input;

  if (!id && !type && (!field || !value)) {
    return {
      output: null,
      error: 'Provide at least one of: "id" (exact match), "type" (filter by record type), or "field"+"value" (field match)',
    };
  }

  let results = [...SEEDED_RECORDS];

  // Filter by ID (exact)
  if (id) {
    results = results.filter((r) => r.id === id);
  }

  // Filter by type
  if (type) {
    results = results.filter((r) => r.type === type);
  }

  // Filter by arbitrary field match (case-insensitive string match)
  if (field && value) {
    results = results.filter((r) => {
      const fieldVal = r[field];
      if (fieldVal === undefined) return false;
      return String(fieldVal).toLowerCase().includes(String(value).toLowerCase());
    });
  }

  return {
    output: {
      records: results,
      totalFound: results.length,
    },
    error: null,
  };
};

module.exports = { recordLookup, SEEDED_RECORDS };
