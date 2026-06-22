/**
 * CRM Import: Shared Marketing Sheet -> BucketRace Database
 *
 * Imports data from the shared marketing Google Sheet into the BucketRace
 * CRM tables. Handles:
 *   1. Backfill customer numbers for existing customers (no number yet)
 *   2. Import Master Sheet customers (create new, enrich existing)
 *   3. Import Unsubscribed sheet (mark as UNSUBSCRIBED)
 *   4. Create CustomerActivity rows from product data in sheet
 *   5. Import Campaign Results into Campaign table
 *   6. Import Campaign Logs (16,861 sends) into CampaignSend
 *   7. Import Marketing Preferences Log
 *   8. Recalculate scores for all customers
 *
 * Usage:
 *   node packages/crm/scripts/import-marketing-sheet.js              # dry run
 *   node packages/crm/scripts/import-marketing-sheet.js --execute    # write to DB
 *   node packages/crm/scripts/import-marketing-sheet.js --execute --skip-scores  # skip score calc
 *
 * Requires:
 *   - MySQL running with bucketrace database
 *   - googleapis npm package
 *   - Google service account credentials
 */

const { google } = require("googleapis");
const path = require("path");
const mysql = require("mysql2/promise");

// ── Config ──────────────────────────────────────────────────────────────────

const CREDS_PATH = path.resolve(
  __dirname,
  "../../../../creds/plucky-catfish-452808-f1-69c67e3ecdd1.json"
);
const SPREADSHEET_ID = "1lMvmEKqPadPavaG6qp6WQLngTnmBgUs4hSaoKlsMBeQ";
const DRY_RUN = !process.argv.includes("--execute");
const SKIP_SCORES = process.argv.includes("--skip-scores");
const PREFIX = "BR";
const DB_NAME = "bucketrace";

// ── Column mappings for Master Sheet (52 columns, A-AZ) ─────────────────────

const COL = {
  TIMESTAMP: 0,
  EMAIL: 1,
  FIRST_NAME: 2,
  LAST_NAME: 3,
  DOB: 4,
  PHONE: 5,
  ORGANISATION: 6,
  JOB_TITLE: 7,
  HOW_HEARD: 8,
  SOURCE: 9,
  CHANNEL: 10,
  GROUP_TYPE: 11,
  PLATFORM: 12,
  PRODUCT_NAME: 13,
  PRODUCT_CATEGORY: 14,
  VERSION: 15,
  EDITION: 16,
  DEMOGRAPHIC: 17, // skip - deleted
  LOCATION: 18,
  REGION: 19,
  COUNTRY: 20,
  AUDIENCE: 21,
  EVENT_DATE: 22,
  PURCHASE_TYPE: 23,
  TEAM_NAME: 24,
  TICKETS_PURCHASED: 25,
  VOUCHER_CODE: 26,
  SECURITY_CODE: 27, // skip
  REFERRAL_NAME: 28,
  REFERRAL_EMAIL: 29,
  TERMS: 30,
  PRIVACY: 31,
  PRODUCT_LOG: 32, // derived - skip
  LAST_PURCHASE_AMOUNT: 33,
  TOTAL_SPEND: 34,
  TEAM_NAME_LOG: 35, // derived - skip
  MARKETING_LOG: 36, // derived - skip
  USER_RATING: 37, // old marketing score - skip
  TIMEZONE: 38,
  ENQUIRY_REGION: 39,
  IP_ADDRESS: 40,
  TOTAL_PURCHASES: 41,
  MARKETING_PREFS: 42,
  PREF_VIRTUAL: 43,
  PREF_REAL_WORLD: 44,
  PREF_HYBRID: 45,
  PREF_FAT_BIG_QUIZ: 46,
  PREF_SCAVENGER_HUNTS: 47,
  PREF_WHACKY_WAGER: 48,
  PREF_OFFICE_OLYMPICS: 49,
  PREF_GAMIFIED_PARTIES: 50,
  PREF_FREE_DOWNLOADABLES: 51,
};

// Preference column index -> preference name
const PREF_COLUMNS = {
  [COL.PREF_VIRTUAL]: "Virtual Games",
  [COL.PREF_REAL_WORLD]: "Real World Games",
  [COL.PREF_HYBRID]: "Hybrid Games",
  [COL.PREF_FAT_BIG_QUIZ]: "Fat Big Quiz",
  [COL.PREF_SCAVENGER_HUNTS]: "Scavenger Hunts",
  [COL.PREF_WHACKY_WAGER]: "Whacky Wager Betting Night",
  [COL.PREF_OFFICE_OLYMPICS]: "Office Olympics",
  [COL.PREF_GAMIFIED_PARTIES]: "Gamified Parties",
  [COL.PREF_FREE_DOWNLOADABLES]: "Free Downloadables",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function cleanEmail(email) {
  if (!email) return null;
  const cleaned = email.trim().toLowerCase();
  // Basic validation
  if (!cleaned.includes("@") || !cleaned.includes(".")) return null;
  return cleaned;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  // Handle DD/MM/YYYY HH:MM:SS format
  const parts = dateStr.split(" ");
  const datePart = parts[0];
  const timePart = parts[1] || "00:00:00";

  // Try DD/MM/YYYY
  const dParts = datePart.split("/");
  if (dParts.length === 3) {
    const [day, month, year] = dParts;
    const d = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${timePart}`);
    if (!isNaN(d.getTime())) return d;
  }

  // Try ISO / native parsing
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function parsePence(amountStr) {
  if (!amountStr) return 0;
  // Remove currency symbols and whitespace
  const cleaned = amountStr.replace(/[^0-9.]/g, "");
  const amount = parseFloat(cleaned);
  if (isNaN(amount)) return 0;
  return Math.round(amount * 100);
}

function uuid() {
  // Simple UUID v4 generator
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateCustomerNumber(seq) {
  return `#${PREFIX}${String(seq).padStart(4, "0")}`;
}

function escapeStr(val) {
  if (val === null || val === undefined) return "NULL";
  return `'${String(val).replace(/'/g, "\\'").replace(/\\/g, "\\\\")}'`;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("[Import] CRM Import: Shared Marketing Sheet -> BucketRace");
  console.log("[Import] Mode:", DRY_RUN ? "DRY RUN (pass --execute to write)" : "LIVE - writing to database");
  console.log("");

  // ── Connect to Google Sheets ────────────────────────────────────────────

  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  // ── Connect to MySQL ────────────────────────────────────────────────────

  const db = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: DB_NAME,
    multipleStatements: true,
  });

  const stats = {
    customerNumbersBackfilled: 0,
    customersCreated: 0,
    customersEnriched: 0,
    customersUnsubscribed: 0,
    activitiesCreated: 0,
    campaignsCreated: 0,
    campaignSendsCreated: 0,
    campaignSendsSkipped: 0,
    preferencesCreated: 0,
    scoresCalculated: 0,
    errors: [],
  };

  // ── Step 1: Backfill customer numbers for existing customers ────────────

  console.log("=== Step 1: Backfill customer numbers ===\n");

  const [existingCustomers] = await db.query(
    "SELECT id, email, customerNumber FROM Customer ORDER BY createdAt ASC"
  );

  // Find the current highest customer number
  const [maxNumRow] = await db.query(
    `SELECT customerNumber FROM Customer
     WHERE customerNumber IS NOT NULL AND customerNumber LIKE '#${PREFIX}%'
     ORDER BY customerNumber DESC LIMIT 1`
  );

  let nextSeq = 1;
  if (maxNumRow.length > 0 && maxNumRow[0].customerNumber) {
    const numStr = maxNumRow[0].customerNumber.replace(`#${PREFIX}`, "");
    nextSeq = parseInt(numStr, 10) + 1;
    if (isNaN(nextSeq)) nextSeq = 1;
  }

  const needsNumber = existingCustomers.filter((c) => !c.customerNumber);
  console.log(`[Import] ${existingCustomers.length} existing customers, ${needsNumber.length} need customer numbers`);
  console.log(`[Import] Next sequence number: ${nextSeq}`);

  if (!DRY_RUN) {
    for (const customer of needsNumber) {
      const number = generateCustomerNumber(nextSeq);
      await db.query("UPDATE Customer SET customerNumber = ? WHERE id = ?", [number, customer.id]);
      nextSeq++;
      stats.customerNumbersBackfilled++;
    }
    console.log(`[Import] Backfilled ${stats.customerNumbersBackfilled} customer numbers`);
  } else {
    console.log(`[Import] Would backfill ${needsNumber.length} customer numbers (#${PREFIX}${String(nextSeq).padStart(4, "0")} to #${PREFIX}${String(nextSeq + needsNumber.length - 1).padStart(4, "0")})`);
    nextSeq += needsNumber.length;
  }

  // Build email -> id lookup for existing customers
  const emailToId = new Map();
  for (const c of existingCustomers) {
    if (c.email) emailToId.set(c.email.toLowerCase(), c.id);
  }

  // ── Step 2: Fetch Google Sheet data ─────────────────────────────────────

  console.log("\n=== Step 2: Fetch Google Sheet data ===\n");

  console.log("[Import] Fetching Master Sheet...");
  const masterResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "'Master Sheet'!A2:AZ10000",
  });
  const masterRows = masterResp.data.values || [];
  console.log(`[Import] Master Sheet: ${masterRows.length} rows`);

  console.log("[Import] Fetching Unsubscribed Sheet...");
  const unsubResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "'Unsubscribed'!A2:AZ10000",
  });
  const unsubRows = unsubResp.data.values || [];
  console.log(`[Import] Unsubscribed: ${unsubRows.length} rows`);

  console.log("[Import] Fetching Campaign Results...");
  const campaignResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "'Campaign Results'!A2:G100",
  });
  const campaignRows = campaignResp.data.values || [];
  console.log(`[Import] Campaign Results: ${campaignRows.length} rows`);

  console.log("[Import] Fetching Marketing Campaign Logs...");
  const logsResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "'Marketing Campaign Logs'!A2:C20000",
  });
  const logRows = logsResp.data.values || [];
  console.log(`[Import] Campaign Logs: ${logRows.length} rows`);

  console.log("[Import] Fetching Marketing Preferences Log...");
  const prefsResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "'Marketing Preferences Log'!A2:E500",
  });
  const prefRows = prefsResp.data.values || [];
  console.log(`[Import] Preferences Log: ${prefRows.length} rows`);

  // ── Step 3: Deduplicate Master Sheet rows by email ──────────────────────

  console.log("\n=== Step 3: Process Master Sheet customers ===\n");

  // Deduplicate: keep the row with the most data per email
  const masterByEmail = new Map();
  for (const row of masterRows) {
    const email = cleanEmail(row[COL.EMAIL]);
    if (!email) continue;

    const existing = masterByEmail.get(email);
    if (!existing) {
      masterByEmail.set(email, row);
    } else {
      // Keep the row with more non-empty fields
      const existingCount = existing.filter(Boolean).length;
      const newCount = row.filter(Boolean).length;
      if (newCount > existingCount) {
        masterByEmail.set(email, row);
      }
    }
  }

  console.log(`[Import] ${masterRows.length} rows -> ${masterByEmail.size} unique emails`);

  // Build unsubscribed set
  const unsubEmails = new Set();
  for (const row of unsubRows) {
    const email = cleanEmail(row[1]); // Col B = email
    if (email) unsubEmails.add(email);
  }
  console.log(`[Import] ${unsubEmails.size} unsubscribed emails`);

  // ── Step 4: Create/enrich customers from Master Sheet ───────────────────

  console.log("\n=== Step 4: Create/enrich customers ===\n");

  let created = 0;
  let enriched = 0;
  let unsubscribed = 0;
  const activitiesToCreate = [];
  const preferencesToCreate = [];

  for (const [email, row] of masterByEmail) {
    const isUnsub = unsubEmails.has(email);
    const existingId = emailToId.get(email);

    const firstName = (row[COL.FIRST_NAME] || "").trim();
    const lastName = (row[COL.LAST_NAME] || "").trim();
    const phone = (row[COL.PHONE] || "").trim() || null;
    const company = (row[COL.ORGANISATION] || "").trim() || null;
    const jobTitle = (row[COL.JOB_TITLE] || "").trim() || null;
    const dob = parseDate(row[COL.DOB]);
    const country = (row[COL.COUNTRY] || "").trim() || null;
    const region = (row[COL.REGION] || row[COL.ENQUIRY_REGION] || "").trim() || null;
    const ipAddress = (row[COL.IP_ADDRESS] || "").trim() || null;
    const source = (row[COL.SOURCE] || "").trim() || null;
    const referralName = (row[COL.REFERRAL_NAME] || "").trim() || null;
    const referralEmail = (row[COL.REFERRAL_EMAIL] || "").trim() || null;
    const timestamp = parseDate(row[COL.TIMESTAMP]);
    const totalSpent = parsePence(row[COL.TOTAL_SPEND]);
    const totalPurchases = parseInt(row[COL.TOTAL_PURCHASES]) || 0;
    const termsAccepted = row[COL.TERMS] === "Yes" || row[COL.TERMS] === "TRUE";
    const privacyAccepted = row[COL.PRIVACY] === "Yes" || row[COL.PRIVACY] === "TRUE";

    const status = isUnsub ? "UNSUBSCRIBED" : "ACTIVE";

    if (existingId) {
      // Enrich existing customer with sparse fields
      if (!DRY_RUN) {
        await db.query(
          `UPDATE Customer SET
            phone = COALESCE(phone, ?),
            company = COALESCE(company, ?),
            jobTitle = COALESCE(jobTitle, ?),
            dateOfBirth = COALESCE(dateOfBirth, ?),
            country = COALESCE(country, ?),
            region = COALESCE(region, ?),
            ipAddress = COALESCE(ipAddress, ?),
            referralName = COALESCE(referralName, ?),
            referralEmail = COALESCE(referralEmail, ?),
            totalSpent = GREATEST(totalSpent, ?),
            totalBookings = GREATEST(totalBookings, ?),
            status = IF(? = 'UNSUBSCRIBED', 'UNSUBSCRIBED', status),
            termsAcceptedAt = COALESCE(termsAcceptedAt, ?),
            privacyAcceptedAt = COALESCE(privacyAcceptedAt, ?),
            lastActivityAt = COALESCE(lastActivityAt, ?),
            updatedAt = NOW()
          WHERE id = ?`,
          [
            phone, company, jobTitle, dob, country, region, ipAddress,
            referralName, referralEmail,
            totalSpent, totalPurchases,
            status,
            termsAccepted ? (timestamp || new Date()) : null,
            privacyAccepted ? (timestamp || new Date()) : null,
            timestamp,
            existingId,
          ]
        );
        stats.customersEnriched++;
      }
      enriched++;

      // Use existing ID for activity/preferences
      const custId = existingId;

      // Build activity if product data exists
      if (row[COL.PRODUCT_NAME] || row[COL.PRODUCT_CATEGORY] || row[COL.CHANNEL]) {
        activitiesToCreate.push({
          customerId: custId,
          row,
          timestamp,
        });
      }

      // Build preferences
      for (const [colIdx, prefName] of Object.entries(PREF_COLUMNS)) {
        const val = row[parseInt(colIdx)];
        if (val && (val.toLowerCase() === "yes" || val.toLowerCase() === "true" || val === "1")) {
          preferencesToCreate.push({ customerId: custId, preference: prefName });
        }
      }
    } else {
      // Create new customer
      const id = uuid();
      const customerNumber = generateCustomerNumber(nextSeq);
      nextSeq++;

      if (!DRY_RUN) {
        await db.query(
          `INSERT INTO Customer (
            id, customerNumber, firstName, lastName, email, phone, company,
            jobTitle, dateOfBirth, country, region, ipAddress, source, status,
            marketingOptIn, totalSpent, totalBookings, referralName, referralEmail,
            termsAcceptedAt, privacyAcceptedAt, lastActivityAt, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            id, customerNumber,
            firstName || "Unknown", lastName || "",
            email, phone, company, jobTitle, dob,
            country, region, ipAddress,
            source || "marketing-sheet",
            status,
            !isUnsub, // marketingOptIn
            totalSpent, totalPurchases,
            referralName, referralEmail,
            termsAccepted ? (timestamp || new Date()) : null,
            privacyAccepted ? (timestamp || new Date()) : null,
            timestamp || new Date(),
            timestamp || new Date(),
          ]
        );
        stats.customersCreated++;

        // Add to lookup
        emailToId.set(email, id);
      } else {
        // Still track the ID for dry-run counting
        emailToId.set(email, id);
      }
      created++;

      if (isUnsub) unsubscribed++;

      // Build activity if product data exists
      if (row[COL.PRODUCT_NAME] || row[COL.PRODUCT_CATEGORY] || row[COL.CHANNEL]) {
        activitiesToCreate.push({
          customerId: id,
          row,
          timestamp,
        });
      }

      // Build preferences
      for (const [colIdx, prefName] of Object.entries(PREF_COLUMNS)) {
        const val = row[parseInt(colIdx)];
        if (val && (val.toLowerCase() === "yes" || val.toLowerCase() === "true" || val === "1")) {
          preferencesToCreate.push({ customerId: id, preference: prefName });
        }
      }
    }
  }

  // Also handle unsubscribed emails not in master sheet
  for (const unsubEmail of unsubEmails) {
    if (!masterByEmail.has(unsubEmail)) {
      // Find the row for this email
      const row = unsubRows.find((r) => cleanEmail(r[1]) === unsubEmail);
      if (!row) continue;

      const existingId = emailToId.get(unsubEmail);
      if (existingId) {
        // Mark existing customer as unsubscribed
        if (!DRY_RUN) {
          await db.query(
            "UPDATE Customer SET status = 'UNSUBSCRIBED', marketingOptIn = false, updatedAt = NOW() WHERE id = ?",
            [existingId]
          );
          stats.customersUnsubscribed++;
        }
        unsubscribed++;
      } else {
        // Create as unsubscribed customer
        const id = uuid();
        const customerNumber = generateCustomerNumber(nextSeq);
        nextSeq++;

        const firstName = (row[2] || "").trim();
        const lastName = (row[3] || "").trim();
        const timestamp = parseDate(row[0]);

        if (!DRY_RUN) {
          await db.query(
            `INSERT INTO Customer (
              id, customerNumber, firstName, lastName, email, source, status,
              marketingOptIn, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, 'UNSUBSCRIBED', false, ?, NOW())`,
            [
              id, customerNumber,
              firstName || "Unknown", lastName || "",
              unsubEmail,
              "marketing-sheet",
              timestamp || new Date(),
            ]
          );
          stats.customersCreated++;
          emailToId.set(unsubEmail, id);
        }
        created++;
        unsubscribed++;
      }
    }
  }

  console.log(`[Import] Customers created: ${created}`);
  console.log(`[Import] Customers enriched: ${enriched}`);
  console.log(`[Import] Customers marked unsubscribed: ${unsubscribed}`);

  // ── Step 5: Create CustomerActivity records ─────────────────────────────

  console.log("\n=== Step 5: Create CustomerActivity records ===\n");

  console.log(`[Import] ${activitiesToCreate.length} activities to create`);

  if (!DRY_RUN) {
    for (const { customerId, row, timestamp } of activitiesToCreate) {
      try {
        // Determine activity type from data
        const channel = (row[COL.CHANNEL] || "").trim();
        const purchaseType = (row[COL.PURCHASE_TYPE] || "").trim();
        const productName = (row[COL.PRODUCT_NAME] || "").trim();

        let type = "SIGNUP";
        if (purchaseType === "Hosted" || purchaseType === "Paid") {
          type = "GAME_PLAYED";
        } else if (purchaseType === "Free" || purchaseType === "Downloadable") {
          type = "FREE_CONTENT";
        } else if (productName) {
          type = "PRODUCT_USED";
        }

        const eventDate = parseDate(row[COL.EVENT_DATE]);

        await db.query(
          `INSERT INTO CustomerActivity (
            id, customerId, type, source, channel, productName, productCategory,
            platform, groupType, audience, location, region, country,
            teamName, eventDate, metadata, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuid(),
            customerId,
            type,
            (row[COL.SOURCE] || "").trim() || "marketing-sheet",
            channel || null,
            productName || null,
            (row[COL.PRODUCT_CATEGORY] || "").trim() || null,
            (row[COL.PLATFORM] || "").trim() || null,
            (row[COL.GROUP_TYPE] || "").trim() || null,
            (row[COL.AUDIENCE] || "").trim() || null,
            (row[COL.LOCATION] || "").trim() || null,
            (row[COL.REGION] || "").trim() || null,
            (row[COL.COUNTRY] || "").trim() || null,
            (row[COL.TEAM_NAME] || "").trim() || null,
            eventDate,
            JSON.stringify({
              version: (row[COL.VERSION] || "").trim() || null,
              edition: (row[COL.EDITION] || "").trim() || null,
              purchaseType: (row[COL.PURCHASE_TYPE] || "").trim() || null,
              ticketsPurchased: (row[COL.TICKETS_PURCHASED] || "").trim() || null,
              voucherCode: (row[COL.VOUCHER_CODE] || "").trim() || null,
              howHeard: (row[COL.HOW_HEARD] || "").trim() || null,
            }),
            timestamp || new Date(),
          ]
        );
        stats.activitiesCreated++;
      } catch (err) {
        stats.errors.push(`Activity for ${customerId}: ${err.message}`);
      }
    }
    console.log(`[Import] Activities created: ${stats.activitiesCreated}`);
  } else {
    console.log(`[Import] Would create ${activitiesToCreate.length} activities`);
  }

  // ── Step 6: Import Campaign Results ─────────────────────────────────────

  console.log("\n=== Step 6: Import Campaigns ===\n");

  // Campaign Results columns: Campaign, Total Open Count, Individual Open Count,
  //   Total Open Count %, Date, Time, Current Subscriber Count
  const campaignMap = new Map(); // campaign name -> campaign id

  console.log(`[Import] ${campaignRows.length} campaigns to import`);

  if (!DRY_RUN) {
    for (const row of campaignRows) {
      const name = (row[0] || "").trim();
      if (!name) continue;

      const totalOpened = parseInt(row[2]) || 0; // Individual Open Count
      const totalClicked = parseInt(row[3]) || 0; // Total Open Count % (repurpose as clicks estimate)
      const dateStr = (row[4] || "").trim();
      const timeStr = (row[5] || "").trim();
      const sentAt = parseDate(dateStr ? `${dateStr} ${timeStr || "00:00:00"}` : null);

      const id = uuid();
      try {
        await db.query(
          `INSERT INTO Campaign (id, name, subject, sentAt, totalSent, totalOpened, totalClicked, createdAt)
           VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
          [id, name, name, sentAt, totalOpened, totalClicked, sentAt || new Date()]
        );
        campaignMap.set(name, id);
        stats.campaignsCreated++;
      } catch (err) {
        stats.errors.push(`Campaign "${name}": ${err.message}`);
      }
    }
    console.log(`[Import] Campaigns created: ${stats.campaignsCreated}`);
  } else {
    // Still build the map for dry-run reporting
    for (const row of campaignRows) {
      const name = (row[0] || "").trim();
      if (name) campaignMap.set(name, uuid());
    }
    console.log(`[Import] Would create ${campaignMap.size} campaigns`);
  }

  // ── Step 7: Import Campaign Logs (sends) ────────────────────────────────

  console.log("\n=== Step 7: Import Campaign Sends ===\n");

  // Campaign Logs columns: Date, Subject, To (email)
  console.log(`[Import] ${logRows.length} campaign send records to process`);

  let sendsCreated = 0;
  let sendsSkipped = 0;

  if (!DRY_RUN) {
    // Batch insert for performance - collect sends in batches of 500
    const BATCH_SIZE = 500;
    let batch = [];

    for (const row of logRows) {
      const dateStr = (row[0] || "").trim();
      const subject = (row[1] || "").trim();
      const email = cleanEmail(row[2]);

      if (!subject || !email) {
        sendsSkipped++;
        continue;
      }

      // Find the campaign by subject match
      let campaignId = campaignMap.get(subject);
      if (!campaignId) {
        // Try partial match
        for (const [name, id] of campaignMap) {
          if (name.includes(subject) || subject.includes(name)) {
            campaignId = id;
            break;
          }
        }
      }

      // If no campaign found, create one
      if (!campaignId) {
        campaignId = uuid();
        const sentAt = parseDate(dateStr);
        try {
          await db.query(
            `INSERT INTO Campaign (id, name, subject, sentAt, totalSent, totalOpened, totalClicked, createdAt)
             VALUES (?, ?, ?, ?, 0, 0, 0, ?)`,
            [campaignId, subject, subject, sentAt, sentAt || new Date()]
          );
          campaignMap.set(subject, campaignId);
          stats.campaignsCreated++;
        } catch (err) {
          // Might already exist from a previous row
          const existing = campaignMap.get(subject);
          if (existing) campaignId = existing;
          else {
            sendsSkipped++;
            continue;
          }
        }
      }

      // Find the customer
      const customerId = emailToId.get(email);
      if (!customerId) {
        sendsSkipped++;
        continue;
      }

      const sentAt = parseDate(dateStr);
      batch.push([uuid(), campaignId, customerId, sentAt || new Date()]);

      if (batch.length >= BATCH_SIZE) {
        await db.query(
          `INSERT INTO CampaignSend (id, campaignId, customerId, sentAt, opened, clicked)
           VALUES ${batch.map(() => "(?, ?, ?, ?, false, false)").join(", ")}`,
          batch.flat()
        );
        sendsCreated += batch.length;
        batch = [];
        if (sendsCreated % 2000 === 0) {
          console.log(`[Import] ... ${sendsCreated} sends created so far`);
        }
      }
    }

    // Flush remaining batch
    if (batch.length > 0) {
      await db.query(
        `INSERT INTO CampaignSend (id, campaignId, customerId, sentAt, opened, clicked)
         VALUES ${batch.map(() => "(?, ?, ?, ?, false, false)").join(", ")}`,
        batch.flat()
      );
      sendsCreated += batch.length;
    }

    stats.campaignSendsCreated = sendsCreated;
    stats.campaignSendsSkipped = sendsSkipped;

    // Update totalSent on campaigns
    await db.query(
      `UPDATE Campaign c SET totalSent = (SELECT COUNT(*) FROM CampaignSend cs WHERE cs.campaignId = c.id)`
    );

    console.log(`[Import] Campaign sends created: ${sendsCreated}`);
    console.log(`[Import] Campaign sends skipped (no match): ${sendsSkipped}`);
  } else {
    // Count what would happen
    for (const row of logRows) {
      const email = cleanEmail(row[2]);
      const subject = (row[1] || "").trim();
      if (!subject || !email) { sendsSkipped++; continue; }
      if (!emailToId.has(email) && !masterByEmail.has(email)) { sendsSkipped++; continue; }
      sendsCreated++;
    }
    console.log(`[Import] Would create ${sendsCreated} campaign sends`);
    console.log(`[Import] Would skip ${sendsSkipped} (no email/subject match)`);
  }

  // ── Step 8: Import Marketing Preferences ────────────────────────────────

  console.log("\n=== Step 8: Import Marketing Preferences ===\n");

  // From Master Sheet individual preference columns
  console.log(`[Import] ${preferencesToCreate.length} preferences from Master Sheet columns`);

  // From Marketing Preferences Log
  // Columns: Timestamp, Email, Update Preferences, Or unsubscribe from all, First Name
  console.log(`[Import] ${prefRows.length} entries in Marketing Preferences Log`);

  if (!DRY_RUN) {
    // Batch insert preferences from sheet columns
    const prefSet = new Set(); // Track unique customerId+preference combos
    let prefsCreated = 0;

    for (const { customerId, preference } of preferencesToCreate) {
      const key = `${customerId}:${preference}`;
      if (prefSet.has(key)) continue;
      prefSet.add(key);

      try {
        await db.query(
          `INSERT INTO MarketingPreference (id, customerId, preference, optedIn, updatedAt)
           VALUES (?, ?, ?, true, NOW())
           ON DUPLICATE KEY UPDATE optedIn = true, updatedAt = NOW()`,
          [uuid(), customerId, preference]
        );
        prefsCreated++;
      } catch (err) {
        stats.errors.push(`Preference ${customerId}/${preference}: ${err.message}`);
      }
    }

    // Process Marketing Preferences Log (these are mostly unsubscribes)
    for (const row of prefRows) {
      const email = cleanEmail(row[1]);
      if (!email) continue;

      const customerId = emailToId.get(email);
      if (!customerId) continue;

      const prefChange = (row[2] || "").trim();
      const unsubAll = (row[3] || "").trim();

      if (unsubAll === "Unsubscribe") {
        // Mark all preferences as opted out for this customer
        await db.query(
          "UPDATE MarketingPreference SET optedIn = false, updatedAt = NOW() WHERE customerId = ?",
          [customerId]
        );
        // Also update customer status
        await db.query(
          "UPDATE Customer SET status = 'UNSUBSCRIBED', marketingOptIn = false, updatedAt = NOW() WHERE id = ?",
          [customerId]
        );
      } else if (prefChange) {
        // Specific preference unsubscribe
        const key = `${customerId}:${prefChange}`;
        if (!prefSet.has(key)) {
          await db.query(
            `INSERT INTO MarketingPreference (id, customerId, preference, optedIn, updatedAt)
             VALUES (?, ?, ?, false, NOW())
             ON DUPLICATE KEY UPDATE optedIn = false, updatedAt = NOW()`,
            [uuid(), customerId, prefChange]
          );
        } else {
          await db.query(
            "UPDATE MarketingPreference SET optedIn = false, updatedAt = NOW() WHERE customerId = ? AND preference = ?",
            [customerId, prefChange]
          );
        }
      }
    }

    stats.preferencesCreated = prefsCreated;
    console.log(`[Import] Preferences created: ${prefsCreated}`);
  } else {
    console.log(`[Import] Would create ${preferencesToCreate.length} preference records`);
    console.log(`[Import] Would process ${prefRows.length} preference log entries`);
  }

  // ── Step 9: Recalculate scores ──────────────────────────────────────────

  if (!SKIP_SCORES) {
    console.log("\n=== Step 9: Recalculate customer scores ===\n");

    const [allCustomers] = await db.query("SELECT id, email, phone, company, marketingOptIn, totalBookings, referralName, lastActivityAt FROM Customer");
    console.log(`[Import] ${allCustomers.length} customers to score`);

    if (!DRY_RUN) {
      let scored = 0;
      for (const customer of allCustomers) {
        try {
          // Profile completeness
          let profileScore = 0;
          if (customer.email) profileScore += 5;
          if (customer.phone) profileScore += 5;
          if (customer.company) profileScore += 10;
          if (customer.marketingOptIn) profileScore += 5;

          // Purchase
          const purchaseScore = (customer.totalBookings || 0) * 20;

          // Advocacy
          const advocacyScore = customer.referralName ? 10 : 0;

          // Engagement from activities
          const [activities] = await db.query(
            "SELECT type FROM CustomerActivity WHERE customerId = ?",
            [customer.id]
          );
          let engagementScore = 0;
          for (const a of activities) {
            switch (a.type) {
              case "GAME_PLAYED": engagementScore += 10; break;
              case "PRODUCT_USED": engagementScore += 10; break;
              case "WEBSITE_VISIT": engagementScore += 1; break;
              case "APP_INTERACTION": engagementScore += 5; break;
              case "FREE_CONTENT": engagementScore += 10; break;
              default: break;
            }
          }

          // Engagement from campaign sends
          const [sends] = await db.query(
            "SELECT opened, clicked FROM CampaignSend WHERE customerId = ?",
            [customer.id]
          );
          for (const s of sends) {
            if (s.opened) engagementScore += 2;
            if (s.clicked) engagementScore += 5;
          }

          // Decay
          let decayScore = 0;
          if (customer.lastActivityAt) {
            const monthsInactive = (Date.now() - new Date(customer.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24 * 30);
            if (monthsInactive >= 12) decayScore = -15;
            else if (monthsInactive >= 6) decayScore = -10;
            else if (monthsInactive >= 3) decayScore = -5;
          }

          const totalScore = Math.max(0, profileScore + purchaseScore + advocacyScore + engagementScore + decayScore);
          const breakdown = JSON.stringify({
            profile: profileScore,
            purchase: purchaseScore,
            advocacy: advocacyScore,
            engagement: engagementScore,
            decay: decayScore,
          });

          await db.query(
            `INSERT INTO CustomerScore (id, customerId, score, breakdown, updatedAt)
             VALUES (?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE score = ?, breakdown = ?, updatedAt = NOW()`,
            [uuid(), customer.id, totalScore, breakdown, totalScore, breakdown]
          );
          scored++;

          if (scored % 500 === 0) {
            console.log(`[Import] ... ${scored} scores calculated`);
          }
        } catch (err) {
          stats.errors.push(`Score for ${customer.id}: ${err.message}`);
        }
      }
      stats.scoresCalculated = scored;
      console.log(`[Import] Scores calculated: ${scored}`);
    } else {
      console.log(`[Import] Would calculate scores for ${allCustomers.length} customers`);
    }
  }

  // ── Final report ────────────────────────────────────────────────────────

  console.log("\n" + "=".repeat(60));
  console.log(DRY_RUN ? "DRY RUN COMPLETE" : "IMPORT COMPLETE");
  console.log("=".repeat(60));
  console.log(`Customer numbers backfilled: ${DRY_RUN ? needsNumber.length : stats.customerNumbersBackfilled}`);
  console.log(`Customers created:           ${DRY_RUN ? created : stats.customersCreated}`);
  console.log(`Customers enriched:          ${DRY_RUN ? enriched : stats.customersEnriched}`);
  console.log(`Customers unsubscribed:      ${unsubscribed}`);
  console.log(`Activities created:          ${DRY_RUN ? activitiesToCreate.length : stats.activitiesCreated}`);
  console.log(`Campaigns created:           ${DRY_RUN ? campaignMap.size : stats.campaignsCreated}`);
  console.log(`Campaign sends created:      ${sendsCreated}`);
  console.log(`Campaign sends skipped:      ${sendsSkipped}`);
  console.log(`Preferences created:         ${DRY_RUN ? preferencesToCreate.length : stats.preferencesCreated}`);
  if (!SKIP_SCORES) {
    console.log(`Scores calculated:           ${DRY_RUN ? "pending" : stats.scoresCalculated}`);
  }
  console.log(`Errors:                      ${stats.errors.length}`);
  if (stats.errors.length > 0) {
    console.log("\nError details (first 20):");
    stats.errors.slice(0, 20).forEach((e) => console.log(`  - ${e}`));
  }
  console.log("=".repeat(60));

  if (DRY_RUN) {
    console.log("\nRun with --execute to write to database.");
  }

  await db.end();
}

main().catch((err) => {
  console.error("[Import] Fatal error:", err);
  process.exit(1);
});
