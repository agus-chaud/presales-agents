import { z } from 'zod';

const nonEmptyText = z.string().trim().min(1);

export const leadSignalStatusSchema = z.enum(['new', 'reviewed', 'discarded']);

export const leadSignalInputSchema = z.object({
  post_url: z.string().url(),
  author: nonEmptyText,
  company: z.string().trim().optional().default(''),
  text: nonEmptyText,
  timestamp: z.string().datetime({ offset: true }),
  engagement: z
    .object({
      likes: z.coerce.number().int().min(0).default(0),
      comments: z.coerce.number().int().min(0).default(0),
      reposts: z.coerce.number().int().min(0).default(0),
    })
    .default({ likes: 0, comments: 0, reposts: 0 }),
  topic_signals: z.array(nonEmptyText).default([]),
  intent_signals: z.array(nonEmptyText).default([]),
});

export const leadSignalsBatchSchema = z.object({
  collector: nonEmptyText.default('python'),
  collected_at: z.string().datetime({ offset: true }).optional(),
  signals: z.array(leadSignalInputSchema).min(1),
});

export type LeadSignalInput = z.infer<typeof leadSignalInputSchema>;
export type LeadSignalsBatchInput = z.infer<typeof leadSignalsBatchSchema>;
export type LeadSignalStatus = z.infer<typeof leadSignalStatusSchema>;

export interface LeadSignalRecord {
  id: number | string;
  signal_key: string;
  post_url: string;
  author: string;
  company: string | null;
  text: string;
  signal_timestamp: string;
  date_bucket: string;
  engagement_likes: number;
  engagement_comments: number;
  engagement_reposts: number;
  topic_signals: string[];
  intent_signals: string[];
  status: LeadSignalStatus;
  created_at: string;
  updated_at: string;
}

export interface NewLeadSignalRecord {
  signal_key: string;
  post_url: string;
  author: string;
  company: string | null;
  text: string;
  signal_timestamp: string;
  date_bucket: string;
  engagement_likes: number;
  engagement_comments: number;
  engagement_reposts: number;
  topic_signals: string[];
  intent_signals: string[];
  status: LeadSignalStatus;
}

export function toDateBucket(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}

export function buildLeadSignalKey(postUrl: string, author: string, dateBucket: string): string {
  return `${postUrl.trim()}::${author.trim().toLowerCase()}::${dateBucket}`;
}

export function normalizeLeadSignal(input: LeadSignalInput): NewLeadSignalRecord {
  const parsed = leadSignalInputSchema.parse(input);
  const dateBucket = toDateBucket(parsed.timestamp);

  return {
    signal_key: buildLeadSignalKey(parsed.post_url, parsed.author, dateBucket),
    post_url: parsed.post_url.trim(),
    author: parsed.author.trim(),
    company: parsed.company?.trim() ? parsed.company.trim() : null,
    text: parsed.text.trim(),
    signal_timestamp: parsed.timestamp,
    date_bucket: dateBucket,
    engagement_likes: parsed.engagement.likes,
    engagement_comments: parsed.engagement.comments,
    engagement_reposts: parsed.engagement.reposts,
    topic_signals: [...new Set(parsed.topic_signals.map((value) => value.trim()).filter(Boolean))],
    intent_signals: [...new Set(parsed.intent_signals.map((value) => value.trim()).filter(Boolean))],
    status: 'new',
  };
}
