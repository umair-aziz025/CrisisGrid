import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const FROM = "CrisisGrid <no-reply@aetheryx.me>";

export type NewRequestEmailData = {
  requestId: number;
  type: "MEDICAL" | "FOOD_WATER" | "RESCUE";
  description: string;
  lat: number;
  lng: number;
  createdAt: string;
  requesterEmail: string | null;
  requesterName: string | null;
};

export type ClaimNotificationEmailData = {
  requestId: number;
  type: "MEDICAL" | "FOOD_WATER" | "RESCUE";
  description: string;
  lat: number;
  lng: number;
  createdAt: string;
  requesterEmail: string | null;
  requesterName: string | null;
  volunteerEmail: string | null;
  volunteerName: string | null;
};

function typeLabel(type: string) {
  return type === "MEDICAL" ? "Medical" : type === "FOOD_WATER" ? "Food / Water" : "Rescue";
}

function typeColor(type: string) {
  return type === "MEDICAL" ? "#ef4444" : type === "FOOD_WATER" ? "#3b82f6" : "#f59e0b";
}

function typeBadgeBg(type: string) {
  return type === "MEDICAL" ? "#fef2f2" : type === "FOOD_WATER" ? "#eff6ff" : "#fffbeb";
}

function mapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function ensureResend() {
  if (!resend) {
    throw new Error("Missing RESEND_API_KEY");
  }
  return resend;
}

function emailBase(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr><td align="center">
      <table width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;max-width:580px;width:100%;">
        <tr><td style="background:#0f172a;padding:20px 32px;text-align:left;">
          <span style="color:#38bdf8;font-size:18px;font-weight:700;letter-spacing:-0.5px;">● CrisisGrid</span>
          <span style="color:#94a3b8;font-size:12px;margin-left:8px;">Real-time emergency coordination</span>
        </td></tr>
        <tr><td style="padding:32px;">${body}</td></tr>
        <tr><td style="background:#f1f5f9;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:11px;">This is an automated alert from CrisisGrid. Do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function requestCard(d: NewRequestEmailData) {
  const color = typeColor(d.type);
  const badgeBg = typeBadgeBg(d.type);
  const label = typeLabel(d.type);
  const time = new Date(d.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  return `
    <div style="border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin-bottom:20px;background:#fafafa;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <span style="background:${badgeBg};color:${color};border:1px solid ${color}33;border-radius:20px;padding:3px 10px;font-size:12px;font-weight:700;">${label}</span>
        <span style="color:#94a3b8;font-size:12px;">Request #${d.requestId}</span>
      </div>
      <p style="margin:0 0 8px;color:#1e293b;font-size:15px;font-weight:600;">${d.description}</p>
      <p style="margin:0 0 4px;color:#64748b;font-size:12px;">📍 ${d.lat.toFixed(5)}, ${d.lng.toFixed(5)} &nbsp;·&nbsp; ${time}</p>
      ${d.requesterName ? `<p style="margin:4px 0 0;color:#64748b;font-size:12px;">👤 Submitted by ${d.requesterName}</p>` : ""}
    </div>
    <div style="text-align:center;margin:20px 0;">
      <a href="${mapsLink(d.lat, d.lng)}" style="background:#0f172a;color:#ffffff;text-decoration:none;border-radius:8px;padding:10px 22px;font-size:13px;font-weight:600;display:inline-block;">View on Map</a>
    </div>`;
}

export async function sendRequesterConfirmation(to: string, d: NewRequestEmailData) {
  const label = typeLabel(d.type);
  const color = typeColor(d.type);
  try {
    await ensureResend().emails.send({
      from: FROM,
      to,
      subject: `✅ Your ${label} request has been received — CrisisGrid #${d.requestId}`,
      html: emailBase(
        `Request Received — CrisisGrid`,
        `<h2 style="margin:0 0 8px;color:#1e293b;font-size:20px;font-weight:700;">Your request has been received</h2>
        <p style="margin:0 0 24px;color:#64748b;font-size:14px;">Our team and nearby volunteers have been alerted. Someone will respond as soon as possible.</p>
        ${requestCard(d)}
        <p style="color:#64748b;font-size:13px;margin:0;">If your situation changes or becomes more urgent, please submit a new request or call emergency services immediately.</p>`
      ),
    });
  } catch (err) {
    console.error("sendRequesterConfirmation error:", err);
  }
}

export async function sendStaffAlert(staffEmails: string[], d: NewRequestEmailData) {
  if (staffEmails.length === 0) return;
  const label = typeLabel(d.type);
  const color = typeColor(d.type);
  try {
    await ensureResend().emails.send({
      from: FROM,
      to: staffEmails,
      subject: `🚨 New ${label} Request #${d.requestId} — CrisisGrid`,
      html: emailBase(
        `New ${label} Request — CrisisGrid`,
        `<div style="border-left:4px solid ${color};padding-left:12px;margin-bottom:20px;">
          <h2 style="margin:0 0 4px;color:#1e293b;font-size:20px;font-weight:700;">New emergency request submitted</h2>
          <p style="margin:0;color:#64748b;font-size:13px;">Immediate attention may be required.</p>
        </div>
        ${requestCard(d)}
        <p style="color:#64748b;font-size:13px;margin:0;">Log in to the Command Center to assign a volunteer or take action.</p>`
      ),
    });
  } catch (err) {
    console.error("sendStaffAlert error:", err);
  }
}

export async function sendVolunteerAlert(volunteerEmails: string[], d: NewRequestEmailData) {
  if (volunteerEmails.length === 0) return;
  const label = typeLabel(d.type);
  const color = typeColor(d.type);
  try {
    await ensureResend().emails.send({
      from: FROM,
      to: volunteerEmails,
      subject: `⚡ ${label} request nearby — Can you help? #${d.requestId}`,
      html: emailBase(
        `Volunteer Alert — CrisisGrid`,
        `<div style="border-left:4px solid ${color};padding-left:12px;margin-bottom:20px;">
          <h2 style="margin:0 0 4px;color:#1e293b;font-size:20px;font-weight:700;">Someone needs your help nearby</h2>
          <p style="margin:0;color:#64748b;font-size:13px;">A new ${label.toLowerCase()} request has been submitted in your area.</p>
        </div>
        ${requestCard(d)}
        <p style="color:#64748b;font-size:13px;margin:0;">Log in to CrisisGrid to claim this request and get directions.</p>`
      ),
    });
  } catch (err) {
    console.error("sendVolunteerAlert error:", err);
  }
}

export async function sendClaimedRequesterAlert(to: string, d: ClaimNotificationEmailData) {
  const label = typeLabel(d.type);
  const color = typeColor(d.type);
  try {
    await ensureResend().emails.send({
      from: FROM,
      to,
      subject: `✅ Your ${label} request has been claimed — CrisisGrid #${d.requestId}`,
      html: emailBase(
        `Request Claimed — CrisisGrid`,
        `<div style="border-left:4px solid ${color};padding-left:12px;margin-bottom:20px;">
          <h2 style="margin:0 0 4px;color:#1e293b;font-size:20px;font-weight:700;">Your request has been accepted</h2>
          <p style="margin:0;color:#64748b;font-size:13px;">A volunteer is now assigned to help.</p>
        </div>
        ${requestCard(d)}
        <div style="margin-top:16px;padding:14px 16px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;">
          <p style="margin:0 0 4px;color:#1e293b;font-size:13px;font-weight:700;">Volunteer assigned</p>
          <p style="margin:0;color:#64748b;font-size:13px;">${d.volunteerName ?? "A volunteer"}${d.volunteerEmail ? ` (${d.volunteerEmail})` : ""}</p>
        </div>`
      ),
    });
  } catch (err) {
    console.error("sendClaimedRequesterAlert error:", err);
  }
}

export async function sendClaimedVolunteerAlert(to: string, d: ClaimNotificationEmailData) {
  const label = typeLabel(d.type);
  const color = typeColor(d.type);
  try {
    await ensureResend().emails.send({
      from: FROM,
      to,
      subject: `🚑 You claimed a ${label} request — CrisisGrid #${d.requestId}`,
      html: emailBase(
        `Task Claimed — CrisisGrid`,
        `<div style="border-left:4px solid ${color};padding-left:12px;margin-bottom:20px;">
          <h2 style="margin:0 0 4px;color:#1e293b;font-size:20px;font-weight:700;">Task accepted successfully</h2>
          <p style="margin:0;color:#64748b;font-size:13px;">The requester has been notified.</p>
        </div>
        ${requestCard(d)}
        <p style="color:#64748b;font-size:13px;margin:0;">Proceed to the location and keep the requester updated if needed.</p>`
      ),
    });
  } catch (err) {
    console.error("sendClaimedVolunteerAlert error:", err);
  }
}

export type ResolvedEmailData = {
  requestId: number | string;
  type: "MEDICAL" | "FOOD_WATER" | "RESCUE";
  description: string;
  volunteerName: string | null;
  volunteerEmail: string | null;
};

export async function sendCrisisResolved(to: string, d: ResolvedEmailData) {
  const label = typeLabel(d.type);
  const color = typeColor(d.type);
  try {
    await ensureResend().emails.send({
      from: FROM,
      to,
      subject: `✅ Your ${label} request has been resolved — CrisisGrid #${d.requestId}`,
      html: emailBase(
        `Request Resolved — CrisisGrid`,
        `<div style="border-left:4px solid ${color};padding-left:12px;margin-bottom:20px;">
          <h2 style="margin:0 0 4px;color:#1e293b;font-size:20px;font-weight:700;">Your request has been resolved</h2>
          <p style="margin:0;color:#64748b;font-size:13px;">${d.volunteerName ?? "A volunteer"} marked your ${label.toLowerCase()} request as completed.</p>
        </div>
        <div style="padding:16px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;margin-bottom:16px;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Request</p>
          <p style="margin:0;color:#1e293b;font-size:14px;">${d.description}</p>
        </div>
        <p style="color:#64748b;font-size:13px;margin:0;">If something still needs attention, you can submit a new request from your dashboard.</p>`
      ),
    });
  } catch (err) {
    console.error("sendCrisisResolved error:", err);
  }
}
