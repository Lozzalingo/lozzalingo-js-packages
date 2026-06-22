/**
 * Sync Bookings Script
 *
 * Two tasks:
 *   1. Import missing BucketRace bookings from the BR CRM Google Sheet
 *   2. Sync totalBookings cached counts on Customer for both databases
 *
 * The original import-crm.js filtered out bookings with rating < 4.
 * This script imports ALL remaining bookings regardless of rating.
 *
 * Usage:
 *   node packages/crm/scripts/sync-bookings.js                    # dry run
 *   node packages/crm/scripts/sync-bookings.js --execute          # write to DB
 *   node packages/crm/scripts/sync-bookings.js --execute --step=1 # import bookings only
 *   node packages/crm/scripts/sync-bookings.js --execute --step=2 # sync counts only
 */

const mysql = require("mysql2/promise");
const { google } = require("googleapis");
const path = require("path");
const crypto = require("crypto");

// -- Config -------------------------------------------------------------------

const CREDS_PATH = path.resolve(
  __dirname,
  "../../../../creds/plucky-catfish-452808-f1-69c67e3ecdd1.json"
);
const BR_SPREADSHEET_ID = "1hl7Va8beBmquuUORzULhB61ShTXla7TfUpk3N6rKt5s";

const DRY_RUN = !process.argv.includes("--execute");
const STEP_ARG = process.argv.find((a) => a.startsWith("--step="));
const ONLY_STEP = STEP_ARG ? parseInt(STEP_ARG.split("=")[1], 10) : null;

const STATUS_MAP = {
  Lead: "ENQUIRY",
  "Contract Sent": "INVOICE_SENT",
  Won: "CONFIRMED",
  Lost: "LOST",
  "Qualified Out": "QUALIFIED_OUT",
  Paid: "PAID",
};

// -- Helpers ------------------------------------------------------------------

function cleanEmail(email) {
  if (!email) return null;
  return email.trim().toLowerCase();
}

function cleanStr(val) {
  if (!val) return null;
  const trimmed = val.trim();
  return trimmed || null;
}

function parseUKDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function uuid() {
  return crypto.randomUUID();
}

function parseRow(headers, row) {
  const obj = {};
  headers.forEach((h, i) => {
    obj[h] = row[i] || null;
  });
  return obj;
}

// -- Step 1: Import missing BR bookings ---------------------------------------

async function step1ImportBookings(conn, sheets) {
  console.log("\n[SyncBookings] Step 1: Importing missing BucketRace bookings...");

  // Get existing booking numbers
  const [dbBookings] = await conn.query(
    "SELECT bookingNumber FROM bucketrace.Booking"
  );
  const existingRefs = new Set(dbBookings.map((b) => b.bookingNumber));
  console.log(`[SyncBookings] ${existingRefs.size} bookings already in DB`);

  // Build customer email -> id map
  const [customers] = await conn.query(
    "SELECT id, LOWER(email) as email FROM bucketrace.Customer"
  );
  const customerMap = new Map(customers.map((c) => [c.email, c.id]));

  let created = 0;
  let skipped = 0;
  let errors = 0;

  // Process Work Sheet
  for (const sheetName of ["Work Sheet", "Stripe", "Private Game Enquiry Sheet"]) {
    console.log(`[SyncBookings] Fetching "${sheetName}"...`);
    const resp = await sheets.spreadsheets.values.get({
      spreadsheetId: BR_SPREADSHEET_ID,
      range: `'${sheetName}'!A1:AZ2000`,
    });
    const rows = resp.data.values || [];
    if (rows.length < 2) continue;

    const headers = rows[0];

    for (let i = 1; i < rows.length; i++) {
      const row = parseRow(headers, rows[i]);
      const bookingRef = cleanStr(row["Booking Ref"]);
      const email = cleanEmail(row["Email Address"]);
      const status = cleanStr(row["Status"]);

      if (!bookingRef || !bookingRef.startsWith("#")) continue;
      if (existingRefs.has(bookingRef)) {
        skipped++;
        continue;
      }

      const mappedStatus = STATUS_MAP[status] || "ENQUIRY";
      const eventDate = parseUKDate(row["Start Date"]);
      const firstName = cleanStr(row["First Name"]) || "Unknown";
      const lastName = cleanStr(row["Last Name"]) || "";
      const phone = cleanStr(row["Phone"]);
      const company = cleanStr(row["Organisation Name"]);
      const gameName = cleanStr(row["Which Game?"]);
      const groupSize = parseInt(row["Group Size"]) || 1;
      const eventTime = cleanStr(row["Start Time (BST)"]);
      const notes = [cleanStr(row["Notes"]), cleanStr(row["Follow Up Action"])].filter(Boolean).join(" | ") || null;
      const location = cleanStr(row["Location"]) || cleanStr(row["London Locations"]);
      const region = cleanStr(row["Region"]);
      const platform = cleanStr(row["Platform"]);
      const groupType = cleanStr(row["Group Type"]);
      const audience = cleanStr(row["Audience"]);
      const source = cleanStr(row["Source"]) || cleanStr(row["Channel"]) || "spreadsheet-import";
      const jobTitle = cleanStr(row["Job Title"]);
      const message = cleanStr(row["Message"]);
      const customerId = email ? customerMap.get(email) : null;

      // Parse financials
      const totalAmount = row["Total"] ? Math.round(parseFloat(row["Total"].replace(/[^0-9.]/g, "")) * 100) || null : null;
      const bookingType = sheetName === "Private Game Enquiry Sheet" ? "PRIVATE" : "PRIVATE";

      try {
        if (!DRY_RUN) {
          await conn.query(
            `INSERT INTO bucketrace.Booking (id, bookingNumber, customerId, customerName, customerEmail, customerPhone, companyName, groupSize, eventDate, eventTime, status, totalAmount, notes, source, bookingType, locationName, groupType, message, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              uuid(), bookingRef, customerId,
              `${firstName} ${lastName}`.trim(),
              email || "unknown@unknown.com",
              phone, company, groupSize,
              eventDate || new Date(),
              eventTime ? eventTime.substring(0, 5) : null,
              mappedStatus, totalAmount, notes, source,
              bookingType, location, groupType, message,
            ]
          );
        }
        existingRefs.add(bookingRef);
        created++;
      } catch (err) {
        errors++;
        if (errors <= 10) {
          console.error(`[SyncBookings] Error inserting ${bookingRef}:`, err.message);
        }
      }
    }
  }

  console.log(`[SyncBookings] Bookings created: ${created}, skipped (already exist): ${skipped}, errors: ${errors}`);
}

// -- Step 2: Sync totalBookings counts ----------------------------------------

async function step2SyncCounts(conn) {
  console.log("\n[SyncBookings] Step 2: Syncing totalBookings counts...");

  for (const db of ["bucketrace", "fat_big_quiz"]) {
    // Count actual bookings per customer
    const [rows] = await conn.query(
      `SELECT c.id, c.totalBookings as cached, COUNT(b.id) as actual
       FROM ${db}.Customer c
       LEFT JOIN ${db}.Booking b ON b.customerId = c.id
       GROUP BY c.id
       HAVING c.totalBookings != COUNT(b.id)`
    );

    console.log(`[SyncBookings] ${db}: ${rows.length} customers with mismatched totalBookings`);

    let updated = 0;
    for (const row of rows) {
      if (!DRY_RUN) {
        await conn.query(
          `UPDATE ${db}.Customer SET totalBookings = ?, updatedAt = NOW() WHERE id = ?`,
          [row.actual, row.id]
        );
      }
      updated++;
    }

    console.log(`[SyncBookings] ${db}: Updated ${updated} customer totalBookings counts`);

    // Also sync totalSpent from invoices if they exist
    try {
      const [invoiceRows] = await conn.query(
        `SELECT c.id, c.totalSpent as cached, COALESCE(SUM(i.totalAmountPence), 0) as actual
         FROM ${db}.Customer c
         LEFT JOIN ${db}.Booking b ON b.customerId = c.id
         LEFT JOIN ${db}.Invoice i ON i.bookingId = b.id AND i.status = 'PAID'
         GROUP BY c.id
         HAVING c.totalSpent != COALESCE(SUM(i.totalAmountPence), 0)`
      );
      console.log(`[SyncBookings] ${db}: ${invoiceRows.length} customers with mismatched totalSpent`);

      for (const row of invoiceRows) {
        if (!DRY_RUN) {
          await conn.query(
            `UPDATE ${db}.Customer SET totalSpent = ?, updatedAt = NOW() WHERE id = ?`,
            [row.actual, row.id]
          );
        }
      }
    } catch (err) {
      // Invoice table might not exist or have different structure
      console.log(`[SyncBookings] ${db}: Skipping totalSpent sync (${err.message.split('\n')[0]})`);
    }
  }
}

// -- Main ---------------------------------------------------------------------

async function main() {
  console.log("[SyncBookings] ═══════════════════════════════════════════════");
  console.log("[SyncBookings] Booking Sync");
  console.log(`[SyncBookings] Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  if (ONLY_STEP) console.log(`[SyncBookings] Running step ${ONLY_STEP} only`);
  console.log("[SyncBookings] ═══════════════════════════════════════════════\n");

  const conn = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
  });

  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheetsApi = google.sheets({ version: "v4", auth });

  try {
    const shouldRun = (step) => !ONLY_STEP || ONLY_STEP === step;

    if (shouldRun(1)) await step1ImportBookings(conn, sheetsApi);
    if (shouldRun(2)) await step2SyncCounts(conn);

    console.log("\n[SyncBookings] Done.");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("[SyncBookings] Fatal error:", err);
  process.exit(1);
});
