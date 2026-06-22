/**
 * CRM Duplicate Check Script
 *
 * Checks for email overlaps across all data sources before import:
 *   - BucketRace Customer table
 *   - Fat Big Quiz Customer table
 *   - Fat Big Quiz Subscriber table
 *   - Shared Marketing Google Sheet (Master + Unsubscribed)
 *
 * Usage:
 *   node packages/crm/scripts/check-duplicates.js
 *   node packages/crm/scripts/check-duplicates.js --with-sheet   # Also checks the Google Sheet
 *
 * Requires:
 *   - MySQL running with bucketrace and fat_big_quiz databases
 *   - googleapis npm package (for --with-sheet)
 *   - Google service account credentials
 */

const mysql = require("mysql2/promise");
const path = require("path");

const WITH_SHEET = process.argv.includes("--with-sheet");
const CREDS_PATH = path.resolve(
  __dirname,
  "../../../../creds/plucky-catfish-452808-f1-69c67e3ecdd1.json"
);
const SPREADSHEET_ID = "1lMvmEKqPadPavaG6qp6WQLngTnmBgUs4hSaoKlsMBeQ";

// ── Helpers ──────────────────────────────────────────────────────────────────

function cleanEmail(email) {
  if (!email) return null;
  return email.trim().toLowerCase();
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("[Duplicates] Starting duplicate check across all data sources\n");

  // Connect to MySQL
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
  });

  // ── 1. Load all existing emails from databases ─────────────────────────

  console.log("=== Loading database records ===\n");

  // BucketRace Customers
  const [brCustomers] = await connection.query(
    "SELECT LOWER(email) as email, firstName, lastName FROM bucketrace.Customer"
  );
  const brEmails = new Set(brCustomers.map((r) => r.email));
  console.log(`BucketRace Customers:   ${brCustomers.length}`);

  // BucketRace Subscribers
  const [brSubscribers] = await connection.query(
    "SELECT LOWER(email) as email FROM bucketrace.Subscriber"
  );
  const brSubEmails = new Set(brSubscribers.map((r) => r.email));
  console.log(`BucketRace Subscribers: ${brSubscribers.length}`);

  // Fat Big Quiz Customers
  const [fbqCustomers] = await connection.query(
    "SELECT LOWER(email) as email, firstName, lastName FROM fat_big_quiz.Customer"
  );
  const fbqCustEmails = new Set(fbqCustomers.map((r) => r.email));
  console.log(`FBQ Customers:          ${fbqCustomers.length}`);

  // Fat Big Quiz Subscribers
  const [fbqSubscribers] = await connection.query(
    "SELECT LOWER(email) as email, firstName, lastName, optIn FROM fat_big_quiz.Subscriber"
  );
  const fbqSubEmails = new Set(fbqSubscribers.map((r) => r.email));
  console.log(`FBQ Subscribers:        ${fbqSubscribers.length}`);

  // ── 2. Check cross-table overlaps ──────────────────────────────────────

  console.log("\n=== Cross-table overlaps ===\n");

  // FBQ Subscribers that are also BR Customers
  const fbqSubInBr = [...fbqSubEmails].filter((e) => brEmails.has(e));
  console.log(`FBQ Subscribers also in BR Customers: ${fbqSubInBr.length}`);

  // FBQ Subscribers that are also FBQ Customers
  const fbqSubInFbqCust = [...fbqSubEmails].filter((e) => fbqCustEmails.has(e));
  console.log(`FBQ Subscribers also in FBQ Customers: ${fbqSubInFbqCust.length}`);

  // BR Customers that are also FBQ Customers
  const brInFbq = [...brEmails].filter((e) => fbqCustEmails.has(e));
  console.log(`BR Customers also in FBQ Customers:    ${brInFbq.length}`);

  // Combined unique emails across all tables
  const allDbEmails = new Set([...brEmails, ...brSubEmails, ...fbqCustEmails, ...fbqSubEmails]);
  console.log(`\nTotal unique emails across all tables: ${allDbEmails.size}`);

  // ── 3. Check Google Sheet (optional) ───────────────────────────────────

  if (WITH_SHEET) {
    console.log("\n=== Loading Google Sheet ===\n");

    const { google } = require("googleapis");
    const auth = new google.auth.GoogleAuth({
      keyFile: CREDS_PATH,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });

    // Master Sheet
    const masterResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Master Sheet!B2:B10000",
    });
    const masterEmails = (masterResp.data.values || [])
      .map((r) => cleanEmail(r[0]))
      .filter(Boolean);
    const masterSet = new Set(masterEmails);
    console.log(`Master Sheet emails:      ${masterEmails.length} (${masterSet.size} unique)`);

    // Unsubscribed Sheet
    const unsubResp = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Unsubscribed!B2:B10000",
    });
    const unsubEmails = (unsubResp.data.values || [])
      .map((r) => cleanEmail(r[0]))
      .filter(Boolean);
    const unsubSet = new Set(unsubEmails);
    console.log(`Unsubscribed Sheet emails: ${unsubEmails.length} (${unsubSet.size} unique)`);

    // Duplicates within master sheet
    const masterDupes = masterEmails.length - masterSet.size;
    console.log(`Duplicates within Master Sheet: ${masterDupes}`);

    // Overlap: Master Sheet emails in Unsubscribed
    const masterInUnsub = [...masterSet].filter((e) => unsubSet.has(e));
    console.log(`Master Sheet emails also in Unsubscribed: ${masterInUnsub.length}`);

    // Combined sheet emails
    const allSheetEmails = new Set([...masterSet, ...unsubSet]);
    console.log(`Total unique emails in spreadsheet: ${allSheetEmails.size}`);

    // ── Sheet vs Database overlaps ────────────────────────────────────

    console.log("\n=== Sheet vs Database overlaps ===\n");

    const sheetInBr = [...allSheetEmails].filter((e) => brEmails.has(e));
    console.log(`Sheet emails already in BR Customers:  ${sheetInBr.length}`);

    const sheetInFbqCust = [...allSheetEmails].filter((e) => fbqCustEmails.has(e));
    console.log(`Sheet emails already in FBQ Customers: ${sheetInFbqCust.length}`);

    const sheetInFbqSub = [...allSheetEmails].filter((e) => fbqSubEmails.has(e));
    console.log(`Sheet emails already in FBQ Subscribers: ${sheetInFbqSub.length}`);

    const sheetNew = [...allSheetEmails].filter((e) => !allDbEmails.has(e));
    console.log(`Sheet emails NOT in any database:       ${sheetNew.length}`);

    // Combined total
    const grandTotal = new Set([...allDbEmails, ...allSheetEmails]);
    console.log(`\nGrand total unique emails (all sources): ${grandTotal.size}`);

    // ── Breakdown by action needed ────────────────────────────────────

    console.log("\n=== Import action summary ===\n");
    console.log(`New customers to create (not in any DB): ${sheetNew.length}`);
    console.log(`Existing BR customers to enrich:         ${sheetInBr.length}`);
    console.log(`Existing FBQ subscribers to promote:     ${sheetInFbqSub.filter((e) => !fbqCustEmails.has(e)).length}`);
    console.log(`Unsubscribed contacts (status change):   ${unsubSet.size}`);

    // Show some examples of cross-brand customers
    if (fbqSubInBr.length > 0) {
      console.log(`\nSample cross-brand customers (FBQ Sub + BR Customer, first 5):`);
      for (const email of fbqSubInBr.slice(0, 5)) {
        const br = brCustomers.find((c) => c.email === email);
        console.log(`  ${email} - BR: ${br?.firstName || "?"} ${br?.lastName || "?"}`);
      }
    }
  }

  // ── 4. Summary ─────────────────────────────────────────────────────────

  console.log("\n=== Migration plan summary ===\n");
  console.log(`1. FBQ Subscribers -> FBQ Customers:`);
  console.log(`   - ${fbqSubscribers.length} subscribers to migrate`);
  console.log(`   - ${fbqSubInFbqCust.length} already have Customer records (merge)`);
  console.log(`   - ${fbqSubscribers.length - fbqSubInFbqCust.length} new Customer records needed`);
  console.log(`   - ${fbqSubscribers.filter((s) => !s.optIn).length} are opted out (status: UNSUBSCRIBED)`);
  console.log(`\n2. Cross-brand overlap:`);
  console.log(`   - ${fbqSubInBr.length} FBQ subscribers exist as BR customers`);
  console.log(`   - These are the same people across both brands`);
  if (!WITH_SHEET) {
    console.log(`\nRun with --with-sheet to also check the shared marketing spreadsheet`);
  }

  await connection.end();
  console.log("\n[Duplicates] Done.");
}

main().catch((err) => {
  console.error("[Duplicates] Fatal error:", err.message);
  process.exit(1);
});
