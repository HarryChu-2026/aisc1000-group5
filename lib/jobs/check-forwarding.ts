import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/api/errors";
import { openGmail } from "@/lib/jobs/gmail-account";

const messageList = z.object({ messages: z.array(z.object({ id: z.string() })).optional() });
const metadata = z.object({ internalDate: z.coerce.number() });

export async function checkForwarding(studentId: string, after: string) {
  const gmail = await openGmail(studentId);
  const confirmedAt = Date.parse(after);
  const signal = AbortSignal.timeout(9000);
  const operation = async () => {
    const { messages } = await gmail.get("messages", messageList, new URLSearchParams({
      q: `after:${Math.floor(confirmedAt / 1000)} -in:chats`,
      maxResults: "5",
    }));
    for (const { id } of messages ?? []) {
      if (signal.aborted) return false;
      const item = await gmail.get(`messages/${encodeURIComponent(id)}`, metadata,
        new URLSearchParams({ format: "metadata", fields: "internalDate" }));
      if (item.internalDate > confirmedAt) return true;
    }
    return false;
  };
  const timeout = new Promise<never>((_, reject) => signal.addEventListener("abort",
    () => reject(new AppError("INTERNAL", "Gmail verification timed out.")), { once: true }));
  return Promise.race([operation(), timeout]);
}
