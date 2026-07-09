/**
 * Backfill ideal_embedding for existing profile_embeddings records.
 *
 * Usage:
 *   npx tsx src/scripts/backfill-ideal-embeddings.ts
 *
 * Reads each user's OnboardingSession surveyJson, computes ideal-partner
 * embedding text (buildTextForIdealEmbedding), calls DashScope embed API,
 * and writes the vector to the new ideal_embedding column.
 *
 * Resume-safe: skips records that already have ideal_embedding.
 * Degraded path: if no Card 16-18 responses, still generates from
 *   attachmentStyle + trustView + happinessView + goal.
 */

import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { LlmService } from '../llm/llm.service';
import { buildTextForIdealEmbedding, type OnboardingSurveyJson } from '../onboarding/survey-schema';
import {
  calculateIdealPartnerDimensions,
  toSurveyIdealPartnerDimensions,
  IDEAL_PARTNER_CARD_IDS,
} from '../onboarding/dimension-scorer';
import type { ScenarioResponse } from '../onboarding/survey-schema';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidEmbedding(vec: number[]): boolean {
  if (vec.every((v) => v === 0)) return false;
  const mean = vec.reduce((a, b) => a + b, 0) / vec.length;
  const variance = vec.reduce((a, v) => a + (v - mean) ** 2, 0) / vec.length;
  return Math.sqrt(variance) >= 0.001;
}

/**
 * 检查 surveyJson 是否包含理想伴侣卡片（Card 16-18）的回答。
 */
function hasIdealCardResponses(survey: OnboardingSurveyJson): boolean {
  if (!survey.scenarioCards?.length) return false;
  return survey.scenarioCards.some((c) => IDEAL_PARTNER_CARD_IDS.has(c.cardId));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient();
  const llm = new LlmService();

  const BATCH_SIZE = 20;
  let processed = 0;
  let skipped = 0;
  let success = 0;
  let failed = 0;
  let noData = 0;
  let cursor: string | undefined;

  try {
    // Verify DB connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('[backfill] DB connected. Starting ideal_embedding backfill...\n');

    // Count total records needing backfill
    const totalNeedingBackfill = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM profile_embeddings WHERE ideal_embedding IS NULL
    `;
    const total = Number(totalNeedingBackfill[0].count);
    console.log(`[backfill] ${total} records need backfill (ideal_embedding IS NULL)\n`);

    if (total === 0) {
      console.log('[backfill] Nothing to do. All records already have ideal_embedding.');
      return;
    }

    while (true) {
      // Fetch batch: only select fields we need, skip already-filled records
      const batch = await prisma.profileEmbedding.findMany({
        where: { idealEmbedding: { equals: Prisma.DbNull } },
        select: { userId: true },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { userId: cursor } } : {}),
        orderBy: { userId: 'asc' },
      });

      if (batch.length === 0) break;

      for (const { userId } of batch) {
        processed++;

        try {
          // Load latest onboarding session
          const session = await prisma.onboardingSession.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
          });

          const survey = (session?.surveyJson ?? {}) as OnboardingSurveyJson;

          // If scenarioCards contain Card 16-18, compute idealPartnerDimensions
          // and inject into survey for buildTextForIdealEmbedding to consume.
          if (hasIdealCardResponses(survey)) {
            const responses = survey.scenarioCards as ScenarioResponse[];
            const idealScores = calculateIdealPartnerDimensions(responses);
            survey.idealPartnerDimensions = toSurveyIdealPartnerDimensions(idealScores);
          }
          // else: degraded path — buildTextForIdealEmbedding falls back to
          // attachmentStyle + trustView + happinessView + goal automatically.

          const idealText = buildTextForIdealEmbedding(null, survey, userId);

          // Detect pure-fallback case (no meaningful data at all)
          if (idealText === `idealPartnerDefault_${userId}`) {
            console.log(`[${processed}/${total}] ${userId} — SKIP (no data for ideal embedding)`);
            noData++;
            continue;
          }

          const result = await llm.embed(idealText);

          if (result.quality !== 'real' || !isValidEmbedding(result.vector)) {
            console.log(
              `[${processed}/${total}] ${userId} — SKIP (quality=${result.quality}, valid=${isValidEmbedding(result.vector)})`,
            );
            noData++;
            continue;
          }

          const idealVecStr = `[${result.vector.join(',')}]`;
          await prisma.$executeRaw`
            UPDATE profile_embeddings
            SET ideal_embedding = ${idealVecStr}::vector
            WHERE user_id = ${userId}
          `;

          success++;
          console.log(`[${processed}/${total}] ${userId} — OK`);
        } catch (err) {
          failed++;
          console.error(`[${processed}/${total}] ${userId} — FAIL: ${(err as Error).message}`);
        }
      }

      cursor = batch[batch.length - 1].userId;

      if (batch.length < BATCH_SIZE) break;
    }

    console.log(
      `\n[backfill] Complete: success=${success}, skipped/noData=${noData}, failed=${failed}, total_processed=${processed}`,
    );
  } catch (err) {
    console.error('[backfill] Fatal error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
