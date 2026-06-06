/**
 * @lozzalingo/outreach - Scheduler
 * Processes the scheduled outreach queue. Run via cron job.
 */

/**
 * Process all pending scheduled outreach that is due.
 * @param {object} prisma
 * @param {object} outreachService - From createOutreachService()
 * @param {string} modelName - OutreachSchedule model name
 * @returns {Promise<{ processed: number, sent: number, failed: number }>}
 */
async function processScheduledOutreach(prisma, outreachService, modelName = "outreachSchedule") {
  const counts = { processed: 0, sent: 0, failed: 0 };

  try {
    console.log("[Outreach] Processing scheduled outreach");

    // 1. Find all PENDING where scheduledFor <= now
    const dueItems = await prisma[modelName].findMany({
      where: {
        status: "PENDING",
        scheduledFor: { lte: new Date() },
      },
    });

    if (dueItems.length === 0) {
      console.log("[Outreach] No scheduled outreach due");
      return counts;
    }

    console.log("[Outreach] Found", dueItems.length, "due item(s)");

    // 2. Process each due item
    for (const item of dueItems) {
      counts.processed++;

      try {
        // Build data object from the scheduled item
        const data = {
          bookingId: item.bookingId,
          customerEmail: item.recipientEmail,
          recipientEmail: item.recipientEmail,
        };

        // Fire the trigger
        const result = await outreachService.trigger(item.trigger, data);

        if (result.sent) {
          // Update status to SENT
          await prisma[modelName].update({
            where: { id: item.id },
            data: { status: "SENT", processedAt: new Date() },
          });
          counts.sent++;
          console.log("[Outreach] Scheduled item sent:", item.id);
        } else {
          // Update status to FAILED
          await prisma[modelName].update({
            where: { id: item.id },
            data: {
              status: "FAILED",
              processedAt: new Date(),
              error: result.reason || "Send returned false",
            },
          });
          counts.failed++;
          console.log("[Outreach] Scheduled item failed:", item.id, result.reason);
        }
      } catch (itemError) {
        console.error("[Outreach] Error processing scheduled item:", item.id, itemError.message);

        try {
          await prisma[modelName].update({
            where: { id: item.id },
            data: {
              status: "FAILED",
              processedAt: new Date(),
              error: itemError.message,
            },
          });
        } catch (updateError) {
          console.error("[Outreach] Failed to update scheduled item status:", updateError.message);
        }

        counts.failed++;
      }
    }

    console.log("[Outreach] Processed:", counts.processed, "sent:", counts.sent, "failed:", counts.failed);
    return counts;
  } catch (error) {
    console.error("[Outreach] Failed to process scheduled outreach:", error.message);
    return counts;
  }
}

module.exports = { processScheduledOutreach };
