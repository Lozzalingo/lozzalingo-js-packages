/**
 * CRM Data Import Script
 *
 * Imports customer data from the shared marketing Google Sheet into the correct
 * database based on the "Business" column (BucketRace, Fat Big Quiz, or Kalluna).
 *
 * Also:
 *   - Promotes FBQ Subscribers to FBQ Customers
 *   - Marks unsubscribed contacts with status UNSUBSCRIBED
 *   - Imports campaign data (Campaign Results + Campaign Send Logs)
 *   - Imports marketing preferences
 *   - Backfills customer numbers for existing customers without them
 *   - Calculates initial customer scores
 *
 * Usage:
 *   node packages/crm/scripts/import-crm-data.js                    # dry run
 *   node packages/crm/scripts/import-crm-data.js --execute          # write to DB
 *   node packages/crm/scripts/import-crm-data.js --execute --step=1 # run specific step only
 *
 * Steps:
 *   1. Backfill customer numbers for existing BR customers
 *   2. Import Master Sheet rows into correct database by Business column
 *   3. Promote FBQ Subscribers to FBQ Customers
 *   4. Import Unsubscribed sheet (mark as UNSUBSCRIBED)
 *   5. Import Campaign Results + Campaign Send Logs
 *   6. Import Marketing Preferences from Master Sheet
 *   7. Calculate initial customer scores
 *
 * Requires:
 *   - MySQL running with bucketrace and fat_big_quiz databases
 *   - googleapis npm package
 *   - Google service account credentials
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
const SPREADSHEET_ID = "1lMvmEKqPadPavaG6qp6WQLngTnmBgUs4hSaoKlsMBeQ";

const DRY_RUN = !process.argv.includes("--execute");
const STEP_ARG = process.argv.find((a) => a.startsWith("--step="));
const ONLY_STEP = STEP_ARG ? parseInt(STEP_ARG.split("=")[1], 10) : null;

// Column indices for Master Sheet (0-based)
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
  DEMOGRAPHIC: 17,
  LOCATION: 18,
  REGION: 19,
  COUNTRY: 20,
  AUDIENCE: 21,
  EVENT_DATE: 22,
  PURCHASE_TYPE: 23,
  TEAM_NAME: 24,
  TICKETS_PURCHASED: 25,
  VOUCHER_CODE: 26,
  SECURITY_CODE: 27,
  REFERRAL_NAME: 28,
  REFERRAL_EMAIL: 29,
  TERMS: 30,
  PRIVACY: 31,
  PRODUCT_LOG: 32,
  LAST_PURCHASE_AMOUNT: 33,
  TOTAL_SPEND: 34,
  TEAM_NAME_LOG: 35,
  MARKETING_LOG: 36,
  USER_RATING: 37,
  TIMEZONE: 38,
  ENQUIRY_REGION: 39,
  IP_ADDRESS: 40,
  TOTAL_PURCHASES: 41,
  MARKETING_PREFERENCES: 42,
  // Individual marketing preference columns (43-55)
  PREF_VIRTUAL: 43,
  PREF_REAL_WORLD: 44,
  PREF_HYBRID: 45,
  PREF_FBQ: 46,
  PREF_SCAVENGER: 47,
  PREF_WHACKY_WAGER: 48,
  PREF_OFFICE_OLYMPICS: 49,
  PREF_GAMIFIED_PARTIES: 50,
  PREF_FREE_DOWNLOADABLES: 51,
  PREF_ZOOM_QUIZZES: 52,
  PREF_QUIZ_BUILDER: 53,
  PREF_CHILDRENS: 54,
  PREF_ROAD_TRIPS: 55,
  LAT: 56,
  LONG: 57,
  FUTURE_GAMES: 58,
  // Email Sent columns (59-78) - used for campaign send matching
  // BUSINESS column
  BUSINESS: 79,
};

// Marketing preference column mapping
const PREF_COLUMNS = [
  { index: COL.PREF_VIRTUAL, name: "Virtual Games" },
  { index: COL.PREF_REAL_WORLD, name: "Real World Games" },
  { index: COL.PREF_HYBRID, name: "Hybrid Games" },
  { index: COL.PREF_FBQ, name: "Fat Big Quiz" },
  { index: COL.PREF_SCAVENGER, name: "Scavenger Hunts" },
  { index: COL.PREF_WHACKY_WAGER, name: "Whacky Wager Betting Night" },
  { index: COL.PREF_OFFICE_OLYMPICS, name: "Office Olympics" },
  { index: COL.PREF_GAMIFIED_PARTIES, name: "Gamified Parties" },
  { index: COL.PREF_FREE_DOWNLOADABLES, name: "Free Downloadables" },
  { index: COL.PREF_ZOOM_QUIZZES, name: "Immersive Zoom Quizzes" },
  { index: COL.PREF_QUIZ_BUILDER, name: "Quiz/Scavenger Hunt Builder" },
  { index: COL.PREF_CHILDRENS, name: "Children's Games" },
  { index: COL.PREF_ROAD_TRIPS, name: "Road Trips" },
];

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
  // Handle DD/MM/YYYY format
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    if (!isNaN(d.getTime())) return d;
  }
  // Handle YYYY-MM-DD HH:MM:SS format
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function parseTimestamp(ts) {
  if (!ts) return null;
  // Handle DD/MM/YYYY HH:MM:SS format
  const match = ts.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (match) {
    const [, day, month, year, hour, min, sec] = match;
    const d = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(min), Number(sec));
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

function parsePence(val) {
  if (!val) return 0;
  const num = parseFloat(val.toString().replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return 0;
  // If value looks like pounds (has decimal or is reasonable), convert to pence
  return Math.round(num * 100);
}

function uuid() {
  return crypto.randomUUID();
}

function generateCustomerNumber(prefix, seq) {
  return `#${prefix}${String(seq).padStart(4, "0")}`;
}

// -- Stats tracker ------------------------------------------------------------

const stats = {
  brBackfilled: 0,
  brCreated: 0,
  brEnriched: 0,
  fbqCreated: 0,
  fbqEnriched: 0,
  fbqPromoted: 0,
  unsubscribed: 0,
  campaignsCreated: 0,
  campaignSendsCreated: 0,
  preferencesCreated: 0,
  activitiesCreated: 0,
  scoresCalculated: 0,
  kallunaSkipped: 0,
  noBusinessSkipped: 0,
  errors: [],
};

// -- Database helpers ---------------------------------------------------------

async function getNextSeq(conn, db, prefix) {
  const pattern = `#${prefix}%`;
  const [rows] = await conn.query(
    `SELECT customerNumber FROM ${db}.Customer WHERE customerNumber LIKE ? ORDER BY customerNumber DESC LIMIT 1`,
    [pattern]
  );
  if (rows.length === 0) return 1;
  const numStr = rows[0].customerNumber.replace(`#${prefix}`, "");
  const num = parseInt(numStr, 10);
  return isNaN(num) ? 1 : num + 1;
}

async function findCustomerByEmail(conn, db, email) {
  const [rows] = await conn.query(
    `SELECT id, customerNumber, firstName, lastName, phone, company, jobTitle, country, region, ipAddress, source, totalSpent, totalBookings FROM ${db}.Customer WHERE LOWER(email) = ?`,
    [email]
  );
  return rows[0] || null;
}

async function findSubscriberByEmail(conn, email) {
  const [rows] = await conn.query(
    `SELECT id, email, firstName, lastName, source, optIn FROM fat_big_quiz.Subscriber WHERE LOWER(email) = ?`,
    [email]
  );
  return rows[0] || null;
}

// -- Step 1: Backfill customer numbers ----------------------------------------

async function step1BackfillNumbers(conn) {
  console.log("\n[Import] Step 1: Backfilling customer numbers for existing BR customers...");

  const [rows] = await conn.query(
    "SELECT id, email FROM bucketrace.Customer WHERE customerNumber IS NULL ORDER BY createdAt ASC"
  );
  console.log(`[Import] Found ${rows.length} BR customers without customer numbers`);

  if (rows.length === 0) return;

  let nextSeq = await getNextSeq(conn, "bucketrace", "BR");
  console.log(`[Import] Starting from sequence: ${nextSeq}`);

  for (const row of rows) {
    const num = generateCustomerNumber("BR", nextSeq);
    if (!DRY_RUN) {
      await conn.query(
        "UPDATE bucketrace.Customer SET customerNumber = ? WHERE id = ?",
        [num, row.id]
      );
    }
    nextSeq++;
    stats.brBackfilled++;
  }

  console.log(`[Import] Backfilled ${stats.brBackfilled} customer numbers (#BR0001 - #BR${String(nextSeq - 1).padStart(4, "0")})`);
}

// -- Step 2: Import Master Sheet by Business ----------------------------------

async function step2ImportMasterSheet(conn, sheets) {
  console.log("\n[Import] Step 2: Importing Master Sheet by Business column...");

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Master Sheet!A2:CB5000",
  });
  const rows = resp.data.values || [];
  console.log(`[Import] Loaded ${rows.length} rows from Master Sheet`);

  // Track sequences per business
  let brSeq = await getNextSeq(conn, "bucketrace", "BR");
  let fbqSeq = await getNextSeq(conn, "fat_big_quiz", "FBQ");

  // Track emails we've already processed (dedup within the sheet)
  const processedEmails = new Map(); // email -> { db, id }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const email = cleanEmail(row[COL.EMAIL]);
    const business = cleanStr(row[COL.BUSINESS]);

    if (!email) continue;

    if (!business) {
      stats.noBusinessSkipped++;
      continue;
    }

    if (business === "Kalluna") {
      stats.kallunaSkipped++;
      continue;
    }

    // Determine target database and prefix
    let db, prefix, nextSeq;
    if (business === "BucketRace") {
      db = "bucketrace";
      prefix = "BR";
      nextSeq = brSeq;
    } else if (business === "Fat Big Quiz") {
      db = "fat_big_quiz";
      prefix = "FBQ";
      nextSeq = fbqSeq;
    } else {
      console.error(`[Import] Unknown business "${business}" for ${email}, skipping`);
      stats.errors.push(`Unknown business: ${business} for ${email}`);
      continue;
    }

    // Parse row data
    const firstName = cleanStr(row[COL.FIRST_NAME]) || "Unknown";
    const lastName = cleanStr(row[COL.LAST_NAME]) || "";
    const phone = cleanStr(row[COL.PHONE]);
    const company = cleanStr(row[COL.ORGANISATION]);
    const jobTitle = cleanStr(row[COL.JOB_TITLE]);
    const dob = parseUKDate(row[COL.DOB]);
    const country = cleanStr(row[COL.COUNTRY]);
    const region = cleanStr(row[COL.REGION]) || cleanStr(row[COL.ENQUIRY_REGION]);
    const lat = row[COL.LAT] ? parseFloat(row[COL.LAT]) : null;
    const lng = row[COL.LONG] ? parseFloat(row[COL.LONG]) : null;
    const ipAddress = cleanStr(row[COL.IP_ADDRESS]);
    const source = cleanStr(row[COL.SOURCE]) || "spreadsheet-import";
    const referralName = cleanStr(row[COL.REFERRAL_NAME]);
    const referralEmail = cleanStr(row[COL.REFERRAL_EMAIL]);
    const totalSpend = parsePence(row[COL.TOTAL_SPEND]);
    const totalPurchases = parseInt(row[COL.TOTAL_PURCHASES]) || 0;
    const futureGames = cleanStr(row[COL.FUTURE_GAMES]);
    const marketingOptIn = futureGames === "Yes" || futureGames === "yes";
    const timestamp = parseTimestamp(row[COL.TIMESTAMP]);
    const termsAccepted = cleanStr(row[COL.TERMS]) ? (timestamp || new Date()) : null;
    const privacyAccepted = cleanStr(row[COL.PRIVACY]) ? (timestamp || new Date()) : null;

    // Skip if we've already processed this email for the same database
    if (processedEmails.has(`${db}:${email}`)) {
      continue;
    }

    try {
      // Check if customer already exists in the target database
      const existing = await findCustomerByEmail(conn, db, email);

      if (existing) {
        // Enrich existing customer with any new data
        const updates = [];
        const values = [];

        if (!existing.phone && phone) { updates.push("phone = ?"); values.push(phone); }
        if (!existing.company && company) { updates.push("company = ?"); values.push(company); }
        if (!existing.jobTitle && jobTitle) { updates.push("jobTitle = ?"); values.push(jobTitle); }
        if (!existing.country && country) { updates.push("country = ?"); values.push(country); }
        if (!existing.region && region) { updates.push("region = ?"); values.push(region); }
        if (!existing.ipAddress && ipAddress) { updates.push("ipAddress = ?"); values.push(ipAddress); }
        if (lat && !existing.lat) { updates.push("lat = ?"); values.push(lat); }
        if (lng && !existing.lng) { updates.push("lng = ?"); values.push(lng); }
        if (referralName) { updates.push("referralName = ?"); values.push(referralName); }
        if (referralEmail) { updates.push("referralEmail = ?"); values.push(referralEmail); }
        if (totalSpend > (existing.totalSpent || 0)) { updates.push("totalSpent = ?"); values.push(totalSpend); }
        if (totalPurchases > (existing.totalBookings || 0)) { updates.push("totalBookings = ?"); values.push(totalPurchases); }
        if (marketingOptIn) { updates.push("marketingOptIn = ?"); values.push(true); }
        if (!existing.customerNumber) {
          const num = generateCustomerNumber(prefix, nextSeq);
          updates.push("customerNumber = ?");
          values.push(num);
          if (db === "bucketrace") brSeq++;
          else fbqSeq++;
        }

        if (updates.length > 0 && !DRY_RUN) {
          values.push(existing.id);
          await conn.query(
            `UPDATE ${db}.Customer SET ${updates.join(", ")} WHERE id = ?`,
            values
          );
        }

        processedEmails.set(`${db}:${email}`, { db, id: existing.id });
        if (db === "bucketrace") stats.brEnriched++;
        else stats.fbqEnriched++;
      } else {
        // Create new customer
        const id = uuid();
        const customerNumber = generateCustomerNumber(prefix, nextSeq);
        if (db === "bucketrace") brSeq++;
        else fbqSeq++;

        if (!DRY_RUN) {
          await conn.query(
            `INSERT INTO ${db}.Customer (id, customerNumber, firstName, lastName, email, phone, company, jobTitle, dateOfBirth, country, region, lat, lng, ipAddress, source, status, marketingOptIn, totalSpent, totalBookings, referralName, referralEmail, termsAcceptedAt, privacyAcceptedAt, lastActivityAt, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id, customerNumber, firstName, lastName, email, phone, company, jobTitle,
              dob, country, region,
              lat && !isNaN(lat) ? lat : null,
              lng && !isNaN(lng) ? lng : null,
              ipAddress, source, marketingOptIn, totalSpend, totalPurchases,
              referralName, referralEmail, termsAccepted, privacyAccepted,
              timestamp || new Date(),
              timestamp || new Date(),
              new Date(),
            ]
          );
        }

        processedEmails.set(`${db}:${email}`, { db, id });
        if (db === "bucketrace") stats.brCreated++;
        else stats.fbqCreated++;
      }
    } catch (err) {
      stats.errors.push(`Row ${i + 2} (${email}): ${err.message}`);
      console.error(`[Import] Error processing row ${i + 2} (${email}):`, err.message);
    }
  }

  console.log(`[Import] BucketRace: ${stats.brCreated} created, ${stats.brEnriched} enriched`);
  console.log(`[Import] Fat Big Quiz: ${stats.fbqCreated} created, ${stats.fbqEnriched} enriched`);
  console.log(`[Import] Kalluna: ${stats.kallunaSkipped} skipped (no database yet)`);
  console.log(`[Import] No business: ${stats.noBusinessSkipped} skipped`);
}

// -- Step 3: Promote FBQ Subscribers to Customers -----------------------------

async function step3PromoteSubscribers(conn) {
  console.log("\n[Import] Step 3: Promoting FBQ Subscribers to Customers...");

  const [subscribers] = await conn.query(
    "SELECT id, email, firstName, lastName, source, optIn FROM fat_big_quiz.Subscriber ORDER BY subscribedAt ASC"
  );
  console.log(`[Import] Found ${subscribers.length} FBQ subscribers`);

  let fbqSeq = await getNextSeq(conn, "fat_big_quiz", "FBQ");

  for (const sub of subscribers) {
    const email = cleanEmail(sub.email);
    if (!email) continue;

    try {
      // Check if a Customer already exists (may have been created in Step 2)
      const existing = await findCustomerByEmail(conn, "fat_big_quiz", email);

      if (existing) {
        // Customer exists, just ensure marketingOptIn is set if subscriber was opted in
        if (sub.optIn && !DRY_RUN) {
          await conn.query(
            "UPDATE fat_big_quiz.Customer SET marketingOptIn = ? WHERE id = ? AND marketingOptIn = false",
            [true, existing.id]
          );
        }
        // Skip creation, already a customer
        continue;
      }

      // Create new Customer from Subscriber
      const id = uuid();
      const customerNumber = generateCustomerNumber("FBQ", fbqSeq);
      fbqSeq++;

      const status = sub.optIn ? "ACTIVE" : "UNSUBSCRIBED";

      if (!DRY_RUN) {
        await conn.query(
          `INSERT INTO fat_big_quiz.Customer (id, customerNumber, firstName, lastName, email, source, status, marketingOptIn, totalSpent, totalBookings, lastActivityAt, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NOW(), NOW(), NOW())`,
          [
            id, customerNumber,
            sub.firstName || "Unknown",
            sub.lastName || "",
            email,
            sub.source ? `subscriber-${sub.source}` : "subscriber",
            status,
            sub.optIn ? true : false,
          ]
        );
      }

      stats.fbqPromoted++;
    } catch (err) {
      stats.errors.push(`FBQ Subscriber ${email}: ${err.message}`);
      console.error(`[Import] Error promoting subscriber ${email}:`, err.message);
    }
  }

  console.log(`[Import] Promoted ${stats.fbqPromoted} subscribers to FBQ customers`);
}

// -- Step 4: Import Unsubscribed sheet ----------------------------------------

async function step4ImportUnsubscribed(conn, sheets) {
  console.log("\n[Import] Step 4: Importing Unsubscribed contacts...");

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Unsubscribed!A2:AZ2000",
  });
  const rows = resp.data.values || [];
  console.log(`[Import] Loaded ${rows.length} unsubscribed rows`);

  // Unsubscribed sheet has the same column layout as Master Sheet (minus some later columns)
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const email = cleanEmail(row[COL.EMAIL]);
    if (!email) continue;

    try {
      // Check both databases for this email and mark as UNSUBSCRIBED
      for (const db of ["bucketrace", "fat_big_quiz"]) {
        const existing = await findCustomerByEmail(conn, db, email);
        if (existing) {
          if (!DRY_RUN) {
            await conn.query(
              `UPDATE ${db}.Customer SET status = 'UNSUBSCRIBED', marketingOptIn = false, updatedAt = NOW() WHERE id = ?`,
              [existing.id]
            );
          }
          stats.unsubscribed++;
        }
      }
    } catch (err) {
      stats.errors.push(`Unsubscribed ${email}: ${err.message}`);
      console.error(`[Import] Error processing unsubscribed ${email}:`, err.message);
    }
  }

  console.log(`[Import] Marked ${stats.unsubscribed} customers as UNSUBSCRIBED`);
}

// -- Step 5: Import Campaigns and Campaign Sends ------------------------------

async function step5ImportCampaigns(conn, sheets) {
  console.log("\n[Import] Step 5: Importing campaigns and send logs...");

  // 5a. Import Campaign Results
  const resultsResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Campaign Results!A2:H50",
  });
  const resultRows = resultsResp.data.values || [];
  console.log(`[Import] Loaded ${resultRows.length} campaign results`);

  // Campaign Results columns: Campaign, Total Open Count, Individual Open Count, Total Open Count %, Date, Time, Current Subscriber Count
  const campaignMap = new Map(); // campaign name -> { id, ... }

  for (const row of resultRows) {
    const name = cleanStr(row[0]);
    if (!name) continue;

    const totalOpened = parseInt(row[1]) || 0;
    const individualOpened = parseInt(row[2]) || 0;
    const date = cleanStr(row[4]);
    const time = cleanStr(row[5]);
    const sentAt = parseTimestamp(date && time ? `${date} ${time}` : date);

    const id = uuid();
    campaignMap.set(name, {
      id,
      name,
      subject: name,
      sentAt,
      totalOpened: individualOpened,
    });

    // Create campaigns in BOTH databases (these were cross-brand campaigns)
    if (!DRY_RUN) {
      // BucketRace
      await conn.query(
        `INSERT INTO bucketrace.Campaign (id, name, subject, sentAt, totalSent, totalOpened, totalClicked, createdAt)
         VALUES (?, ?, ?, ?, 0, ?, 0, NOW())`,
        [id, name, name, sentAt, individualOpened]
      );

      // Fat Big Quiz uses CrmCampaign
      const fbqId = uuid();
      await conn.query(
        `INSERT INTO fat_big_quiz.CrmCampaign (id, name, subject, sentAt, totalSent, totalOpened, totalClicked, createdAt)
         VALUES (?, ?, ?, ?, 0, ?, 0, NOW())`,
        [fbqId, name, name, sentAt, individualOpened]
      );

      // Store both IDs
      campaignMap.get(name).fbqId = fbqId;
    }

    stats.campaignsCreated++;
  }

  console.log(`[Import] Created ${stats.campaignsCreated} campaigns`);

  // 5b. Import Campaign Send Logs
  const logsResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Marketing Campaign Logs!A2:C20000",
  });
  const logRows = logsResp.data.values || [];
  console.log(`[Import] Loaded ${logRows.length} campaign send log entries`);

  // Campaign Logs columns: Date, Subject, To (email)
  let brSendCount = 0;
  let fbqSendCount = 0;

  for (let i = 0; i < logRows.length; i++) {
    const row = logRows[i];
    const sentAt = parseTimestamp(row[0]);
    const subject = cleanStr(row[1]);
    const email = cleanEmail(row[2]);

    if (!email || !subject) continue;

    const campaign = campaignMap.get(subject);
    if (!campaign) {
      // Campaign not in results sheet, skip
      continue;
    }

    try {
      // Check which database this customer lives in
      const brCustomer = await findCustomerByEmail(conn, "bucketrace", email);
      const fbqCustomer = await findCustomerByEmail(conn, "fat_big_quiz", email);

      if (brCustomer && !DRY_RUN) {
        await conn.query(
          `INSERT INTO bucketrace.CampaignSend (id, campaignId, customerId, sentAt, opened, clicked)
           VALUES (?, ?, ?, ?, false, false)`,
          [uuid(), campaign.id, brCustomer.id, sentAt || new Date()]
        );
        brSendCount++;
        stats.campaignSendsCreated++;
      }

      if (fbqCustomer && campaign.fbqId && !DRY_RUN) {
        await conn.query(
          `INSERT INTO fat_big_quiz.CrmCampaignSend (id, campaignId, customerId, sentAt, opened, clicked)
           VALUES (?, ?, ?, ?, false, false)`,
          [uuid(), campaign.fbqId, fbqCustomer.id, sentAt || new Date()]
        );
        fbqSendCount++;
        stats.campaignSendsCreated++;
      }
    } catch (err) {
      // Duplicate sends are not critical, continue
      if (!err.message.includes("Duplicate")) {
        stats.errors.push(`Campaign send ${email} / ${subject}: ${err.message}`);
      }
    }
  }

  // Update totalSent counts on campaigns
  if (!DRY_RUN) {
    for (const [, campaign] of campaignMap) {
      await conn.query(
        "UPDATE bucketrace.Campaign SET totalSent = (SELECT COUNT(*) FROM bucketrace.CampaignSend WHERE campaignId = ?) WHERE id = ?",
        [campaign.id, campaign.id]
      );
      if (campaign.fbqId) {
        await conn.query(
          "UPDATE fat_big_quiz.CrmCampaign SET totalSent = (SELECT COUNT(*) FROM fat_big_quiz.CrmCampaignSend WHERE campaignId = ?) WHERE id = ?",
          [campaign.fbqId, campaign.fbqId]
        );
      }
    }
  }

  console.log(`[Import] Created campaign sends: ${brSendCount} BR, ${fbqSendCount} FBQ`);
}

// -- Step 6: Import Marketing Preferences -------------------------------------

async function step6ImportPreferences(conn, sheets) {
  console.log("\n[Import] Step 6: Importing marketing preferences...");

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Master Sheet!A2:CB5000",
  });
  const rows = resp.data.values || [];

  const processedEmails = new Set();

  for (const row of rows) {
    const email = cleanEmail(row[COL.EMAIL]);
    const business = cleanStr(row[COL.BUSINESS]);
    if (!email || !business || business === "Kalluna") continue;
    if (processedEmails.has(email)) continue;
    processedEmails.add(email);

    const db = business === "BucketRace" ? "bucketrace" : "fat_big_quiz";
    const customer = await findCustomerByEmail(conn, db, email);
    if (!customer) continue;

    for (const pref of PREF_COLUMNS) {
      const val = cleanStr(row[pref.index]);
      // A preference is opted in if the cell has any truthy value (typically a tick or "Yes")
      if (val) {
        try {
          if (!DRY_RUN) {
            await conn.query(
              `INSERT INTO ${db}.MarketingPreference (id, customerId, preference, optedIn, updatedAt)
               VALUES (?, ?, ?, true, NOW())
               ON DUPLICATE KEY UPDATE optedIn = true, updatedAt = NOW()`,
              [uuid(), customer.id, pref.name]
            );
          }
          stats.preferencesCreated++;
        } catch (err) {
          if (!err.message.includes("Duplicate")) {
            stats.errors.push(`Preference ${email}/${pref.name}: ${err.message}`);
          }
        }
      }
    }
  }

  console.log(`[Import] Created ${stats.preferencesCreated} marketing preferences`);
}

// -- Step 7: Import Activities from Master Sheet ------------------------------

async function step7ImportActivities(conn, sheets) {
  console.log("\n[Import] Step 7: Creating customer activities from Master Sheet product data...");

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "Master Sheet!A2:CB5000",
  });
  const rows = resp.data.values || [];

  for (const row of rows) {
    const email = cleanEmail(row[COL.EMAIL]);
    const business = cleanStr(row[COL.BUSINESS]);
    if (!email || !business || business === "Kalluna") continue;

    const productCategory = cleanStr(row[COL.PRODUCT_CATEGORY]);
    const productName = cleanStr(row[COL.PRODUCT_NAME]);
    const platform = cleanStr(row[COL.PLATFORM]);
    const groupType = cleanStr(row[COL.GROUP_TYPE]);
    const channel = cleanStr(row[COL.CHANNEL]);
    const source = cleanStr(row[COL.SOURCE]);
    const audience = cleanStr(row[COL.AUDIENCE]);
    const location = cleanStr(row[COL.LOCATION]);
    const region = cleanStr(row[COL.REGION]);
    const country = cleanStr(row[COL.COUNTRY]);
    const teamName = cleanStr(row[COL.TEAM_NAME]);
    const eventDate = parseUKDate(row[COL.EVENT_DATE]) || parseTimestamp(row[COL.EVENT_DATE]);
    const purchaseType = cleanStr(row[COL.PURCHASE_TYPE]);

    // Only create activity if there's meaningful product/event data
    if (!productCategory && !productName && !channel) continue;

    const db = business === "BucketRace" ? "bucketrace" : "fat_big_quiz";
    const customer = await findCustomerByEmail(conn, db, email);
    if (!customer) continue;

    // Determine activity type
    let activityType = "SIGNUP";
    if (purchaseType === "Hosted" || purchaseType === "Ticketed") {
      activityType = "GAME_PLAYED";
    } else if (productCategory && productCategory.includes("Free")) {
      activityType = "FREE_CONTENT";
    } else if (productCategory) {
      activityType = "PRODUCT_USED";
    }

    try {
      if (!DRY_RUN) {
        await conn.query(
          `INSERT INTO ${db}.CustomerActivity (id, customerId, type, source, channel, productName, productCategory, platform, groupType, audience, location, region, country, teamName, eventDate, metadata, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuid(), customer.id, activityType, source, channel,
            productName, productCategory, platform, groupType, audience,
            location, region, country, teamName, eventDate,
            JSON.stringify({ purchaseType, importedFrom: "marketing-sheet" }),
            eventDate || new Date(),
          ]
        );
      }
      stats.activitiesCreated++;
    } catch (err) {
      stats.errors.push(`Activity ${email}: ${err.message}`);
    }
  }

  console.log(`[Import] Created ${stats.activitiesCreated} customer activities`);
}

// -- Step 8: Calculate scores -------------------------------------------------

async function step8CalculateScores(conn) {
  console.log("\n[Import] Step 8: Calculating initial customer scores...");

  for (const db of ["bucketrace", "fat_big_quiz"]) {
    const campaignSendTable = db === "fat_big_quiz" ? "CrmCampaignSend" : "CampaignSend";

    const [customers] = await conn.query(
      `SELECT id, email, phone, company, marketingOptIn, totalSpent, totalBookings, referralName, lastActivityAt FROM ${db}.Customer`
    );
    console.log(`[Import] Scoring ${customers.length} ${db} customers...`);

    for (const c of customers) {
      let score = 0;
      const breakdown = { profile: 0, purchase: 0, advocacy: 0, engagement: 0, decay: 0 };

      // Profile completeness
      if (c.email) { score += 5; breakdown.profile += 5; }
      if (c.phone) { score += 5; breakdown.profile += 5; }
      if (c.company) { score += 10; breakdown.profile += 10; }
      if (c.marketingOptIn) { score += 5; breakdown.profile += 5; }

      // Purchase
      const purchasePoints = (c.totalBookings || 0) * 20;
      score += purchasePoints;
      breakdown.purchase = purchasePoints;

      // Advocacy
      if (c.referralName) { score += 10; breakdown.advocacy = 10; }

      // Engagement (count activities and campaign sends)
      const [actRows] = await conn.query(
        `SELECT COUNT(*) as cnt FROM ${db}.CustomerActivity WHERE customerId = ?`,
        [c.id]
      );
      const actCount = actRows[0].cnt || 0;
      const engagementPoints = actCount * 5;
      score += engagementPoints;
      breakdown.engagement += engagementPoints;

      const [sendRows] = await conn.query(
        `SELECT COUNT(*) as cnt FROM ${db}.${campaignSendTable} WHERE customerId = ?`,
        [c.id]
      );
      const sendCount = sendRows[0].cnt || 0;
      breakdown.engagement += sendCount * 2;
      score += sendCount * 2;

      // Decay
      if (c.lastActivityAt) {
        const monthsInactive = Math.floor(
          (Date.now() - new Date(c.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24 * 30)
        );
        if (monthsInactive >= 12) { score -= 15; breakdown.decay = -15; }
        else if (monthsInactive >= 6) { score -= 10; breakdown.decay = -10; }
        else if (monthsInactive >= 3) { score -= 5; breakdown.decay = -5; }
      }

      if (score < 0) score = 0;

      if (!DRY_RUN) {
        await conn.query(
          `INSERT INTO ${db}.CustomerScore (id, customerId, score, breakdown, updatedAt)
           VALUES (?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE score = ?, breakdown = ?, updatedAt = NOW()`,
          [uuid(), c.id, score, JSON.stringify(breakdown), score, JSON.stringify(breakdown)]
        );
      }

      stats.scoresCalculated++;
    }
  }

  console.log(`[Import] Calculated scores for ${stats.scoresCalculated} customers`);
}

// -- Main ---------------------------------------------------------------------

async function main() {
  console.log("[Import] ═══════════════════════════════════════════════════");
  console.log("[Import] CRM Data Import");
  console.log(`[Import] Mode: ${DRY_RUN ? "DRY RUN (pass --execute to write)" : "LIVE - writing to database"}`);
  if (ONLY_STEP) console.log(`[Import] Running step ${ONLY_STEP} only`);
  console.log("[Import] ═══════════════════════════════════════════════════\n");

  // Connect to MySQL
  const conn = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    multipleStatements: true,
  });

  // Connect to Google Sheets
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheetsApi = google.sheets({ version: "v4", auth });

  try {
    const shouldRun = (step) => !ONLY_STEP || ONLY_STEP === step;

    if (shouldRun(1)) await step1BackfillNumbers(conn);
    if (shouldRun(2)) await step2ImportMasterSheet(conn, sheetsApi);
    if (shouldRun(3)) await step3PromoteSubscribers(conn);
    if (shouldRun(4)) await step4ImportUnsubscribed(conn, sheetsApi);
    if (shouldRun(5)) await step5ImportCampaigns(conn, sheetsApi);
    if (shouldRun(6)) await step6ImportPreferences(conn, sheetsApi);
    if (shouldRun(7)) await step7ImportActivities(conn, sheetsApi);
    if (shouldRun(8)) await step8CalculateScores(conn);

    // -- Final report --------------------------------------------------------

    console.log("\n[Import] ═══════════════════════════════════════════════════");
    console.log("[Import] IMPORT COMPLETE");
    console.log("[Import] ═══════════════════════════════════════════════════");
    console.log(`[Import] BR customer numbers backfilled: ${stats.brBackfilled}`);
    console.log(`[Import] BR customers created:           ${stats.brCreated}`);
    console.log(`[Import] BR customers enriched:          ${stats.brEnriched}`);
    console.log(`[Import] FBQ customers created:          ${stats.fbqCreated}`);
    console.log(`[Import] FBQ customers enriched:         ${stats.fbqEnriched}`);
    console.log(`[Import] FBQ subscribers promoted:       ${stats.fbqPromoted}`);
    console.log(`[Import] Marked as unsubscribed:         ${stats.unsubscribed}`);
    console.log(`[Import] Campaigns created:              ${stats.campaignsCreated}`);
    console.log(`[Import] Campaign sends created:         ${stats.campaignSendsCreated}`);
    console.log(`[Import] Marketing preferences created:  ${stats.preferencesCreated}`);
    console.log(`[Import] Customer activities created:    ${stats.activitiesCreated}`);
    console.log(`[Import] Customer scores calculated:     ${stats.scoresCalculated}`);
    console.log(`[Import] Kalluna rows skipped:           ${stats.kallunaSkipped}`);
    console.log(`[Import] No-business rows skipped:       ${stats.noBusinessSkipped}`);
    console.log(`[Import] Errors:                         ${stats.errors.length}`);
    if (stats.errors.length > 0) {
      console.log("[Import] First 20 errors:");
      stats.errors.slice(0, 20).forEach((e) => console.log(`  - ${e}`));
    }
    console.log("[Import] ═══════════════════════════════════════════════════");
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error("[Import] Fatal error:", err);
  process.exit(1);
});
