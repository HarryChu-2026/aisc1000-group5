import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/api/errors";
import { GmailRequestError } from "@/lib/gmail/client";
import { attachmentBody, capBody, gmailMessage, isDeniedSender, normaliseMessage } from "@/lib/gmail/message";
import { readPdfText } from "@/lib/gmail/pdf";
import { openGmail } from "@/lib/jobs/gmail-account";
import { processQueuedMail } from "@/lib/jobs/extract-mail";
import { getGmailAccount, markGmailRevoked, recordSyncCheckpoint } from "@/lib/repositories/gmail-accounts";
import { insertMail } from "@/lib/repositories/mail";
import { claimSyncJob, enqueueSyncJob, previousBackfill, updateSyncJob } from "@/lib/repositories/sync-jobs";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const profile = z.object({ historyId: z.string() });
const messageList = z.object({
  messages: z.array(z.object({ id: z.string() })).default([]),
  nextPageToken: z.string().optional(),
});
const historyList = z.object({
  historyId: z.string(),
  nextPageToken: z.string().optional(),
  history: z.array(z.object({
    messagesAdded: z.array(z.object({ message: z.object({ id: z.string() }) })).default([]),
  })).default([]),
});
const progress = z.object({
  pending: z.array(z.string()),
  nextPage: z.string().nullable(),
  historyBase: z.string(),
  historyEnd: z.string(),
  window: z.number().int(),
  seen: z.number().int().default(0),
  processed: z.number().int().default(0),
  events_created: z.number().int().default(0),
});
type Gmail = Awaited<ReturnType<typeof openGmail>>;

async function loadPage(gmail: Gmail, window: number, base: string, nextPage?: string) {
  const query = new URLSearchParams({ maxResults: "500" });
  if (nextPage) query.set("pageToken", nextPage);
  if (window > 0) {
    query.set("q", `newer_than:${window}d -in:chats`);
    const page = await gmail.get("messages", messageList, query);
    return { ids: page.messages.map(message => message.id).reverse(), nextPage: page.nextPageToken ?? null, end: base };
  }
  query.set("startHistoryId", base);
  query.set("historyTypes", "messageAdded");
  const page = await gmail.get("history", historyList, query);
  return {
    ids: [...new Set(page.history.flatMap(item => item.messagesAdded.map(({ message }) => message.id)))],
    nextPage: page.nextPageToken ?? null,
    end: page.historyId,
  };
}

async function readMessage(gmail: Gmail, id: string) {
  const message = await gmail.get(`messages/${encodeURIComponent(id)}`, gmailMessage, new URLSearchParams({ format: "full" }));
  const { row, inlineAttachments } = normaliseMessage(message);
  const denied = isDeniedSender(row.from_email);
  if (!denied) {
    const attachments = row.attachments.filter(item =>
      (item.mimeType === "application/pdf" || item.mimeType === "text/calendar") && item.size <= 5_000_000);
    const candidates = [
      ...attachments.filter(item => item.mimeType === "application/pdf").slice(0, 3),
      ...attachments.filter(item => item.mimeType === "text/calendar").slice(0, 1),
    ];
    for (const item of candidates) {
      try {
        const encoded = inlineAttachments.get(item.id) ?? (await gmail.get(
          `messages/${encodeURIComponent(id)}/attachments/${encodeURIComponent(item.id)}`, attachmentBody)).data;
        const binary = Buffer.from(encoded, "base64url");
        if (binary.length > 5_000_000) continue;
        const text = item.mimeType === "application/pdf" ? await readPdfText(Uint8Array.from(binary)) : binary.toString("utf8");
        if (text.trim()) row.body_text = capBody(`${text}\n\n${row.body_text}`);
      } catch (error) {
        if (error instanceof AppError && error.code === "GMAIL_REVOKED") throw error;
        if (error instanceof GmailRequestError && ![404, 410].includes(error.status)) throw error;
      }
    }
  }
  return {
    ...row,
    body_chars: row.body_text.length,
    processing_status: denied ? "skipped" as const : "queued" as const,
    skip_reason: denied ? "denylist" : null,
  };
}

export async function startGmailSync(studentId: string) {
  const db = createSupabaseAdminClient();
  const connection = await getGmailAccount(db, studentId);
  if (!connection || connection.status !== "active") {
    throw new AppError("GMAIL_REVOKED", "Reconnect Gmail to continue.");
  }
  return enqueueSyncJob(db, studentId);
}

export async function runGmailSync(studentId: string, jobId: string, stopAt = Date.now() + 240000) {
  const db = createSupabaseAdminClient();
  const deadline = stopAt;
  while (Date.now() < deadline) {
    const job = await claimSyncJob(db, studentId, jobId);
    if (!job) return;
    const update = (values: Record<string, unknown>) =>
      updateSyncJob(db, studentId, jobId, job.started_at, values);
    try {
      const account = await getGmailAccount(db, studentId);
      const gmail = await openGmail(studentId);
      let parsed = progress.safeParse(job.payload);
      if (!parsed.success) {
        const previous = progress.safeParse(await previousBackfill(db, studentId, jobId));
        if (previous.success && previous.data.window > 0 && (previous.data.pending.length || previous.data.nextPage)) {
          parsed = progress.safeParse({ ...previous.data, seen: 0, processed: 0, events_created: 0 });
        }
      }
      let state: z.infer<typeof progress>;
      if (parsed.success) {
        state = parsed.data;
        if (!state.pending.length && state.nextPage) {
          const page = await loadPage(gmail, state.window, state.historyBase, state.nextPage);
          state = { ...state, pending: page.ids, nextPage: page.nextPage, historyEnd: page.end };
        }
      } else {
        let window = account?.history_id ? 0 : 365;
        let base: string = account?.history_id ?? (await gmail.get("profile", profile)).historyId;
        let page;
        try {
          page = await loadPage(gmail, window, base);
        } catch (error) {
          if (window !== 0 || !(error instanceof GmailRequestError) || error.status !== 404) throw error;
          window = 30;
          base = (await gmail.get("profile", profile)).historyId;
          page = await loadPage(gmail, window, base);
        }
        state = { pending: page.ids, nextPage: page.nextPage, historyBase: base, historyEnd: page.end, window, seen: 0, processed: 0, events_created: 0 };
      }
      const chunk = state.pending.splice(0, state.window > 0 ? Math.min(25, 500 - state.seen) : 25);
      const rows = [];
      for (const id of chunk) {
        try {
          rows.push(await readMessage(gmail, id));
        } catch (error) {
          if (!(error instanceof GmailRequestError) || ![404, 410].includes(error.status)) throw error;
        }
      }
      rows.sort((a, b) => a.received_at.localeCompare(b.received_at));
      state.processed += await insertMail(db, studentId, rows);
      state.seen += chunk.length;
      const complete = !state.pending.length && !state.nextPage;
      const capped = state.window > 0 && state.seen >= 500;
      if (complete || capped) {
        if (complete) await recordSyncCheckpoint(db, studentId, state.historyEnd, state.window > 0);
        const extraction = await processQueuedMail(studentId, 60, deadline - 30000);
        state.events_created += extraction.created;
        await update({
          status: "succeeded", payload: state, finished_at: new Date().toISOString(),
          last_error: extraction.delayed ? "LLM_UNAVAILABLE" : extraction.capped ? "EXTRACTION_LIMIT" : null,
        });
        return;
      }
      await update({ status: "queued", payload: state, attempts: 0, run_after: new Date().toISOString() });
    } catch (error) {
      const revoked = error instanceof AppError && error.code === "GMAIL_REVOKED";
      if (revoked) await markGmailRevoked(db, studentId);
      const attempts = job.attempts + 1;
      const terminal = revoked || attempts >= 3;
      await update({
        attempts,
        status: terminal ? "failed" : "queued",
        last_error: revoked ? "GMAIL_REVOKED" : "SYNC_DELAYED",
        run_after: new Date(Date.now() + 60000 * attempts).toISOString(),
        finished_at: terminal ? new Date().toISOString() : null,
      });
      return;
    }
  }
}
