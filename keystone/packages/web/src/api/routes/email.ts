import { desc, eq } from "drizzle-orm";
import { db } from "../database";
import * as s from "../database/schema";
import { landlordOnly } from "../middleware/auth";
import { appBase, emailEnabled, sendMail } from "../services/email";

export const email = {
  status: landlordOnly.handler(async () => {
    const from = process.env.EMAIL_FROM || "";
    return { configured: emailEnabled(), from, testSender: /@resend\.dev>?$/i.test(from.trim()) };
  }),

  log: landlordOnly.handler(async ({ context }) => db.select().from(s.emailLog).where(eq(s.emailLog.landlordId, context.lid)).orderBy(desc(s.emailLog.createdAt)).limit(50)),

  test: landlordOnly.handler(async ({ context }) =>
    sendMail({
      landlordId: context.lid,
      to: context.user.email,
      subject: "Keystone test email",
      kind: "test",
      heading: "Email is working",
      paragraphs: [`Hi ${context.user.name.split(" ")[0] || "there"}, this is a test from your Keystone workspace. Invites, lease signing, rent reminders, receipts and landlord alerts will look like this.`],
      details: [["Sent to", context.user.email]],
      cta: { label: "Open Keystone", url: `${appBase(context.headers)}/dashboard` },
    }),
  ),
};
