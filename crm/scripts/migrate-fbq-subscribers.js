/**
 * CRM Import: FBQ Subscribers -> FBQ Customers
 *
 * Migrates Fat Big Quiz Subscriber records into the Customer table.
 * Also links SubscriberConfirmation records to the new Customer.
 *
 * Actions:
 *   1. Create FBQ Customer for each Subscriber (with customer number)
 *   2. Link SubscriberConfirmation records to new Customer
 *   3. Set marketingOptIn based on Subscriber.optIn
 *   4. Calculate initial scores
 *
 * Usage:
 *   node packages/crm/scripts/migrate-fbq-subscribers.js              # dry run
 *   node packages/crm/scripts/migrate-fbq-subscribers.js --execute    # write to DB
 *
 * Requires:
 *   - MySQL running with fat_big_quiz database
 */

const mysql = require("mysql2/promise");

const DRY_RUN = !process.argv.includes("--execute");
const PREFIX = "FBQ";
const DB_NAME = "fat_big_quiz";

// ── Helpers ─────────────────────────────────────────────────────────────────

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateCustomerNumber(seq) {
  return `#${PREFIX}${String(seq).padStart(4, "0")}`;
}

function cleanEmail(email) {
  if (!email) return null;
  return email.trim().toLowerCase();
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("[Import] FBQ Subscriber -> Customer Migration");
  console.log("[Import] Mode:", DRY_RUN ? "DRY RUN (pass --execute to write)" : "LIVE - writing to database");
  console.log("");

  const db = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: DB_NAME,
    multipleStatements: true,
  });

  const stats = {
    customersCreated: 0,
    customersMerged: 0,
    confirmationsLinked: 0,
    scoresCalculated: 0,
    errors: [],
  };

  // ── Step 1: Load existing data ──────────────────────────────────────────

  console.log("=== Step 1: Load existing data ===\n");

  const [subscribers] = await db.query(
    "SELECT id, email, firstName, lastName, source, sourcePath, subscribedAt, optIn FROM Subscriber ORDER BY subscribedAt ASC"
  );
  console.log(`[Import] FBQ Subscribers: ${subscribers.length}`);

  const [existingCustomers] = await db.query(
    "SELECT id, email, customerNumber FROM Customer"
  );
  console.log(`[Import] Existing FBQ Customers: ${existingCustomers.length}`);

  // Build email -> customer ID lookup
  const emailToCustomerId = new Map();
  for (const c of existingCustomers) {
    if (c.email) emailToCustomerId.set(c.email.toLowerCase(), c.id);
  }

  // Find next customer number
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

  console.log(`[Import] Next sequence number: ${nextSeq}`);

  // Build subscriber ID -> customer ID mapping (for confirmation linking)
  const subscriberToCustomer = new Map();

  // ── Step 2: Migrate subscribers to customers ────────────────────────────

  console.log("\n=== Step 2: Migrate subscribers ===\n");

  let created = 0;
  let merged = 0;

  for (const sub of subscribers) {
    const email = cleanEmail(sub.email);
    if (!email) continue;

    const existingCustomerId = emailToCustomerId.get(email);

    if (existingCustomerId) {
      // Customer already exists - merge subscriber data
      if (!DRY_RUN) {
        await db.query(
          `UPDATE Customer SET
            firstName = COALESCE(NULLIF(firstName, ''), NULLIF(?, '')),
            lastName = COALESCE(NULLIF(lastName, ''), NULLIF(?, '')),
            source = COALESCE(source, ?),
            marketingOptIn = IF(? = 1, true, marketingOptIn),
            lastActivityAt = COALESCE(lastActivityAt, ?),
            updatedAt = NOW()
          WHERE id = ?`,
          [
            sub.firstName || "",
            sub.lastName || "",
            sub.source || "fbq-subscriber",
            sub.optIn ? 1 : 0,
            sub.subscribedAt,
            existingCustomerId,
          ]
        );
        stats.customersMerged++;
      }
      merged++;
      subscriberToCustomer.set(sub.id, existingCustomerId);
    } else {
      // Create new customer
      const id = uuid();
      const customerNumber = generateCustomerNumber(nextSeq);
      nextSeq++;

      if (!DRY_RUN) {
        await db.query(
          `INSERT INTO Customer (
            id, customerNumber, firstName, lastName, email, source, status,
            marketingOptIn, lastActivityAt, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            id,
            customerNumber,
            sub.firstName || "Unknown",
            sub.lastName || "",
            email,
            sub.source || "fbq-subscriber",
            sub.optIn ? "ACTIVE" : "UNSUBSCRIBED",
            sub.optIn ? true : false,
            sub.subscribedAt || new Date(),
            sub.subscribedAt || new Date(),
          ]
        );
        stats.customersCreated++;
        emailToCustomerId.set(email, id);
      }
      created++;
      subscriberToCustomer.set(sub.id, id);
    }
  }

  console.log(`[Import] Customers created: ${created}`);
  console.log(`[Import] Customers merged: ${merged}`);

  // ── Step 3: Link SubscriberConfirmation records ─────────────────────────

  console.log("\n=== Step 3: Link SubscriberConfirmation records ===\n");

  const [confirmations] = await db.query(
    "SELECT id, subscriberId FROM SubscriberConfirmation WHERE subscriberId IS NOT NULL"
  );
  console.log(`[Import] ${confirmations.length} SubscriberConfirmation records to link`);

  if (!DRY_RUN) {
    let linked = 0;
    for (const conf of confirmations) {
      const customerId = subscriberToCustomer.get(conf.subscriberId);
      if (customerId) {
        await db.query(
          "UPDATE SubscriberConfirmation SET customerId = ? WHERE id = ?",
          [customerId, conf.id]
        );
        linked++;
      }
    }
    stats.confirmationsLinked = linked;
    console.log(`[Import] Confirmations linked: ${linked}`);
  } else {
    const linkable = confirmations.filter((c) => subscriberToCustomer.has(c.subscriberId));
    console.log(`[Import] Would link ${linkable.length} confirmations`);
  }

  // ── Step 4: Create SIGNUP activity for each subscriber ──────────────────

  console.log("\n=== Step 4: Create signup activities ===\n");

  if (!DRY_RUN) {
    let activitiesCreated = 0;
    for (const sub of subscribers) {
      const email = cleanEmail(sub.email);
      if (!email) continue;
      const customerId = emailToCustomerId.get(email);
      if (!customerId) continue;

      try {
        await db.query(
          `INSERT INTO CustomerActivity (
            id, customerId, type, source, channel, metadata, createdAt
          ) VALUES (?, ?, 'SIGNUP', ?, ?, ?, ?)`,
          [
            uuid(),
            customerId,
            sub.source || "fbq-subscriber",
            sub.sourcePath || null,
            JSON.stringify({ migratedFrom: "Subscriber", subscriberId: sub.id }),
            sub.subscribedAt || new Date(),
          ]
        );
        activitiesCreated++;
      } catch (err) {
        stats.errors.push(`Activity for ${email}: ${err.message}`);
      }
    }
    console.log(`[Import] Signup activities created: ${activitiesCreated}`);
  } else {
    console.log(`[Import] Would create ${subscribers.length} signup activities`);
  }

  // ── Step 5: Calculate scores ────────────────────────────────────────────

  console.log("\n=== Step 5: Calculate scores ===\n");

  const [allCustomers] = await db.query(
    "SELECT id, email, phone, company, marketingOptIn, totalBookings, referralName, lastActivityAt FROM Customer"
  );
  console.log(`[Import] ${allCustomers.length} customers to score`);

  if (!DRY_RUN) {
    let scored = 0;
    for (const customer of allCustomers) {
      try {
        let profileScore = 0;
        if (customer.email) profileScore += 5;
        if (customer.phone) profileScore += 5;
        if (customer.company) profileScore += 10;
        if (customer.marketingOptIn) profileScore += 5;

        const purchaseScore = (customer.totalBookings || 0) * 20;
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

        // Engagement from campaign sends (uses CrmCampaignSend in FBQ)
        const [sends] = await db.query(
          "SELECT opened, clicked FROM CrmCampaignSend WHERE customerId = ?",
          [customer.id]
        );
        for (const s of sends) {
          if (s.opened) engagementScore += 2;
          if (s.clicked) engagementScore += 5;
        }

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
      } catch (err) {
        stats.errors.push(`Score for ${customer.id}: ${err.message}`);
      }
    }
    stats.scoresCalculated = scored;
    console.log(`[Import] Scores calculated: ${scored}`);
  } else {
    console.log(`[Import] Would calculate scores for ${allCustomers.length} customers`);
  }

  // ── Final report ────────────────────────────────────────────────────────

  console.log("\n" + "=".repeat(60));
  console.log(DRY_RUN ? "DRY RUN COMPLETE" : "IMPORT COMPLETE");
  console.log("=".repeat(60));
  console.log(`Customers created:       ${DRY_RUN ? created : stats.customersCreated}`);
  console.log(`Customers merged:        ${DRY_RUN ? merged : stats.customersMerged}`);
  console.log(`Confirmations linked:    ${DRY_RUN ? "pending" : stats.confirmationsLinked}`);
  console.log(`Scores calculated:       ${DRY_RUN ? "pending" : stats.scoresCalculated}`);
  console.log(`Errors:                  ${stats.errors.length}`);
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
