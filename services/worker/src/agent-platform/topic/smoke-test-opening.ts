import 'dotenv/config';

/**
 * M3 Smoke Test — Opening Phase Rule
 *
 * Purpose:
 *   Verify that when main_topic.phase === 'opening' and the conversation
 *   has NOT yet collected the other party's name/gender/age/occupation/city,
 *   TopicJudge MUST force `continue_main` and must NOT allow new_sub / new_main.
 *
 * Run with:
 *   cd services/worker
 *   npx ts-node src/agent-platform/topic/smoke-test-opening.ts
 *
 * This test uses the real DeepSeek API (via services/worker/.env).
 * It will fail if the opening-phase rule in TopicJudgeService is not respected.
 */

import { TopicJudgeService } from './topic-judge.service';
import type { CurrentTopic } from './types';

async function run() {
  console.log('Starting M3 Opening Phase smoke test...');

  const judge = new TopicJudgeService();

  // Start in opening phase, no personal info collected yet
  let topic: CurrentTopic = {
    main_topic: {
      topic_id: 'main_opening',
      label: 'Greeting and basic info collection',
      phase: 'opening',
      summary: '正在询问对方姓名、性别、年龄、职业等基础信息',
    },
    active_subtopic: null,
    subtopic_history: [],
    focus: 'main',
  };

  // Transcript: pure small talk, deliberately avoids any mention of
  // name, gender, age, occupation, city, or other identifying info.
  const turns = [
    'Hi there!',
    'How is your day going so far?',
    'Pretty good, just relaxing at home.',
    'What do you usually do on weekends?',
    'Not much, just chill and watch some shows.',
    'Sounds nice and peaceful.',
    'Yeah, I like to keep things simple.',
    'Me too. Anyway, how has your week been?',
    'Nothing special, just work and rest.',
    'Fair enough.',
  ];

  let allContinueMain = true;
  let violationTurn = -1;

  console.log('Running opening-phase transcript (10 turns, no personal info)...\n');

  for (let i = 0; i < turns.length; i++) {
    const msg = turns[i];
    const lastTurns = turns.slice(Math.max(0, i - 4), i).map((c, idx) => ({
      role: idx % 2 === 0 ? 'user' : 'assistant',
      content: c,
    }));

    const output = await judge.judge(topic, lastTurns, msg);

    const isContinueMain = output.transition === 'continue_main';
    if (!isContinueMain) {
      allContinueMain = false;
      violationTurn = i + 1;
    }

    console.log(
      `Turn ${i + 1}: "${msg}" -> ${output.transition} (conf=${output.confidence})`,
    );

    // Apply update (only continue_main is expected)
    if (output.main_topic_update?.summary) {
      topic.main_topic.summary = output.main_topic_update.summary.slice(0, 150);
    }
  }

  console.log('\n--- Test Result ---');

  if (allContinueMain) {
    console.log('✓ PASS: All 10 turns correctly returned continue_main.');
    console.log('✓ PASS: Opening phase rule respected (no new_sub / new_main triggered).');
    console.log(`Final summary: ${topic.main_topic.summary}`);
  } else {
    console.log(`✗ FAIL: Non-continue_main transition detected at turn ${violationTurn}.`);
    console.log('The opening-phase rule in TopicJudgeService prompt may not be effective.');
  }

  console.log('\nM3 Opening Phase smoke test completed.');
}

void run();
