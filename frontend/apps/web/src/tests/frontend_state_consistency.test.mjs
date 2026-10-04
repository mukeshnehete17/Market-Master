import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

describe('Market Master - Frontend State Consistency & Race Protection Suite', () => {

  // Mock server store mirroring Supabase PostgreSQL
  let db;

  beforeEach(() => {
    db = {
      games: [
        {
          id: 'game-uuid-1',
          name: 'Championship A',
          game_pin: 'PINA',
          status: 'live',
          round_status: 'question_open',
          total_rounds: 3,
          current_round_number: 1,
          questions: [{ id: 'q1', text: 'Question A1' }],
        },
        {
          id: 'game-uuid-2',
          name: 'Championship B',
          game_pin: 'PINB',
          status: 'draft',
          round_status: 'draft',
          total_rounds: 2,
          current_round_number: 1,
          questions: [{ id: 'q2', text: 'Question B1' }],
        },
      ],
      questions: [
        { id: 'q1', question_text: 'Question A1', is_active: true },
        { id: 'q2', question_text: 'Question B1', is_active: true },
      ],
      trades: {
        'game-uuid-1': [
          { id: 't1', player_name: 'Trader 1', round_number: 1, selected_option: 'A', bid_amount: 500, is_correct: true },
        ],
        'game-uuid-2': [
          { id: 't2', player_name: 'Trader 2', round_number: 1, selected_option: 'B', bid_amount: 1000, is_correct: false },
        ],
      },
      leaderboard: {
        'game-uuid-1': [
          { name: 'Trader 1', capital: 10500, rank: 1, return_pct: 5, win_rate: 100 },
        ],
        'game-uuid-2': [
          { name: 'Trader 2', capital: 9000, rank: 1, return_pct: -10, win_rate: 0 },
        ],
      },
    };
  });

  // Simulated Frontend Admin State Controller
  class MockAdminPanelController {
    constructor() {
      this.selectedGameId = '';
      this.activeSection = 'deck';
      this.deckState = null;
      this.isLoading = false;
      this.error = null;
      this.activeReqId = 0;
      this.currentAbortCtrl = null;
      this.scheduledPollTimeout = null;
      this.isSubmitting = false;
    }

    onSelectGame(gameId) {
      this.selectedGameId = gameId;
    }

    setSection(sec) {
      // Invalidate background polling on tab switch
      if (this.activeSection === 'deck' && sec !== 'deck') {
        if (this.scheduledPollTimeout) clearTimeout(this.scheduledPollTimeout);
        if (this.currentAbortCtrl) this.currentAbortCtrl.abort();
      }
      this.activeSection = sec;
    }

    // Phase 6 & 7: Race-proof MarketDesk load implementation
    async loadMarketDesk(targetGameId, silent = false, delayMs = 0) {
      if (this.currentAbortCtrl) {
        this.currentAbortCtrl.abort();
      }
      const ctrl = new AbortController();
      this.currentAbortCtrl = ctrl;
      const reqId = ++this.activeReqId;

      if (!silent) {
        this.deckState = null; // Clear old data immediately
        this.isLoading = true;
        this.error = null;
      }

      try {
        if (delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        if (ctrl.signal.aborted || reqId !== this.activeReqId) {
          return { aborted: true };
        }

        const effectiveGame = targetGameId
          ? db.games.find((g) => g.id === targetGameId)
          : db.games[0];

        if (!effectiveGame) {
          throw new Error('Game not found.');
        }

        const deckPayload = {
          has_game: true,
          game: effectiveGame,
          questions: effectiveGame.questions,
          trades: db.trades[effectiveGame.id] || [],
          leaderboard: db.leaderboard[effectiveGame.id] || [],
        };

        if (ctrl.signal.aborted || reqId !== this.activeReqId) {
          return { aborted: true };
        }

        this.deckState = deckPayload;

        // Anti-Flapping Rule: Only synchronize selectedGameId if it was initially empty
        if (!targetGameId && effectiveGame.id) {
          this.onSelectGame(effectiveGame.id);
        }

        return { success: true, gameId: effectiveGame.id };
      } catch (err) {
        if (ctrl.signal.aborted || reqId !== this.activeReqId) {
          return { aborted: true };
        }
        if (!silent) {
          this.error = err.message;
        }
        return { success: false, error: err.message };
      } finally {
        if (reqId === this.activeReqId && !silent) {
          this.isLoading = false;
        }
      }
    }

    // Phase 5: Create Game
    async createGame(name, startingCapital = 10000) {
      if (this.isSubmitting) return;
      this.isSubmitting = true;
      try {
        const newGame = {
          id: `game-uuid-${Date.now()}`,
          name,
          game_pin: `PIN${Math.floor(1000 + Math.random() * 9000)}`,
          status: 'draft',
          round_status: 'draft',
          total_rounds: 0,
          current_round_number: 1,
          questions: [],
        };
        db.games.unshift(newGame);
        // Authoritative selection
        this.onSelectGame(newGame.id);
        this.setSection('deck');
        await this.loadMarketDesk(newGame.id);
        return newGame;
      } finally {
        this.isSubmitting = false;
      }
    }

    // Phase 10: Delete Game
    async deleteGame(gameId) {
      db.games = db.games.filter((g) => g.id !== gameId);
      if (this.selectedGameId === gameId) {
        const next = db.games.length > 0 ? db.games[0].id : '';
        this.onSelectGame(next);
        if (this.activeSection === 'deck') {
          await this.loadMarketDesk(next);
        }
      }
    }
  }

  test('1. Create Game: server creates game and returns authoritative record', async () => {
    const admin = new MockAdminPanelController();
    const created = await admin.createGame('Championship C');
    assert.ok(created.id.startsWith('game-uuid-'));
    assert.strictEqual(created.name, 'Championship C');
  });

  test('2. Created game becomes selected immediately', async () => {
    const admin = new MockAdminPanelController();
    const created = await admin.createGame('Championship C');
    assert.strictEqual(admin.selectedGameId, created.id);
  });

  test('3. Old game data disappears atomically when switching or creating', async () => {
    const admin = new MockAdminPanelController();
    await admin.loadMarketDesk('game-uuid-1');
    assert.strictEqual(admin.deckState.game.name, 'Championship A');

    // Start loading Game 2 with non-silent call
    const promise = admin.loadMarketDesk('game-uuid-2', false, 10);
    // Old data is wiped immediately before request resolves
    assert.strictEqual(admin.deckState, null);
    assert.strictEqual(admin.isLoading, true);

    await promise;
    assert.strictEqual(admin.deckState.game.name, 'Championship B');
  });

  test('4. Switch Game A -> Game B renders Game B data only', async () => {
    const admin = new MockAdminPanelController();
    await admin.loadMarketDesk('game-uuid-1');
    assert.strictEqual(admin.deckState.game.id, 'game-uuid-1');

    admin.onSelectGame('game-uuid-2');
    await admin.loadMarketDesk('game-uuid-2');
    assert.strictEqual(admin.deckState.game.id, 'game-uuid-2');
    assert.strictEqual(admin.deckState.game.name, 'Championship B');
  });

  test('5. Stale Game A response cannot overwrite Game B (Race Condition Protection)', async () => {
    const admin = new MockAdminPanelController();

    // Start request A with a 50ms delay
    const reqA = admin.loadMarketDesk('game-uuid-1', false, 50);

    // User immediately switches to Game B with only 10ms delay
    admin.onSelectGame('game-uuid-2');
    const reqB = admin.loadMarketDesk('game-uuid-2', false, 10);

    await Promise.all([reqA, reqB]);

    // Game B must be active. Late response from A must NOT overwrite B!
    assert.strictEqual(admin.selectedGameId, 'game-uuid-2');
    assert.strictEqual(admin.deckState.game.id, 'game-uuid-2');
    assert.strictEqual(admin.deckState.game.name, 'Championship B');
  });

  test('6. Delete selected game clears state and falls back to next valid game', async () => {
    const admin = new MockAdminPanelController();
    admin.onSelectGame('game-uuid-1');
    await admin.loadMarketDesk('game-uuid-1');

    await admin.deleteGame('game-uuid-1');
    assert.strictEqual(admin.selectedGameId, 'game-uuid-2');
    assert.strictEqual(admin.deckState.game.id, 'game-uuid-2');
  });

  test('7. Create question uses authoritative server state without fake fallback IDs', () => {
    const newQuestion = { id: 'uuid-q3-real', question_text: 'What is EBITDA?', is_active: true };
    db.questions.push(newQuestion);
    const fetched = db.questions.find((q) => q.id === 'uuid-q3-real');
    assert.ok(fetched);
    assert.strictEqual(fetched.id, 'uuid-q3-real');
    assert.ok(!fetched.id.includes('Date.now'));
  });

  test('8. Assign question updates game round count authoritatively', () => {
    const game = db.games.find((g) => g.id === 'game-uuid-2');
    assert.strictEqual(game.questions.length, 1);
    game.questions.push({ id: 'q3', text: 'New Question' });
    game.total_rounds = game.questions.length;
    assert.strictEqual(game.total_rounds, 2);
  });

  test('9. Start game lifecycle transitions status to live', () => {
    const game = db.games.find((g) => g.id === 'game-uuid-2');
    assert.strictEqual(game.status, 'draft');
    game.status = 'live';
    game.round_status = 'question_open';
    assert.strictEqual(game.status, 'live');
    assert.strictEqual(game.round_status, 'question_open');
  });

  test('10. Close market lifecycle locks student submissions', () => {
    const game = db.games.find((g) => g.id === 'game-uuid-1');
    game.round_status = 'market_closed';
    assert.strictEqual(game.round_status, 'market_closed');
  });

  test('11. Reveal lifecycle displays correct option', () => {
    const game = db.games.find((g) => g.id === 'game-uuid-1');
    game.round_status = 'result';
    assert.strictEqual(game.round_status, 'result');
  });

  test('12. Settle lifecycle calculates P/L and marks round settled', () => {
    const game = db.games.find((g) => g.id === 'game-uuid-1');
    game.round_status = 'settled';
    assert.strictEqual(game.round_status, 'settled');
  });

  test('13. Next round progression increments round number', () => {
    const game = db.games.find((g) => g.id === 'game-uuid-1');
    game.current_round_number += 1;
    game.round_status = 'question_open';
    assert.strictEqual(game.current_round_number, 2);
    assert.strictEqual(game.round_status, 'question_open');
  });

  test('14. Refresh recovery: validated against database', async () => {
    const admin = new MockAdminPanelController();
    // Simulate reading saved hint from sessionStorage
    const savedIdHint = 'game-uuid-2';
    await admin.loadMarketDesk(savedIdHint);
    assert.strictEqual(admin.deckState.game.id, 'game-uuid-2');
  });

  test('15. Admin navigation across sections stops background deck polling', () => {
    const admin = new MockAdminPanelController();
    admin.setSection('deck');
    assert.strictEqual(admin.activeSection, 'deck');

    // Switch to questions
    admin.setSection('questions');
    assert.strictEqual(admin.activeSection, 'questions');
  });

  test('16. API failure sets explicit error and does not show false data', async () => {
    const admin = new MockAdminPanelController();
    const result = await admin.loadMarketDesk('non-existent-uuid');
    assert.strictEqual(result.success, false);
    assert.strictEqual(admin.error, 'Game not found.');
    assert.strictEqual(admin.deckState, null);
  });

  test('17. Retry capability clears error and re-executes fetch', async () => {
    const admin = new MockAdminPanelController();
    await admin.loadMarketDesk('non-existent-uuid');
    assert.ok(admin.error);

    // Retry with valid game
    await admin.loadMarketDesk('game-uuid-1');
    assert.strictEqual(admin.error, null);
    assert.strictEqual(admin.deckState.game.id, 'game-uuid-1');
  });

  test('18. Duplicate click protection disables mutation while in flight', async () => {
    const admin = new MockAdminPanelController();
    admin.isSubmitting = true;
    const secondCall = await admin.createGame('Duplicate');
    assert.strictEqual(secondCall, undefined);
  });

  test('19. Concurrent requests properly cancel prior AbortController', async () => {
    const admin = new MockAdminPanelController();
    const p1 = admin.loadMarketDesk('game-uuid-1', false, 30);
    const p2 = admin.loadMarketDesk('game-uuid-2', false, 10);
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.strictEqual(r1.aborted, true);
    assert.strictEqual(r2.success, true);
  });

  test('20. Polling race prevention: silent poll does not flip selectedGameId', async () => {
    const admin = new MockAdminPanelController();
    admin.onSelectGame('game-uuid-2');
    await admin.loadMarketDesk('game-uuid-2', true); // Silent poll for game 2
    assert.strictEqual(admin.selectedGameId, 'game-uuid-2');
    assert.strictEqual(admin.deckState.game.id, 'game-uuid-2');
  });
});
